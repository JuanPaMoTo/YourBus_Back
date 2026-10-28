const cors = require('cors');
const config = require('../config/env');

// CORS_ORIGIN acepta una lista separada por comas, o "*" para permitir
// cualquier origen (útil en QA; en PROD conviene listar el dominio del front).
const permiteTodos = config.corsOrigins.includes('*');

const corsOptions = {
  origin(origin, callback) {
    // Permite herramientas sin origin (curl, Postman), "*" y los orígenes configurados
    if (!origin || permiteTodos || config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    const error = new Error(`Origen no permitido por CORS: ${origin}`);
    error.status = 403;
    return callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: false,
};

module.exports = cors(corsOptions);
