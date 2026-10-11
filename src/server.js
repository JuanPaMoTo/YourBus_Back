const app = require('./app');
const config = require('./config/env');
const { connectDB } = require('./config/database');

// Azure App Service inyecta PORT (8080 en Linux). Esa variable manda siempre.
const PORT = process.env.PORT || config.port || 8080;

async function start() {
  try {
    await connectDB();
    console.log('Conexión a MongoDB Atlas establecida correctamente.');
  } catch (err) {
    console.error('No fue posible conectar a MongoDB:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`YourBus_Back escuchando en el puerto ${PORT} (${config.env})`);
    if (Array.isArray(config.corsOrigins)) {
      console.log(`CORS habilitado para: ${config.corsOrigins.join(', ')}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${PORT} ya está en uso. Revisa PORT/WEBSITES_PORT y el comando de inicio en Azure.`);
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

start();