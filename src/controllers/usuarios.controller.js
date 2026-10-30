const mongoose = require('mongoose');
const { Usuario } = require('../models');
const { crearUsuario } = require('./auth.controller');
const { crearError, asyncHandler } = require('../utils/errores');

const listar = asyncHandler(async (req, res) => {
  const filtro = {};
  if (req.query.rol) {
    if (!Usuario.ROLES.includes(req.query.rol)) throw crearError(400, 'Rol no válido');
    filtro.rol = String(req.query.rol);
  }
  const usuarios = await Usuario.find(filtro).sort({ nombre: 1 });
  res.json(usuarios);
});

// El administrador crea conductores (y otros administradores).
const crear = asyncHandler(async (req, res) => {
  if (!Usuario.ROLES.includes(req.body.rol)) {
    throw crearError(400, `El rol debe ser uno de: ${Usuario.ROLES.join(', ')}`);
  }
  const usuario = await crearUsuario(req.body);
  res.status(201).json(usuario);
});

const cambiarActivo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw crearError(404, 'Usuario no encontrado');
  if (typeof req.body.activo !== 'boolean') throw crearError(400, '"activo" debe ser true o false');
  if (String(req.usuario._id) === id && req.body.activo === false) {
    throw crearError(409, 'No puedes desactivar tu propia cuenta');
  }
  const usuario = await Usuario.findById(id);
  if (!usuario) throw crearError(404, 'Usuario no encontrado');
  usuario.activo = req.body.activo;
  await usuario.save();
  res.json(usuario);
});

module.exports = { listar, crear, cambiarActivo };
