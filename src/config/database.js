const mongoose = require('mongoose');
const config = require('./env');

async function connectDB() {
  if (!config.mongodbUri) {
    throw new Error('Falta la variable de entorno MONGODB_URI');
  }
  await mongoose.connect(config.mongodbUri);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, mongoose };
