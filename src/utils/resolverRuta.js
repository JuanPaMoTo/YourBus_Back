const mongoose = require('mongoose');
const { Ruta } = require('../models');

// El frontend puede enviar el ObjectId real de Mongo o el código corto de la
// ruta (ej. "L4"). Si el parámetro es un ObjectId válido se busca por _id,
// si no, se asume que es el código.
async function resolverRuta(rutaParam) {
  const where = mongoose.isValidObjectId(rutaParam)
    ? { _id: rutaParam }
    : { codigo: rutaParam };
  return Ruta.findOne(where);
}

module.exports = { resolverRuta };
