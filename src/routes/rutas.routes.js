const { Router } = require('express');
const { listarRutas, estadoRuta } = require('../controllers/rutas.controller');
const { listarParaderos, listarHorarios } = require('../controllers/paraderos.controller');
const { busesActivos } = require('../controllers/recorrido.controller');

const router = Router();

router.get('/rutas', listarRutas);
router.get('/rutas/:rutaId/estado', estadoRuta);
router.get('/rutas/:rutaId/paraderos', listarParaderos);
router.get('/rutas/:rutaId/horarios', listarHorarios);
router.get('/rutas/:rutaId/buses-activos', busesActivos);

module.exports = router;
