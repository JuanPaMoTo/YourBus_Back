const RADIO_TIERRA_M = 6371000;

const aRadianes = (grados) => (grados * Math.PI) / 180;

function coordenadaValida(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Distancia en línea recta (círculo máximo) entre dos puntos, en metros.
function distanciaMetros(a, b) {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

// Largo de una poligonal (suma de tramos en línea recta), en metros.
function largoPoligonal(puntos) {
  let total = 0;
  for (let i = 1; i < puntos.length; i += 1) {
    total += distanciaMetros(puntos[i - 1], puntos[i]);
  }
  return total;
}

module.exports = { coordenadaValida, distanciaMetros, largoPoligonal };
