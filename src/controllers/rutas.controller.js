const mongoose = require('mongoose');
const { Ruta } = require('../models');

async function listarRutas(req, res, next) {
  try {
    const rutas = await Ruta.find().sort({ codigo: 1 });
    res.json(rutas);
  } catch (err) {
    next(err);
  }
}

async function estadoRuta(req, res, next) {
  try {
    const { rutaId } = req.params;
    const where = mongoose.isValidObjectId(rutaId) ? { _id: rutaId } : { codigo: rutaId };
    const ruta = await Ruta.findOne(where);
    if (!ruta) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    res.json({
      ruta: ruta.codigo,
      estado: ruta.estado,
      ultimaActualizacion: ruta.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listarRutas, estadoRuta };
