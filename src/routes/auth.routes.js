const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { registro, login, yo } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Freno a la fuerza bruta: 30 intentos cada 15 minutos por IP (desactivado en pruebas).
const limitarIntentos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

router.post('/auth/registro', limitarIntentos, registro);
router.post('/auth/login', limitarIntentos, login);
router.get('/auth/me', requireAuth, yo);

module.exports = router;
