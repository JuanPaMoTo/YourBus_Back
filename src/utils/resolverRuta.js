const mongoose = require('mongoose');
const { Ruta } = require('../models');

// El frontend puede enviar el ObjectId real de Mongo o el código corto de la
// ruta (ej. "L4"). Si el parámetro es un ObjectId válido se busca por _id,
// si no, se asume que es el código.
async function resolverRuta(rutaParam) {
  // String(): el valor se trata siempre como texto, nunca como un operador de Mongo.
  const valor = String(rutaParam);
  const where = mongoose.isValidObjectId(valor) ? { _id: valor } : { codigo: valor };
  return Ruta.findOne(where);
}

module.exports = { resolverRuta };
