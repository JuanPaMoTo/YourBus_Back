const app = require('./app');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const { diagnosticarPuerto, liberarSiEsNginx } = require('./utils/diagnosticoPuerto');

// Azure App Service inyecta PORT (8080 en Linux). Esa variable manda siempre.
const PORT = Number(process.env.PORT || config.port || 8080);
const HOST = '0.0.0.0';
const MAX_INTENTOS = 5;
const ESPERA_MS = 3000;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escuchar() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, HOST, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
    server.once('error', reject);
  });
}

// Intenta abrir el puerto. Si está ocupado, imprime QUIÉN lo ocupa (visible en
// el Log stream de Azure, sin necesidad de SSH), libera un nginx ajeno si es
// el culpable y reintenta unas veces antes de rendirse.
async function levantarServidor() {
  for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
    try {
      return await escuchar();
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
      console.error(`[intento ${intento}/${MAX_INTENTOS}] El puerto ${PORT} ya está en uso.`);
      if (intento === 1 || intento === MAX_INTENTOS) {
        const { propietarios } = diagnosticarPuerto(PORT);
        if (liberarSiEsNginx(propietarios) > 0) {
          await esperar(1000);
          continue;
        }
      }
      if (intento === MAX_INTENTOS) throw err;
      await esperar(ESPERA_MS);
    }
  }
  return null;
}

async function start() {
  try {
    await connectDB();
    console.log('Conexión a MongoDB Atlas establecida correctamente.');
  } catch (err) {
    console.error('No fue posible conectar a MongoDB:', err.message);
    process.exit(1);
  }

  const server = await levantarServidor();

  console.log(`YourBus_Back escuchando en el puerto ${PORT} (${config.env})`);
  if (Array.isArray(config.corsOrigins)) {
    console.log(`CORS habilitado para: ${config.corsOrigins.join(', ')}`);
  }

  server.on('error', (err) => {
    console.error('Error del servidor:', err);
    process.exit(1);
  });

  // Cierre ordenado cuando Azure reinicia o detiene el contenedor
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('No fue posible iniciar el servidor:', err.message);
  process.exit(1);
});