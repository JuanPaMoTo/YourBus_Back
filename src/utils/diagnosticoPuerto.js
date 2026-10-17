// Diagnóstico de "puerto en uso" sin depender de ss/lsof/netstat/ps (que a
// veces no existen dentro del contenedor de Azure App Service). Lee /proc
// directamente, así que funciona en cualquier Linux.
//
// Responde a la pregunta: ¿QUÉ proceso está escuchando en el puerto que mi
// app necesita? Si el socket existe en /proc/net/tcp pero ningún proceso
// visible lo posee, el dueño vive fuera de este contenedor/namespace
// (por ejemplo un sidecar) y el reporte lo dice explícitamente.

const fs = require('fs');
const path = require('path');

function leer(ruta) {
  try {
    return fs.readFileSync(ruta, 'utf8');
  } catch (err) {
    return null;
  }
}

function listarPids() {
  try {
    return fs.readdirSync('/proc').filter((nombre) => /^\d+$/.test(nombre));
  } catch (err) {
    return [];
  }
}

function cmdDe(pid) {
  const cmdline = (leer(`/proc/${pid}/cmdline`) || '').split('\0').join(' ').trim();
  return cmdline || (leer(`/proc/${pid}/comm`) || '').trim() || '(desconocido)';
}

function ppidDe(pid) {
  const stat = leer(`/proc/${pid}/stat`) || '';
  // Formato: pid (comm) estado ppid ... — el comm puede traer espacios/paréntesis.
  const campos = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  return Number(campos[1]) || 0;
}

// Sockets TCP en estado LISTEN (0A) sobre el puerto indicado.
function listenersEnPuerto(puerto) {
  const encontrados = [];
  for (const archivo of ['/proc/net/tcp', '/proc/net/tcp6']) {
    const contenido = leer(archivo);
    if (!contenido) continue;
    for (const linea of contenido.split('\n').slice(1)) {
      const c = linea.trim().split(/\s+/);
      if (c.length < 10) continue;
      const [ipHex, puertoHex] = c[1].split(':');
      if (c[3] !== '0A' || parseInt(puertoHex, 16) !== puerto) continue;
      encontrados.push({
        inodo: c[9],
        familia: archivo.endsWith('tcp6') ? 'IPv6' : 'IPv4',
        direccion: /^0+$/.test(ipHex) ? 'todas las interfaces' : `ip(hex)=${ipHex}`,
      });
    }
  }
  return encontrados;
}

// Mapa inodo -> [pids que tienen ese socket abierto].
function propietariosPorInodo(inodos) {
  const buscados = new Set(inodos.map((i) => `socket:[${i}]`));
  const mapa = new Map();
  for (const pid of listarPids()) {
    const dirFd = `/proc/${pid}/fd`;
    let fds;
    try {
      fds = fs.readdirSync(dirFd);
    } catch (err) {
      continue; // sin permisos o proceso ya terminado
    }
    for (const fd of fds) {
      let destino;
      try {
        destino = fs.readlinkSync(`${dirFd}/${fd}`);
      } catch (err) {
        continue;
      }
      if (buscados.has(destino)) {
        const lista = mapa.get(destino) || [];
        if (!lista.includes(Number(pid))) lista.push(Number(pid));
        mapa.set(destino, lista);
      }
    }
  }
  return mapa;
}

function resumenNginx(maxLineas = 40) {
  const lineas = [];
  const visitar = (dir, profundidad) => {
    let entradas;
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }
    for (const entrada of entradas) {
      if (lineas.length >= maxLineas) return;
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (profundidad < 3) visitar(ruta, profundidad + 1);
        continue;
      }
      const texto = leer(ruta);
      if (!texto || texto.length > 200000) continue;
      for (const linea of texto.split('\n')) {
        if (/^\s*(listen|root|proxy_pass|server_name)\b/.test(linea)) {
          lineas.push(`${ruta}: ${linea.trim()}`);
          if (lineas.length >= maxLineas) return;
        }
      }
    }
  };
  visitar('/etc/nginx', 0);
  return lineas;
}

function listarCarpeta(dir, max = 30) {
  try {
    return fs.readdirSync(dir).slice(0, max).join(', ');
  } catch (err) {
    return '(no accesible)';
  }
}

// Variables seguras de mostrar (nunca MONGODB_URI ni nada con credenciales).
const VARS_CON_VALOR = [
  'PORT',
  'WEBSITES_PORT',
  'NODE_ENV',
  'NODE_OPTIONS',
  'WEBSITE_SITE_NAME',
  'WEBSITES_ENABLE_APP_SERVICE_STORAGE',
  'WEBSITES_CONTAINER_START_TIME_LIMIT',
  'WEBSITE_ENABLE_SYNC_UPDATE_SITE',
];

function resumenEntorno() {
  const conValor = VARS_CON_VALOR.map(
    (k) => `${k}=${process.env[k] === undefined ? '(no definida)' : process.env[k]}`,
  );
  const soloNombre = Object.keys(process.env)
    .filter(
      (k) => /^(WEBSITE|WEBSITES|APPSVC|ORYX|CONTAINER)/.test(k) && !VARS_CON_VALOR.includes(k),
    )
    .sort();
  return { conValor, soloNombre };
}

function diagnosticarPuerto(puerto, log = console.error) {
  const listeners = listenersEnPuerto(puerto);
  const mapa = propietariosPorInodo(listeners.map((l) => l.inodo));
  const propietarios = [];

  log(`=== DIAGNÓSTICO DEL PUERTO ${puerto} ===`);
  log(`Mi proceso: pid=${process.pid} ppid=${process.ppid}`);
  const entorno = resumenEntorno();
  log(`Entorno: ${entorno.conValor.join(' | ')}`);
  log(
    `Otras variables de plataforma (solo nombres): ${entorno.soloNombre.join(', ') || '(ninguna)'}`,
  );

  if (listeners.length === 0) {
    log(
      `No hay ningún socket en LISTEN en el puerto ${puerto} dentro de este contenedor ahora mismo (quizá se liberó justo ahora).`,
    );
  }
  for (const l of listeners) {
    const pids = mapa.get(`socket:[${l.inodo}]`) || [];
    if (pids.length === 0) {
      log(
        `Escucha ${l.familia} ${l.direccion}: dueño NO visible desde este proceso (inodo ${l.inodo}). Suele ser otro contenedor/sidecar que comparte la red.`,
      );
    }
    for (const pid of pids) {
      const info = { pid, ppid: ppidDe(pid), cmd: cmdDe(pid) };
      propietarios.push(info);
      log(
        `Escucha ${l.familia} ${l.direccion}: pid=${info.pid} ppid=${info.ppid} cmd="${info.cmd}"`,
      );
    }
  }

  log('--- Procesos del contenedor ---');
  for (const pid of listarPids()) {
    log(`pid=${pid} ppid=${ppidDe(pid)} cmd="${cmdDe(pid)}"`);
  }

  const nginx = resumenNginx();
  log(
    `--- Config de nginx (listen/root/server_name) ---${nginx.length ? '' : ' (no se encontró /etc/nginx)'}`,
  );
  nginx.forEach((l) => log(l));

  log(`--- Archivos en ${process.cwd()} --- ${listarCarpeta(process.cwd())}`);
  log(`--- Archivos en /home/site/wwwroot --- ${listarCarpeta('/home/site/wwwroot')}`);
  log('=== FIN DEL DIAGNÓSTICO ===');

  return { listeners, propietarios };
}

// Si el que ocupa el puerto es un nginx de ESTE contenedor, lo detiene para
// que la app pueda arrancar. Devuelve cuántos procesos señalizó.
function liberarSiEsNginx(propietarios, log = console.error) {
  if (process.env.NO_LIBERAR_NGINX === '1') return 0;
  let enviados = 0;
  for (const p of propietarios) {
    if (p.pid === process.pid || !/nginx/i.test(p.cmd)) continue;
    try {
      process.kill(p.pid, 'SIGTERM');
      enviados += 1;
      log(`Detuve el proceso nginx pid=${p.pid} que ocupaba el puerto.`);
    } catch (err) {
      log(`No pude detener pid=${p.pid}: ${err.message}`);
    }
  }
  return enviados;
}

module.exports = { diagnosticarPuerto, liberarSiEsNginx, listenersEnPuerto };
