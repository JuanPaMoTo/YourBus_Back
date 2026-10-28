// Debe ir primero: configura cómo se serializan los documentos a JSON.
require('../config/mongoose');

const Ruta = require('./Ruta');
const Paradero = require('./Paradero');
const Horario = require('./Horario');
const Bus = require('./Bus');
const Usuario = require('./Usuario');
const Turno = require('./Turno');

module.exports = { Ruta, Paradero, Horario, Bus, Usuario, Turno };
