require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  port: process.env.PORT || 4000,
  // Lista separada por comas de orígenes permitidos, uno por entorno
  // (Vercel de DEV, QA y PROD, o localhost mientras desarrollas el front).
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim()),
};

module.exports = config;
