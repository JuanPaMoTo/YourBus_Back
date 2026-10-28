const { Router } = require('express');
const { listar, crear, cambiarActivo } = require('../controllers/usuarios.controller');
const { requireAuth, requireRol } = require('../middleware/auth');

const router = Router();

router.use('/usuarios', requireAuth, requireRol('admin'));
router.get('/usuarios', listar);
router.post('/usuarios', crear);
router.patch('/usuarios/:id', cambiarActivo);

module.exports = router;
