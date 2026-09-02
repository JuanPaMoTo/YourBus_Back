const mongoose = require('mongoose');
const { Bus, Paradero } = require('../models');

async function ubicacionBus(req, res, next) {
  try {
    const { busId } = req.params;
    if (!mongoose.isValidObjectId(busId)) {
      return res.status(404).json({ error: 'Bus no encontrado o sin ubicación disponible' });
    }
    const bus = await Bus.findById(busId);
    if (!bus || bus.lat === null || bus.lng === null) {
      return res.status(404).json({ error: 'Bus no encontrado o sin ubicación disponible' });
    }
    res.json({ lat: bus.lat, lng: bus.lng, actualizado: bus.updatedAt });
  } catch (err) {
    next(err);
  }
}

async function etaParadero(req, res, next) {
  try {
    const { paraderoId } = req.params;
    if (!mongoose.isValidObjectId(paraderoId)) {
      return res.status(404).json({ error: 'No hay ETA disponible para este paradero' });
    }
    const paradero = await Paradero.findById(paraderoId);
    if (!paradero) {
      return res.status(404).json({ error: 'No hay ETA disponible para este paradero' });
    }
    // Placeholder determinístico mientras no hay telemetría GPS real: en
    // producción esto se calcularía a partir de la posición en vivo del
    // bus asignado a la ruta (distancia / velocidad promedio).
    const minutos = paradero.orden * 3 + 2;
    res.json({ minutos });
  } catch (err) {
    next(err);
  }
}

async function registrarBus(req, res, next) {
  try {
    const { placa, empresa } = req.body;
    if (!placa || !empresa) {
      return res.status(400).json({ error: 'placa y empresa son obligatorios' });
    }
    const existente = await Bus.findOne({ placa: placa.toUpperCase() });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un bus con esa placa' });
    }
    const bus = await Bus.create({ placa: placa.toUpperCase(), empresa });
    res.status(201).json(bus);
  } catch (err) {
    next(err);
  }
}

module.exports = { ubicacionBus, etaParadero, registrarBus };
