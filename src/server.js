const app = require('./app');
const config = require('./config/env');
const { connectDB } = require('./config/database');

async function start() {
  try {
    await connectDB();
    console.log('Conexión a MongoDB Atlas establecida correctamente.');
  } catch (err) {
    console.error('No fue posible conectar a MongoDB:', err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`YourBus_Back escuchando en el puerto ${config.port} (${config.env})`);
    console.log(`CORS habilitado para: ${config.corsOrigins.join(', ')}`);
  });
}

start();
