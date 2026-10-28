const config = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // JSON mal formado en el cuerpo de la petición
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error('Error interno:', err);
    // En producción no se filtran detalles internos al cliente.
    const mensaje = config.env === 'production' ? 'Error interno del servidor' : err.message;
    return res.status(status).json({ error: mensaje || 'Error interno del servidor' });
  }
  return res.status(status).json({ error: err.message });
}

module.exports = { notFound, errorHandler };
