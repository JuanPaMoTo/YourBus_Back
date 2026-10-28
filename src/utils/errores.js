// Error con código HTTP: el errorHandler lo convierte en { error: mensaje }.
class HttpError extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

const crearError = (status, mensaje) => new HttpError(status, mensaje);

// Evita repetir try/catch en cada controlador async.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { HttpError, crearError, asyncHandler };
