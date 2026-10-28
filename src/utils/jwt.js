const jwt = require('jsonwebtoken');
const config = require('../config/env');

function firmarToken(usuario) {
  return jwt.sign({ rol: usuario.rol }, config.jwtSecret, {
    subject: String(usuario._id),
    expiresIn: config.jwtExpiresIn,
  });
}

// Devuelve el payload o lanza si el token es inválido/expiró.
function verificarToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { firmarToken, verificarToken };
