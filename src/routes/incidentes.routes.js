const { Router } = require('express');
const {
  reportar,
  listarActivos,
  incidentesDeRuta,
  listar,
  cambiarEstado,
} = require('../controllers/incidentes.controller');
const { requireAuth, requireRol } = require('../middleware/auth');

const router = Router();

// Públicos: los pasajeros consultan los avisos sin iniciar sesión.
router.get('/incidentes/activos', listarActivos);
router.get('/rutas/:rutaId/incidentes', incidentesDeRuta);

// Conductor y administrador reportan; el panel y los cambios de estado son del administrador.
router.post('/incidentes', requireAuth, requireRol('conductor', 'admin'), reportar);
router.get('/incidentes', requireAuth, requireRol('admin'), listar);
router.patch('/incidentes/:id/estado', requireAuth, requireRol('admin'), cambiarEstado);

module.exports = router;
