const { Router } = require('express');
const { listarRutas, estadoRuta } = require('../controllers/rutas.controller');
const { listarParaderos, listarHorarios } = require('../controllers/paraderos.controller');
const { busesActivos } = require('../controllers/recorrido.controller');
const incidentesRoutes = require('./incidentes.routes');

const router = Router();

router.get('/rutas', listarRutas);
router.get('/rutas/:rutaId/estado', estadoRuta);
router.get('/rutas/:rutaId/paraderos', listarParaderos);
router.get('/rutas/:rutaId/horarios', listarHorarios);
router.get('/rutas/:rutaId/buses-activos', busesActivos);

// Los incidentes están asociados a las rutas: se montan junto a ellas.
router.use(incidentesRoutes);

module.exports = router;
