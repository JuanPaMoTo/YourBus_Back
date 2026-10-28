const bcrypt = require('bcryptjs');
const { Usuario } = require('../models');
const { firmarToken } = require('../utils/jwt');
const { crearError, asyncHandler } = require('../utils/errores');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcrypt solo considera los primeros 72 bytes de la contraseña.
const MAX_BYTES_PASSWORD = 72;
const RONDAS = process.env.NODE_ENV === 'test' ? 4 : 10;

// Hash de relleno: se compara contra él cuando el correo no existe, para que
// el login tarde lo mismo y no revele qué correos están registrados.
const HASH_RELLENO = bcrypt.hashSync('relleno-contra-enumeracion', RONDAS);

function validarDatosUsuario({ nombre, email, password }) {
  if (typeof nombre !== 'string' || nombre.trim().length < 2) {
    throw crearError(400, 'El nombre debe tener al menos 2 caracteres');
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw crearError(400, 'El correo no es válido');
  }
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    Buffer.byteLength(password) > MAX_BYTES_PASSWORD
  ) {
    throw crearError(400, 'La contraseña debe tener entre 8 y 72 caracteres');
  }
}

// Valida y crea un usuario con la contraseña ya protegida. Lo reutilizan el
// registro público, el panel del administrador y el arranque (admin inicial),
// así la misma política de contraseñas vale en los tres.
async function crearUsuario({ nombre, email, password, rol }) {
  validarDatosUsuario({ nombre, email, password });
  const passwordHash = await bcrypt.hash(password, RONDAS);
  try {
    return await Usuario.create({
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      rol,
    });
  } catch (err) {
    if (err.code === 11000) throw crearError(409, 'Ya existe una cuenta con ese correo');
    throw err;
  }
}

// Registro PÚBLICO: siempre crea un pasajero. El rol del cuerpo se ignora a
// propósito; conductores y administradores los crea un administrador.
const registro = asyncHandler(async (req, res) => {
  const usuario = await crearUsuario({ ...req.body, rol: 'pasajero' });
  res.status(201).json({ token: firmarToken(usuario), usuario });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw crearError(400, 'Correo y contraseña son obligatorios');
  }

  const usuario = await Usuario.findOne({ email: email.trim().toLowerCase() }).select(
    '+passwordHash'
  );
  const coincide = await bcrypt.compare(password, usuario ? usuario.passwordHash : HASH_RELLENO);
  if (!usuario || !coincide) throw crearError(401, 'Correo o contraseña incorrectos');
  if (!usuario.activo) throw crearError(403, 'Tu cuenta está desactivada');

  usuario.ultimoLogin = new Date();
  await usuario.save();
  res.json({ token: firmarToken(usuario), usuario });
});

const yo = (req, res) => {
  res.json({ usuario: req.usuario });
};

module.exports = { registro, login, yo, crearUsuario };
