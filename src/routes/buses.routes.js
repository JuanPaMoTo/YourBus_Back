const { Router } = require('express');
const { ubicacionBus, listarBuses, registrarBus } = require('../controllers/buses.controller');
const { etaParadero } = require('../controllers/recorrido.controller');
const { requireAuth, requireRol } = require('../middleware/auth');

const router = Router();

router.get('/buses/:busId/ubicacion', ubicacionBus);
router.get('/paraderos/:paraderoId/eta', etaParadero);

// La flota la administra solo el administrador de la terminal.
router.get('/buses', requireAuth, requireRol('admin'), listarBuses);
router.post('/buses', requireAuth, requireRol('admin'), registrarBus);

module.exports = router;
