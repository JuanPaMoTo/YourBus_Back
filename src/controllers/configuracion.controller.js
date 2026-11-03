const mongoose = require('mongoose');
const { Paradero, Horario } = require('../models');
const { crearError, asyncHandler } = require('../utils/errores');
const { resolverRuta } = require('../utils/resolverRuta');

const MAX_NOMBRE = 80;
const MAX_JORNADA = 40;
const MAX_HORA = 80;

const texto = (valor) => (typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '');
const hayValor = (valor) => valor !== undefined && valor !== null && valor !== '';

// ---------- Paraderos (HU12) ----------

// lat y lng van juntas (o ninguna): sin ambas no se puede calcular el ETA de ese paradero.
function validarCoordenadas(lat, lng) {
  if (!hayValor(lat) && !hayValor(lng)) return { lat: null, lng: null };
  if (!hayValor(lat) || !hayValor(lng)) {
    throw crearError(400, 'Indica la latitud y la longitud juntas');
  }
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw crearError(400, 'La latitud debe ser un número entre -90 y 90');
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw crearError(400, 'La longitud debe ser un número entre -180 y 180');
  }
  return { lat, lng };
}

function validarOrden(orden) {
  if (!Number.isInteger(orden) || orden < 1) {
    throw crearError(400, 'El orden debe ser un número entero desde 1');
  }
  return orden;
}

function validarNombre(nombre) {
  const limpio = texto(nombre);
  if (!limpio) throw crearError(400, 'El nombre del paradero es obligatorio');
  if (limpio.length > MAX_NOMBRE) {
    throw crearError(400, `El nombre no puede superar los ${MAX_NOMBRE} caracteres`);
  }
  return limpio;
}

// Deja el orden de la ruta como 1..n siguiendo la lista recibida.
async function guardarOrden(lista) {
  if (lista.length === 0) return;
  await Paradero.bulkWrite(
    lista.map((p, i) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { orden: i + 1 } } } }))
  );
}

const buscarParadero = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw crearError(404, 'Paradero no encontrado');
  const paradero = await Paradero.findById(id);
  if (!paradero) throw crearError(404, 'Paradero no encontrado');
  return paradero;
};

const agregarParadero = asyncHandler(async (req, res) => {
  const ruta = await resolverRuta(req.params.rutaId);
  if (!ruta) throw crearError(404, 'Ruta no encontrada');

  const { nombre, orden, lat, lng } = req.body || {};
  const datos = { nombre: validarNombre(nombre), ...validarCoordenadas(lat, lng) };

  const existentes = await Paradero.find({ rutaId: ruta._id }).sort({ orden: 1 });
  // Sin "orden" va al final; con "orden" se inserta en esa posición y los demás se corren.
  const posicion = hayValor(orden) ? Math.min(validarOrden(orden), existentes.length + 1) : existentes.length + 1;

  const nuevo = await Paradero.create({ ...datos, orden: posicion, rutaId: ruta._id });
  const lista = [...existentes];
  lista.splice(posicion - 1, 0, nuevo);
  await guardarOrden(lista);

  res.status(201).json(nuevo);
});

const editarParadero = asyncHandler(async (req, res) => {
  const paradero = await buscarParadero(req.params.id);
  const { nombre, orden, lat, lng } = req.body || {};

  if (nombre !== undefined) paradero.nombre = validarNombre(nombre);
  if (lat !== undefined || lng !== undefined) {
    const coords = validarCoordenadas(lat, lng);
    paradero.lat = coords.lat;
    paradero.lng = coords.lng;
  }
  const nuevoOrden = hayValor(orden) ? validarOrden(orden) : null;

  await paradero.save();

  if (nuevoOrden !== null && nuevoOrden !== paradero.orden) {
    const otros = await Paradero.find({ rutaId: paradero.rutaId, _id: { $ne: paradero._id } }).sort({ orden: 1 });
    const posicion = Math.min(nuevoOrden, otros.length + 1);
    otros.splice(posicion - 1, 0, paradero);
    await guardarOrden(otros);
  }

  res.json(await Paradero.findById(paradero._id));
});

const eliminarParadero = asyncHandler(async (req, res) => {
  const paradero = await buscarParadero(req.params.id);
  await Paradero.deleteOne({ _id: paradero._id });
  const restantes = await Paradero.find({ rutaId: paradero.rutaId }).sort({ orden: 1 });
  await guardarOrden(restantes);
  res.status(204).end();
});

// ---------- Horarios (HU13) ----------
// "hora" es texto libre ("06:00 - 09:00, cada 10 min"), igual que los datos que ya existen.

function validarHorario({ jornada, hora }) {
  const j = texto(jornada);
  const h = texto(hora);
  if (!j || !h) throw crearError(400, 'La jornada y la hora son obligatorias');
  if (j.length > MAX_JORNADA) throw crearError(400, `La jornada no puede superar los ${MAX_JORNADA} caracteres`);
  if (h.length > MAX_HORA) throw crearError(400, `La hora no puede superar los ${MAX_HORA} caracteres`);
  return { jornada: j, hora: h };
}

const clave = (h) => `${texto(h.jornada).toLowerCase()}|${texto(h.hora).toLowerCase()}`;

async function validarSinDuplicado(rutaId, datos, idExcluido = null) {
  const filtro = { rutaId };
  if (idExcluido) filtro._id = { $ne: idExcluido };
  const existentes = await Horario.find(filtro);
  if (existentes.some((h) => clave(h) === clave(datos))) {
    throw crearError(409, 'Ese horario ya existe para la ruta');
  }
}

const buscarHorario = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw crearError(404, 'Horario no encontrado');
  const horario = await Horario.findById(id);
  if (!horario) throw crearError(404, 'Horario no encontrado');
  return horario;
};

const agregarHorario = asyncHandler(async (req, res) => {
  const ruta = await resolverRuta(req.params.rutaId);
  if (!ruta) throw crearError(404, 'Ruta no encontrada');
  const datos = validarHorario(req.body || {});
  await validarSinDuplicado(ruta._id, datos);
  const horario = await Horario.create({ ...datos, rutaId: ruta._id });
  res.status(201).json(horario);
});

const editarHorario = asyncHandler(async (req, res) => {
  const horario = await buscarHorario(req.params.id);
  const cuerpo = req.body || {};
  const datos = validarHorario({
    jornada: cuerpo.jornada !== undefined ? cuerpo.jornada : horario.jornada,
    hora: cuerpo.hora !== undefined ? cuerpo.hora : horario.hora,
  });
  await validarSinDuplicado(horario.rutaId, datos, horario._id);
  horario.jornada = datos.jornada;
  horario.hora = datos.hora;
  await horario.save();
  res.json(horario);
});

const eliminarHorario = asyncHandler(async (req, res) => {
  const horario = await buscarHorario(req.params.id);
  await Horario.deleteOne({ _id: horario._id });
  res.status(204).end();
});

module.exports = {
  agregarParadero,
  editarParadero,
  eliminarParadero,
  agregarHorario,
  editarHorario,
  eliminarHorario,
};
