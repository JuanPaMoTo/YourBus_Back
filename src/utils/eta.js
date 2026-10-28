// ETA de un bus en curso hacia un paradero, siguiendo el orden de paraderos de
// su ruta (no la línea recta bus→paradero): se arma la secuencia
//   posición del bus → próximo paradero → ... → paradero de destino
// y se calcula el recorrido por calles de toda la secuencia.

const { calcularRecorrido } = require('./routing');
const { crearCache } = require('./cacheTtl');
const { coordenadaValida } = require('./geo');
const config = require('../config/env');

const cache = crearCache(config.routing.cacheSegundos * 1000);

const tieneCoordenadas = (p) => coordenadaValida(p.lat, p.lng);

/**
 * @param {object} turno  turno en curso (con ubicacion y ultimoParaderoOrden)
 * @param {object[]} paraderos paraderos de la ruta del turno
 * @param {object} destino paradero de destino
 */
async function calcularEta(turno, paraderos, destino) {
  const base = {
    turnoId: String(turno._id),
    paradero: { id: String(destino._id), nombre: destino.nombre, orden: destino.orden },
  };

  const { lat, lng } = turno.ubicacion || {};
  if (turno.estado !== 'en_curso' || !coordenadaValida(lat, lng)) {
    return { ...base, estado: 'sin_ubicacion' };
  }
  if (destino.orden <= turno.ultimoParaderoOrden) {
    return { ...base, estado: 'ya_paso' };
  }
  if (!tieneCoordenadas(destino)) {
    return { ...base, estado: 'sin_coordenadas' };
  }

  const pendientes = paraderos
    .filter((p) => p.orden > turno.ultimoParaderoOrden && p.orden <= destino.orden)
    .sort((a, b) => a.orden - b.orden);
  // Si algún paradero intermedio no tiene coordenadas se omite del recorrido.
  const puntos = [{ lat, lng }, ...pendientes.filter(tieneCoordenadas).map((p) => ({ lat: p.lat, lng: p.lng }))];

  const clave = `${turno._id}:${destino._id}:${turno.ultimoParaderoOrden}`;
  let recorrido = cache.obtener(clave);
  if (!recorrido) {
    recorrido = await calcularRecorrido(puntos);
    cache.guardar(clave, recorrido);
  }

  return {
    ...base,
    estado: 'en_camino',
    distanciaMetros: recorrido.distanciaMetros,
    segundos: recorrido.segundos,
    minutos: Math.max(1, Math.round(recorrido.segundos / 60)),
    metodo: recorrido.metodo,
    paradasHastaLlegar: pendientes.length,
  };
}

module.exports = { calcularEta, limpiarCacheEta: () => cache.limpiar() };
