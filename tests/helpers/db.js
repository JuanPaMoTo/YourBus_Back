const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Cada archivo de pruebas usa su propia base (así pueden correr en paralelo).
// Por defecto levanta un Mongo real en memoria. Si defines TEST_MONGODB_URI
// (por ejemplo un contenedor de servicio en CI) usa ese servidor en su lugar.
let mongoServer = null;

async function iniciarBase() {
  const dbName = `test_${crypto.randomBytes(6).toString('hex')}`;
  if (process.env.TEST_MONGODB_URI) {
    await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName });
    return;
  }
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName });
}

async function cerrarBase() {
  if (process.env.TEST_MONGODB_URI) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

module.exports = { iniciarBase, cerrarBase };
