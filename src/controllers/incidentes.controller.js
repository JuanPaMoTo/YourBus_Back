const mongoose = require('mongoose');
const { Incidente, Turno, Ruta } = require('../models');
const { crearError, asyncHandler } = require('../utils/errores');
const { resolverRuta } = require('../utils/resolverRuta');
const { serializarIncidente } = require('../utils/serializadores');

const POPULATE = [
  { path: 'rutaId', select: 'codigo nombre' },
  { path: 'reportadoPor', select: 'nombre' },
];

const MAX_DESCRIPCION = 280;

const buscar = (filtro) => Incidente.find(filtro).sort({ createdAt: -1 }).populate(POPULATE).lean();

// Conductor o administrador: registra un incidente. Si el conductor no indica la
// ruta se usa la de su recorrido en curso.
const reportar = asyncHandler(async (req, res) => {
  const { tipo, descripcion, rutaId } = req.body || {};

  if (!Incidente.TIPOS.includes(tipo)) {
    throw crearError(400, `El tipo debe ser uno de: ${Incidente.TIPOS.join(', ')}`);
  }
  const texto = typeof descripcion === 'string' ? descripcion.trim() : '';
  if (!texto) throw crearError(400, 'La descripción es obligatoria');
  if (texto.length > MAX_DESCRIPCION) {
    throw crearError(400, `La descripción no puede superar los ${MAX_DESCRIPCION} caracteres`);
  }

  let ruta = null;
  let turno = null;
  if (rutaId !== undefined && rutaId !== null && rutaId !== '') {
    ruta = await resolverRuta(rutaId);
    if (!ruta) throw crearError(400, 'La ruta no existe');
    turno = await Turno.findOne({
      conductorId: req.usuario._id,
      estado: 'en_curso',
      rutaId: ruta._id,
    });
  } else {
    turno = await Turno.findOne({ conductorId: req.usuario._id, estado: 'en_curso' });
    if (!turno) throw crearError(400, 'Indica la ruta afectada o inicia un recorrido');
    ruta = await Ruta.findById(turno.rutaId);
    if (!ruta) throw crearError(400, 'La ruta no existe');
  }

  const incidente = await Incidente.create({
    rutaId: ruta._id,
    tipo,
    descripcion: texto,
    reportadoPor: req.usuario._id,
    turnoId: turno ? turno._id : null,
  });
  const [creado] = await buscar({ _id: incidente._id });
  res.status(201).json(serializarIncidente(creado, { interno: true }));
});

// Público: incidentes activos de toda la red (página de alertas del pasajero).
const listarActivos = asyncHandler(async (req, res) => {
  const incidentes = await buscar({ estado: 'activo' });
  res.json(incidentes.map((i) => serializarIncidente(i)));
});

// Público: avisos activos de una ruta (por id o por código).
const incidentesDeRuta = asyncHandler(async (req, res) => {
  const ruta = await resolverRuta(req.params.rutaId);
  if (!ruta) throw crearError(404, 'Ruta no encontrada');
  const incidentes = await buscar({ rutaId: ruta._id, estado: 'activo' });
  res.json(incidentes.map((i) => serializarIncidente(i)));
});

// Administrador: panel de incidentes. ?estado=activo|finalizado (sin filtro = todos).
const listar = asyncHandler(async (req, res) => {
  const filtro = {};
  if (req.query.estado !== undefined) {
    if (!Incidente.ESTADOS.includes(req.query.estado)) throw crearError(400, 'Estado no válido');
    filtro.estado = String(req.query.estado);
  }
  const incidentes = await buscar(filtro);
  res.json(incidentes.map((i) => serializarIncidente(i, { interno: true })));
});

// Administrador: marca un incidente como activo o finalizado.
const cambiarEstado = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};
  if (!mongoose.isValidObjectId(id)) throw crearError(404, 'Incidente no encontrado');
  if (!Incidente.ESTADOS.includes(estado)) {
    throw crearError(400, `El estado debe ser uno de: ${Incidente.ESTADOS.join(', ')}`);
  }
  const incidente = await Incidente.findById(id);
  if (!incidente) throw crearError(404, 'Incidente no encontrado');

  incidente.estado = estado;
  incidente.finalizadoEn = estado === 'finalizado' ? new Date() : null;
  await incidente.save();

  const [actualizado] = await buscar({ _id: incidente._id });
  res.json(serializarIncidente(actualizado, { interno: true }));
});

module.exports = { reportar, listarActivos, incidentesDeRuta, listar, cambiarEstado };
