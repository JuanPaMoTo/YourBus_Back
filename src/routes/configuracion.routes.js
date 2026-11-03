const { Router } = require('express');
const {
  agregarParadero,
  editarParadero,
  eliminarParadero,
  agregarHorario,
  editarHorario,
  eliminarHorario,
} = require('../controllers/configuracion.controller');
const { requireAuth, requireRol } = require('../middleware/auth');

const router = Router();

// Configurar paraderos y horarios es tarea del administrador (operador) de la terminal.
// La consulta pública sigue en rutas.routes.js (GET).
const soloAdmin = [requireAuth, requireRol('admin')];

router.post('/rutas/:rutaId/paraderos', ...soloAdmin, agregarParadero);
router.put('/paraderos/:id', ...soloAdmin, editarParadero);
router.delete('/paraderos/:id', ...soloAdmin, eliminarParadero);

router.post('/rutas/:rutaId/horarios', ...soloAdmin, agregarHorario);
router.put('/horarios/:id', ...soloAdmin, editarHorario);
router.delete('/horarios/:id', ...soloAdmin, eliminarHorario);

module.exports = router;
