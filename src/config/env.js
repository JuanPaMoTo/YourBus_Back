require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

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
};

module.exports = config;
