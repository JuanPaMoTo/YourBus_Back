const { Router } = require('express');
const turnos = require('../controllers/turnos.controller');
const recorrido = require('../controllers/recorrido.controller');
const { requireAuth, requireRol } = require('../middleware/auth');

const router = Router();
const admin = [requireAuth, requireRol('admin')];
const conductor = [requireAuth, requireRol('conductor')];

// Público: ETA de un bus en curso hacia un paradero.
router.get('/turnos/:id/eta', recorrido.eta);

// Conductor
router.get('/turnos/mios', ...conductor, turnos.mios);
router.post('/turnos/:id/iniciar', ...conductor, recorrido.iniciar);
router.post('/turnos/:id/ubicacion', ...conductor, recorrido.ubicacion);
router.post('/turnos/:id/finalizar', ...conductor, recorrido.finalizar);

// Administrador de la terminal
router.get('/turnos', ...admin, turnos.listar);
router.post('/turnos', ...admin, turnos.crear);
router.put('/turnos/:id', ...admin, turnos.actualizar);
router.post('/turnos/:id/cancelar', ...admin, turnos.cancelar);
router.delete('/turnos/:id', ...admin, turnos.eliminar);

module.exports = router;
