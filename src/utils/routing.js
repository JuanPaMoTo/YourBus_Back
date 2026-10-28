// Distancia y tiempo "por calles" entre una lista ordenada de puntos.
//
// Usa OSRM (motor de rutas sobre datos de OpenStreetMap). Si el servicio no
// responde, cae a una estimación en línea recta con un factor de rodeo y lo
// informa en `metodo`, para que la app nunca se quede sin ETA y el usuario
// sepa que es aproximado.

const config = require('../config/env');
const { largoPoligonal } = require('./geo');

// En ciudad, el camino real es ~35 % más largo que la línea recta.
const FACTOR_RODEO = 1.35;
// Velocidad media de un bus urbano usada solo en la estimación de respaldo.
const VELOCIDAD_BUS_MS = 20 / 3.6;

async function pedirRutaOsrm(puntos, { fetchImpl, baseUrl, timeoutMs }) {
  const coordenadas = puntos.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${baseUrl}/route/v1/driving/${coordenadas}?overview=false&alternatives=false&steps=false`;

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controlador.signal,
      headers: { 'User-Agent': 'YourBus-Academico/1.0' },
    });
    if (!res.ok) throw new Error(`OSRM respondió ${res.status}`);
    const datos = await res.json();
    if (datos.code !== 'Ok' || !Array.isArray(datos.routes) || datos.routes.length === 0) {
      throw new Error(`OSRM no encontró ruta (${datos.code})`);
    }
    return { distanciaMetros: datos.routes[0].distance, segundosAuto: datos.routes[0].duration };
  } finally {
    clearTimeout(temporizador);
  }
}

function estimarEnLinea(puntos) {
  const distanciaMetros = largoPoligonal(puntos) * FACTOR_RODEO;
  return { distanciaMetros, segundos: distanciaMetros / VELOCIDAD_BUS_MS, metodo: 'estimacion_lineal' };
}

/**
 * @param {{lat:number,lng:number}[]} puntos origen, paradas intermedias..., destino
 * @param {object} [opciones] inyectables para pruebas
 * @returns {Promise<{distanciaMetros:number, segundos:number, metodo:'osrm'|'estimacion_lineal'}>}
 */
async function calcularRecorrido(puntos, opciones = {}) {
  if (!Array.isArray(puntos) || puntos.length < 2) {
    throw new Error('Se necesitan al menos dos puntos para calcular un recorrido');
  }
  const {
    fetchImpl = globalThis.fetch,
    baseUrl = config.routing.osrmUrl,
    timeoutMs = config.routing.timeoutMs,
    factorTiempoBus = config.routing.factorTiempoBus,
    segundosPorParada = config.routing.segundosPorParada,
  } = opciones;

  const paradasIntermedias = Math.max(0, puntos.length - 2);
  const tiempoDeParadas = paradasIntermedias * segundosPorParada;

  try {
    const { distanciaMetros, segundosAuto } = await pedirRutaOsrm(puntos, {
      fetchImpl,
      baseUrl,
      timeoutMs,
    });
    return {
      distanciaMetros: Math.round(distanciaMetros),
      // OSRM calcula tiempos de auto: se ajusta a bus y se suman las detenciones.
      segundos: Math.round(segundosAuto * factorTiempoBus + tiempoDeParadas),
      metodo: 'osrm',
    };
  } catch (err) {
    console.warn(`ETA: servicio de rutas no disponible (${err.message}); se usa estimación en línea.`);
    const estimado = estimarEnLinea(puntos);
    return {
      distanciaMetros: Math.round(estimado.distanciaMetros),
      segundos: Math.round(estimado.segundos + tiempoDeParadas),
      metodo: estimado.metodo,
    };
  }
}

module.exports = { calcularRecorrido, FACTOR_RODEO, VELOCIDAD_BUS_MS };
