// Caché en memoria con vencimiento. Sirve para no pedir la misma ruta al
// servicio externo de mapas en cada consulta de cada pasajero.
function crearCache(ttlMs, maxEntradas = 500) {
  const mapa = new Map();

  return {
    obtener(clave, ahora = Date.now()) {
      const entrada = mapa.get(clave);
      if (!entrada) return undefined;
      if (entrada.expira <= ahora) {
        mapa.delete(clave);
        return undefined;
      }
      return entrada.valor;
    },
    guardar(clave, valor, ahora = Date.now()) {
      if (mapa.size >= maxEntradas) {
        // Descarta lo vencido; si sigue lleno, la entrada más antigua.
        for (const [k, e] of mapa) {
          if (e.expira <= ahora) mapa.delete(k);
        }
        if (mapa.size >= maxEntradas) mapa.delete(mapa.keys().next().value);
      }
      mapa.set(clave, { valor, expira: ahora + ttlMs });
    },
    limpiar() {
      mapa.clear();
    },
  };
}

module.exports = { crearCache };
