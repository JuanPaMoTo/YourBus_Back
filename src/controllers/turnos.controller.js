const mongoose = require('mongoose');
const { Turno, Usuario, Ruta, Bus } = require('../models');
const { crearError, asyncHandler } = require('../utils/errores');
const { fechaValida, horaValida, aMinutos, seSolapan } = require('../utils/fechas');
const { serializarTurno } = require('../utils/serializadores');

const POPULATE = [
  { path: 'conductorId', select: 'nombre' },
  { path: 'rutaId', select: 'codigo nombre' },
  { path: 'busId', select: 'placa empresa' },
];

const buscarTurnos = (filtro) =>
  Turno.find(filtro).sort({ fecha: 1, horaInicio: 1 }).populate(POPULATE).lean();

function validarFiltroFechas({ desde, hasta }) {
  const rango = {};
  if (desde !== undefined) {
    if (!fechaValida(desde)) throw crearError(400, '"desde" debe tener formato AAAA-MM-DD');
    rango.$gte = String(desde);
  }
  if (hasta !== undefined) {
    if (!fechaValida(hasta)) throw crearError(400, '"hasta" debe tener formato AAAA-MM-DD');
    rango.$lte = String(hasta);
  }
  return Object.keys(rango).length ? { fecha: rango } : {};
}

// Administrador: todos los turnos, con filtros opcionales.
const listar = asyncHandler(async (req, res) => {
  const filtro = validarFiltroFechas(req.query);
  for (const campo of ['conductorId', 'rutaId', 'busId']) {
    if (req.query[campo]) {
      if (!mongoose.isValidObjectId(req.query[campo])) throw crearError(400, `${campo} no es válido`);
      filtro[campo] = String(req.query[campo]);
    }
  }
  if (req.query.estado) {
    if (!Turno.ESTADOS.includes(req.query.estado)) throw crearError(400, 'Estado no válido');
    filtro.estado = String(req.query.estado);
  }
  const turnos = await buscarTurnos(filtro);
  res.json(turnos.map((t) => serializarTurno(t)));
});

// Conductor: solo SUS turnos (calendario).
const mios = asyncHandler(async (req, res) => {
  const filtro = { conductorId: req.usuario._id, ...validarFiltroFechas(req.query) };
  const turnos = await buscarTurnos(filtro);
  res.json(turnos.map((t) => serializarTurno(t)));
});

async function validarDatosTurno(datos) {
  const { conductorId, rutaId, busId, fecha, horaInicio, horaFin } = datos;
  if (![conductorId, rutaId, busId].every((id) => mongoose.isValidObjectId(id))) {
    throw crearError(400, 'conductorId, rutaId y busId son obligatorios y deben ser válidos');
  }
  if (!fechaValida(fecha)) throw crearError(400, 'La fecha debe tener formato AAAA-MM-DD');
  if (!horaValida(horaInicio) || !horaValida(horaFin)) {
    throw crearError(400, 'Las horas deben tener formato HH:MM');
  }
  if (aMinutos(horaFin) <= aMinutos(horaInicio)) {
    throw crearError(400, 'La hora de fin debe ser posterior a la de inicio (mismo día)');
  }

  const [conductor, ruta, bus] = await Promise.all([
    Usuario.findById(conductorId),
    Ruta.findById(rutaId),
    Bus.findById(busId),
  ]);
  if (!conductor || conductor.rol !== 'conductor' || !conductor.activo) {
    throw crearError(400, 'El conductor no existe, está desactivado o no tiene rol conductor');
  }
  if (!ruta) throw crearError(400, 'La ruta no existe');
  if (!bus) throw crearError(400, 'El bus no existe');
}

// Un conductor o un bus no pueden estar en dos turnos que se solapan el mismo día.
async function validarSolapes(datos, idExcluido = null) {
  const mismosDia = await Turno.find({
    fecha: datos.fecha,
    estado: { $ne: 'cancelado' },
    $or: [{ conductorId: datos.conductorId }, { busId: datos.busId }],
    ...(idExcluido ? { _id: { $ne: idExcluido } } : {}),
  }).lean();

  for (const otro of mismosDia) {
    if (!seSolapan(datos.horaInicio, datos.horaFin, otro.horaInicio, otro.horaFin)) continue;
    const quien = String(otro.conductorId) === String(datos.conductorId) ? 'El conductor' : 'El bus';
    throw crearError(
      409,
      `${quien} ya tiene un turno que se cruza (${otro.horaInicio}–${otro.horaFin}) ese día`
    );
  }
}

const CAMPOS = ['conductorId', 'rutaId', 'busId', 'fecha', 'horaInicio', 'horaFin'];
const soloCampos = (cuerpo) => Object.fromEntries(CAMPOS.map((c) => [c, cuerpo[c]]));

async function cargarTurno(id) {
  if (!mongoose.isValidObjectId(id)) throw crearError(404, 'Turno no encontrado');
  const turno = await Turno.findById(id);
  if (!turno) throw crearError(404, 'Turno no encontrado');
  return turno;
}

const devolverTurno = async (id, res, status = 200) => {
  const [turno] = await buscarTurnos({ _id: id });
  res.status(status).json(serializarTurno(turno));
};

const crear = asyncHandler(async (req, res) => {
  const datos = soloCampos(req.body);
  await validarDatosTurno(datos);
  await validarSolapes(datos);
  const turno = await Turno.create(datos);
  await devolverTurno(turno._id, res, 201);
});

const actualizar = asyncHandler(async (req, res) => {
  const turno = await cargarTurno(req.params.id);
  if (turno.estado !== 'programado') {
    throw crearError(409, 'Solo se pueden editar turnos programados');
  }
  const datos = soloCampos({ ...turno.toObject(), ...req.body });
  await validarDatosTurno(datos);
  await validarSolapes(datos, turno._id);
  turno.set(datos);
  await turno.save();
  await devolverTurno(turno._id, res);
});

const cancelar = asyncHandler(async (req, res) => {
  const turno = await cargarTurno(req.params.id);
  if (turno.estado !== 'programado') {
    throw crearError(409, 'Solo se pueden cancelar turnos programados');
  }
  turno.estado = 'cancelado';
  await turno.save();
  await devolverTurno(turno._id, res);
});

const eliminar = asyncHandler(async (req, res) => {
  const turno = await cargarTurno(req.params.id);
  if (turno.estado === 'en_curso') {
    throw crearError(409, 'No se puede eliminar un turno en curso');
  }
  await turno.deleteOne();
  res.status(204).end();
});

module.exports = { listar, mios, crear, actualizar, cancelar, eliminar, cargarTurno, POPULATE };
