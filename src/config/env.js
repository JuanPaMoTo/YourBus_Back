const crypto = require('crypto');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const esEntornoLocal = env === 'development' || env === 'test';

// El secreto con el que se firman los tokens de sesión (JWT).
// - En QA/PROD es obligatorio y debe ser largo: si falta, la app NO arranca
//   (mejor fallar con un mensaje claro que correr con sesiones falsificables).
// - Si el pipeline no encontró la variable, Azure deja el texto "$(JWT_SECRET)"
//   tal cual; eso también se rechaza.
// - En desarrollo/pruebas se genera uno aleatorio (las sesiones se pierden al
//   reiniciar, que es lo esperado en local).
function resolverJwtSecret() {
  const valor = process.env.JWT_SECRET;
  const valido = typeof valor === 'string' && valor.length >= 16 && !valor.includes('$(');
  if (valido) return valor;
  if (!esEntornoLocal) {
    throw new Error(
      'Falta JWT_SECRET (mínimo 16 caracteres). Agrégala a la variable group YourBus-Backend-Vars.'
    );
  }
  if (env === 'development') {
    console.warn('JWT_SECRET no definida: se usa un secreto aleatorio solo para esta ejecución.');
  }
  return crypto.randomBytes(32).toString('hex');
}

// Quita las "/" del final sin usar una expresión regular (evita retroceso costoso).
function sinBarrasFinales(texto) {
  let fin = texto.length;
  while (fin > 0 && texto[fin - 1] === '/') fin -= 1;
  return texto.slice(0, fin);
}

const config = {
  env,
  port: process.env.PORT || 4000,
  // Lista separada por comas de orígenes permitidos, uno por entorno.
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim()),
  // Cadena de conexión completa de MongoDB Atlas (una por entorno: DEV/QA/PROD
  // apuntan cada una a su propia base dentro del mismo cluster, o a clusters
  // distintos si prefieres aislarlos más).
  mongodbUri: process.env.MONGODB_URI,

  jwtSecret: resolverJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  // Administrador inicial: si ambas variables existen y no hay un usuario con
  // ese correo, se crea al arrancar. Así nadie tiene que tocar la base a mano.
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',

  // Si la base está vacía (sin rutas), carga los datos de ejemplo al arrancar.
  autoSeed: process.env.AUTO_SEED === 'true',

  // Zona horaria con la que se decide qué es "hoy" para los turnos.
  tzOperacion: process.env.TZ_OPERACION || 'America/Santiago',

  // Cálculo de ETA por calles (ver src/utils/routing.js).
  routing: {
    // Servidor OSRM. El demo público es solo para pruebas y demostraciones;
    // para uso real conviene apuntar a un OSRM propio u otro proveedor.
    osrmUrl: sinBarrasFinales(process.env.OSRM_URL || 'https://router.project-osrm.org'),
    timeoutMs: Number(process.env.ROUTING_TIMEOUT_MS) || 5000,
    // OSRM calcula tiempos para autos; un bus urbano es más lento.
    factorTiempoBus: Number(process.env.ETA_FACTOR_BUS) || 1.3,
    segundosPorParada: Number(process.env.ETA_SEGUNDOS_PARADA) || 20,
    cacheSegundos: Number(process.env.ETA_CACHE_SEGUNDOS) || 15,
  },
};

module.exports = config;
