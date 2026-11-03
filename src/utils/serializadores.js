// Convierte turnos (con populate + lean) a la forma que consume el front.

const idDe = (doc) => (doc ? String(doc._id) : null);

function serializarTurno(t) {
  const ubicacion = t.ubicacion && t.ubicacion.lat != null ? t.ubicacion : null;
  return {
    id: idDe(t),
    fecha: t.fecha,
    horaInicio: t.horaInicio,
    horaFin: t.horaFin,
    estado: t.estado,
    inicioReal: t.inicioReal,
    finReal: t.finReal,
    ultimoParaderoOrden: t.ultimoParaderoOrden,
    ubicacion,
    conductor: t.conductorId ? { id: idDe(t.conductorId), nombre: t.conductorId.nombre } : null,
    ruta: t.rutaId
      ? { id: idDe(t.rutaId), codigo: t.rutaId.codigo, nombre: t.rutaId.nombre }
      : null,
    bus: t.busId ? { id: idDe(t.busId), placa: t.busId.placa, empresa: t.busId.empresa } : null,
  };
}

// Datos públicos de un bus en ruta: no incluye al conductor (privacidad).
function serializarBusActivo(t, ahora = Date.now()) {
  const actualizado = t.ubicacion.actualizado ? new Date(t.ubicacion.actualizado).getTime() : 0;
  const segundos = Math.max(0, Math.round((ahora - actualizado) / 1000));
  return {
    turnoId: idDe(t),
    busId: t.busId ? idDe(t.busId) : null,
    placa: t.busId ? t.busId.placa : null,
    empresa: t.busId ? t.busId.empresa : null,
    lat: t.ubicacion.lat,
    lng: t.ubicacion.lng,
    velocidad: t.ubicacion.velocidad,
    rumbo: t.ubicacion.rumbo,
    actualizado: t.ubicacion.actualizado,
    ultimoParaderoOrden: t.ultimoParaderoOrden,
    segundosDesdeActualizacion: segundos,
    // Más de 90 s sin señal: el front lo muestra como "sin señal reciente".
    sinSenalReciente: segundos > 90,
  };
}

// Incidente (con populate + lean). "interno" añade quién lo reportó: solo para el
// administrador; el público no ve datos del conductor.
function serializarIncidente(i, { interno = false } = {}) {
  const dato = {
    id: idDe(i),
    tipo: i.tipo,
    descripcion: i.descripcion,
    estado: i.estado,
    creadoEn: i.createdAt,
    finalizadoEn: i.finalizadoEn,
    ruta: i.rutaId ? { id: idDe(i.rutaId), codigo: i.rutaId.codigo, nombre: i.rutaId.nombre } : null,
  };
  if (interno) {
    dato.reportadoPor = i.reportadoPor ? { id: idDe(i.reportadoPor), nombre: i.reportadoPor.nombre } : null;
  }
  return dato;
}

module.exports = { serializarTurno, serializarBusActivo, serializarIncidente };
