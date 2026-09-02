const { buses, etaPorParadero } = require('../data/store');

function ubicacionBus(req, res) {
  const bus = buses.get(req.params.busId);
  if (!bus) {
    return res.status(404).json({ error: 'Bus no encontrado o sin ubicación disponible' });
  }
  res.json({ lat: bus.lat, lng: bus.lng, actualizado: new Date().toISOString() });
}

function etaParadero(req, res) {
  const minutos = etaPorParadero[req.params.paraderoId];
  if (minutos === undefined) {
    return res.status(404).json({ error: 'No hay ETA disponible para este paradero' });
  }
  res.json({ minutos });
}

function registrarBus(req, res) {
  const { placa, empresa } = req.body;
  if (!placa || !empresa) {
    return res.status(400).json({ error: 'placa y empresa son obligatorios' });
  }
  const id = placa.toUpperCase();
  if (buses.has(id)) {
    return res.status(409).json({ error: 'Ya existe un bus con esa placa' });
  }
  const nuevoBus = { id, placa, empresa, lat: null, lng: null };
  buses.set(id, nuevoBus);
  res.status(201).json(nuevoBus);
}

module.exports = { ubicacionBus, etaParadero, registrarBus };
