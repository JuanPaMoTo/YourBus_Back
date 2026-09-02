const { rutas } = require('../data/store');

function listarRutas(req, res) {
  res.json(rutas);
}

function estadoRuta(req, res) {
  const { rutaId } = req.params;
  const ruta = rutas.find((r) => r.id === rutaId || r.codigo === rutaId);
  if (!ruta) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  res.json({ ruta: ruta.codigo, estado: 'operativa', ultimaActualizacion: new Date().toISOString() });
}

module.exports = { listarRutas, estadoRuta };
