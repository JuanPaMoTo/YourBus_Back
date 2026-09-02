// Punto de entrada para Vercel (funciones serverless). Vercel detecta
// automáticamente cualquier archivo dentro de /api y lo expone como
// función. Reutilizamos la app de Express ya configurada (routes, CORS,
// middlewares), pero sin app.listen(): en su lugar, nos aseguramos de que
// la conexión a MongoDB esté lista antes de procesar cada request.
const app = require('../src/app');
const { connectDB } = require('../src/config/database');

let connectionPromise = null;

module.exports = async (req, res) => {
  if (!connectionPromise) {
    connectionPromise = connectDB();
  }
  try {
    await connectionPromise;
  } catch (err) {
    connectionPromise = null; // permite reintentar en la próxima invocación
    res.status(500).json({ error: 'No fue posible conectar a la base de datos' });
    return;
  }
  app(req, res);
};
