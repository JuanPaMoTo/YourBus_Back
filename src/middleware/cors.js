const cors = require('cors');
const config = require('../config/env');

const corsOptions = {
  origin(origin, callback) {
    // Permite herramientas sin origin (curl, Postman) y los orígenes configurados
    if (!origin || config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: false,
};

module.exports = cors(corsOptions);
