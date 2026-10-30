const app = require('./app');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const { inicializarDatos } = require('./bootstrap');

// Azure App Service inyecta PORT (8080 en Linux). Esa variable manda siempre.
const PORT = Number(process.env.PORT || config.port || 8080);
const HOST = '0.0.0.0';

async function start() {
  try {
    await connectDB();
    console.log('Conexión a MongoDB Atlas establecida correctamente.');
    await inicializarDatos();
  } catch (err) {
    console.error('No fue posible conectar a MongoDB:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`YourBus_Back escuchando en el puerto ${PORT} (${config.env})`);
    console.log(`CORS habilitado para: ${config.corsOrigins.join(', ')}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${PORT} ya está en uso. Revisa PORT/WEBSITES_PORT en Azure.`);
    } else {
      console.error('Error del servidor:', err);
    }
    process.exit(1);
  });

  // Cierre ordenado cuando Azure reinicia o detiene el contenedor
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Error inesperado al iniciar:', err);
  process.exit(1);
});
