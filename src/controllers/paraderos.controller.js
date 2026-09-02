const { Paradero, Horario } = require('../models');
const { resolverRuta } = require('../utils/resolverRuta');

async function listarParaderos(req, res, next) {
  try {
    const ruta = await resolverRuta(req.params.rutaId);
    if (!ruta) {
      return res.status(404).json({ error: 'No hay paraderos para esta ruta' });
    }
    const paraderos = await Paradero.find({ rutaId: ruta._id }).sort({ orden: 1 });
    res.json(paraderos);
  } catch (err) {
    next(err);
  }
}

async function listarHorarios(req, res, next) {
  try {
    const ruta = await resolverRuta(req.params.rutaId);
    if (!ruta) {
      return res.status(404).json({ error: 'No hay horarios para esta ruta' });
    }
    const horarios = await Horario.find({ rutaId: ruta._id });
    res.json(horarios);
  } catch (err) {
    next(err);
  }
}

module.exports = { listarParaderos, listarHorarios };
