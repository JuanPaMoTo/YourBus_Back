const { Usuario } = require('../models');
const { verificarToken } = require('../utils/jwt');
const { asyncHandler } = require('../utils/errores');

// Exige "Authorization: Bearer <token>" válido y un usuario existente y activo.
// Deja el usuario en req.usuario. Se vuelve a leer de la base en cada petición
// para que desactivar una cuenta surta efecto de inmediato.
const requireAuth = asyncHandler(async (req, res, next) => {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }

  let payload;
  try {
    payload = verificarToken(token);
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  const usuario = await Usuario.findById(payload.sub);
  if (!usuario || !usuario.activo) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  req.usuario = usuario;
  return next();
});

// Debe usarse después de requireAuth.
const requireRol =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    return next();
  };

module.exports = { requireAuth, requireRol };
