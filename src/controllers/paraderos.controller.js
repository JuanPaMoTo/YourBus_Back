const { paraderosPorRuta, horariosPorRuta, rutas } = require('../data/store');

function resolverIdRuta(rutaParam) {
  const ruta = rutas.find((r) => r.id === rutaParam || r.codigo === rutaParam);
  return ruta ? ruta.id : rutaParam;
}

function listarParaderos(req, res) {
  const id = resolverIdRuta(req.params.rutaId);
  const paraderos = paraderosPorRuta[id];
  if (!paraderos) {
    return res.status(404).json({ error: 'No hay paraderos para esta ruta' });
  }
  res.json(paraderos);
}

function listarHorarios(req, res) {
  const id = resolverIdRuta(req.params.rutaId);
  const horarios = horariosPorRuta[id];
  if (!horarios) {
    return res.status(404).json({ error: 'No hay horarios para esta ruta' });
  }
  res.json(horarios);
}

module.exports = { listarParaderos, listarHorarios };
