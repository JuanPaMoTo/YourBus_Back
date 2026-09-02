const { Router } = require('express');
const {
  ubicacionBus,
  etaParadero,
  registrarBus,
} = require('../controllers/buses.controller');

const router = Router();

router.get('/buses/:busId/ubicacion', ubicacionBus);
router.get('/paraderos/:paraderoId/eta', etaParadero);
router.post('/buses', registrarBus);

module.exports = router;
