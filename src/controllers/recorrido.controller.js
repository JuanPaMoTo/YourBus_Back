const mongoose = require('mongoose');
const { Turno, Bus, Paradero } = require('../models');
const config = require('../config/env');
const { crearError, asyncHandler } = require('../utils/errores');
const { coordenadaValida, distanciaMetros } = require('../utils/geo');
const { hoy } = require('../utils/fechas');
const { calcularEta } = require('../utils/eta');
const { serializarBusActivo } = require('../utils/serializadores');
const { cargarTurno, POPULATE } = require('./turnos.controller');
const { resolverRuta } = require('../utils/resolverRuta');

// A esta distancia del próximo paradero se considera que el bus "llegó".
const RADIO_LLEGADA_M = 80;

const esNumeroOpcional = (v) => v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v));

// Solo el conductor dueño del turno puede operarlo.
async function turnoDelConductor(req) {
  const turno = await cargarTurno(req.params.id);
  if (String(turno.conductorId) !== String(req.usuario._id)) {
    throw crearError(403, 'Este turno no te pertenece');
  }
  return turno;
}

// ---------------------------------------------------------------- conductor

const iniciar = asyncHandler(async (req, res) => {
  const turno = await turnoDelConductor(req);
  if (turno.estado !== 'programado') {
    throw crearError(409, `El turno está "${turno.estado}"; solo se inicia uno programado`);
  }
  const fechaHoy = hoy(config.tzOperacion);
  if (turno.fecha !== fechaHoy) {
    throw crearError(409, `Este turno es del ${turno.fecha}; solo puedes iniciar turnos de hoy`);
  }

  // Si quedó un turno "en curso" de un día anterior sin cerrar, se cierra solo.
  await Turno.updateMany(
    {
      estado: 'en_curso',
      fecha: { $lt: fechaHoy },
      $or: [{ conductorId: turno.conductorId }, { busId: turno.busId }],
    },
    { estado: 'completado', finReal: new Date() }
  );
  const ocupado = await Turno.findOne({
    _id: { $ne: turno._id },
    estado: 'en_curso',
    $or: [{ conductorId: turno.conductorId }, { busId: turno.busId }],
  });
  if (ocupado) {
    throw crearError(409, 'Ya tienes un recorrido en curso (o el bus está siendo usado)');
  }

  turno.estado = 'en_curso';
  turno.inicioReal = new Date();
  turno.ultimoParaderoOrden = 0;
  turno.ubicacion = {
    lat: null,
    lng: null,
    velocidad: null,
    rumbo: null,
    precision: null,
    actualizado: null,
  };
  await turno.save();
  await Bus.updateOne({ _id: turno.busId }, { rutaId: turno.rutaId });
  res.json({ id: String(turno._id), estado: turno.estado, inicioReal: turno.inicioReal });
});

// Avanza el contador de paraderos si el bus ya está junto al siguiente.
async function avanzarParaderos(turno, posicion) {
  for (let i = 0; i < 3; i += 1) {
    const siguiente = await Paradero.findOne({
      rutaId: turno.rutaId,
      orden: turno.ultimoParaderoOrden + 1,
    });
    if (!siguiente || !coordenadaValida(siguiente.lat, siguiente.lng)) return siguiente;
    if (distanciaMetros(posicion, siguiente) > RADIO_LLEGADA_M) return siguiente;
    turno.ultimoParaderoOrden = siguiente.orden;
  }
  return Paradero.findOne({ rutaId: turno.rutaId, orden: turno.ultimoParaderoOrden + 1 });
}

const ubicacion = asyncHandler(async (req, res) => {
  const turno = await turnoDelConductor(req);
  if (turno.estado !== 'en_curso') {
    throw crearError(409, 'El recorrido no está en curso');
  }

  const { lat, lng, velocidad, rumbo, precision } = req.body;
  if (!coordenadaValida(lat, lng)) throw crearError(400, 'lat y lng deben ser coordenadas válidas');
  if (![velocidad, rumbo, precision].every(esNumeroOpcional)) {
    throw crearError(400, 'velocidad, rumbo y precision deben ser números');
  }

  const posicion = { lat, lng };
  const proximo = await avanzarParaderos(turno, posicion);

  turno.ubicacion = {
    lat,
    lng,
    velocidad: velocidad ?? null,
    rumbo: rumbo ?? null,
    precision: precision ?? null,
    actualizado: new Date(),
  };
  await turno.save();
  // Mantiene al día el endpoint histórico /buses/:id/ubicacion
  await Bus.updateOne({ _id: turno.busId }, { lat, lng });

  res.json({
    ok: true,
    ultimoParaderoOrden: turno.ultimoParaderoOrden,
    proximoParadero: proximo
      ? {
          nombre: proximo.nombre,
          orden: proximo.orden,
          distanciaMetros: coordenadaValida(proximo.lat, proximo.lng)
            ? Math.round(distanciaMetros(posicion, proximo))
            : null,
        }
      : null,
  });
});

const finalizar = asyncHandler(async (req, res) => {
  const turno = await turnoDelConductor(req);
  if (turno.estado !== 'en_curso') {
    throw crearError(409, 'El recorrido no está en curso');
  }
  turno.estado = 'completado';
  turno.finReal = new Date();
  await turno.save();
  await Bus.updateOne({ _id: turno.busId }, { lat: null, lng: null });
  res.json({ id: String(turno._id), estado: turno.estado, finReal: turno.finReal });
});

// ------------------------------------------------------------------ público

// Buses que están circulando ahora por una ruta (sin datos del conductor).
const busesActivos = asyncHandler(async (req, res) => {
  const ruta = await resolverRuta(req.params.rutaId);
  if (!ruta) throw crearError(404, 'Ruta no encontrada');
  const turnos = await Turno.find({
    rutaId: ruta._id,
    estado: 'en_curso',
    'ubicacion.lat': { $ne: null },
  })
    .populate({ path: 'busId', select: 'placa empresa' })
    .lean();
  res.json(turnos.map((t) => serializarBusActivo(t)));
});

// ETA de un bus concreto (turno) hacia un paradero de su ruta.
const eta = asyncHandler(async (req, res) => {
  const { paraderoId } = req.query;
  if (!mongoose.isValidObjectId(paraderoId)) throw crearError(400, 'paraderoId es obligatorio');
  const turno = await cargarTurno(req.params.id);
  const paraderos = await Paradero.find({ rutaId: turno.rutaId }).sort({ orden: 1 });
  const destino = paraderos.find((p) => String(p._id) === paraderoId);
  if (!destino) throw crearError(404, 'Ese paradero no pertenece a la ruta del bus');
  res.json(await calcularEta(turno, paraderos, destino));
});

// ETA de un paradero: elige, entre los buses en ruta, el que llegue primero.
const etaParadero = asyncHandler(async (req, res) => {
  const { paraderoId } = req.params;
  const sinEta = () => crearError(404, 'No hay ETA disponible para este paradero');
  if (!mongoose.isValidObjectId(paraderoId)) throw sinEta();
  const destino = await Paradero.findById(paraderoId);
  if (!destino) throw sinEta();

  const [paraderos, turnos] = await Promise.all([
    Paradero.find({ rutaId: destino.rutaId }).sort({ orden: 1 }),
    Turno.find({ rutaId: destino.rutaId, estado: 'en_curso', 'ubicacion.lat': { $ne: null } }).populate(
      POPULATE[2]
    ),
  ]);

  const calculos = await Promise.all(
    turnos.map(async (t) => ({ ...(await calcularEta(t, paraderos, destino)), placa: t.busId?.placa }))
  );
  const enCamino = calculos.filter((c) => c.estado === 'en_camino').sort((a, b) => a.segundos - b.segundos);
  if (enCamino.length === 0) throw sinEta();
  res.json(enCamino[0]);
});

module.exports = { iniciar, ubicacion, finalizar, busesActivos, eta, etaParadero };
