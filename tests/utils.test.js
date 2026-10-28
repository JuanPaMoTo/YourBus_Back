const { distanciaMetros, largoPoligonal, coordenadaValida } = require('../src/utils/geo');
const { fechaValida, horaValida, seSolapan, hoy } = require('../src/utils/fechas');
const { crearCache } = require('../src/utils/cacheTtl');
const { calcularRecorrido } = require('../src/utils/routing');

describe('geo', () => {
  it('calcula distancias conocidas (Plaza de Armas → Estación Central ≈ 3,1 km)', () => {
    const d = distanciaMetros({ lat: -33.4372, lng: -70.6506 }, { lat: -33.4528, lng: -70.6783 });
    expect(d).toBeGreaterThan(2900);
    expect(d).toBeLessThan(3400);
  });

  it('distancia de un punto a sí mismo es 0 y la poligonal suma los tramos', () => {
    const a = { lat: -33.4, lng: -70.6 };
    const b = { lat: -33.41, lng: -70.6 };
    const c = { lat: -33.42, lng: -70.6 };
    expect(distanciaMetros(a, a)).toBe(0);
    expect(largoPoligonal([a, b, c])).toBeCloseTo(distanciaMetros(a, b) + distanciaMetros(b, c), 3);
    expect(largoPoligonal([a])).toBe(0);
  });

  it('valida coordenadas', () => {
    expect(coordenadaValida(-33.4, -70.6)).toBe(true);
    expect(coordenadaValida(91, 0)).toBe(false);
    expect(coordenadaValida(0, 181)).toBe(false);
    expect(coordenadaValida('1', 2)).toBe(false);
    expect(coordenadaValida(NaN, 2)).toBe(false);
  });
});

describe('fechas', () => {
  it('valida fechas y horas', () => {
    expect(fechaValida('2026-10-27')).toBe(true);
    expect(fechaValida('2028-02-29')).toBe(true);
    expect(fechaValida('2027-02-29')).toBe(false);
    expect(fechaValida('27-10-2026')).toBe(false);
    expect(fechaValida(20261027)).toBe(false);
    expect(horaValida('00:00')).toBe(true);
    expect(horaValida('23:59')).toBe(true);
    expect(horaValida('24:00')).toBe(false);
    expect(horaValida('8:00')).toBe(false);
  });

  it('detecta solapes (los extremos que se tocan no cuentan)', () => {
    expect(seSolapan('08:00', '12:00', '11:00', '14:00')).toBe(true);
    expect(seSolapan('08:00', '12:00', '12:00', '14:00')).toBe(false);
    expect(seSolapan('08:00', '12:00', '06:00', '08:00')).toBe(false);
    expect(seSolapan('08:00', '12:00', '09:00', '10:00')).toBe(true);
  });

  it('"hoy" respeta la zona horaria (23:30 en Santiago ya es el día siguiente en UTC)', () => {
    // 2026-10-27 02:30 UTC = 2026-10-26 23:30 en Santiago (UTC-3)
    const instante = new Date('2026-10-27T02:30:00Z');
    expect(hoy('America/Santiago', instante)).toBe('2026-10-26');
    expect(hoy('UTC', instante)).toBe('2026-10-27');
  });
});

describe('cacheTtl', () => {
  it('devuelve el valor hasta que vence', () => {
    const cache = crearCache(1000);
    cache.guardar('k', 42, 0);
    expect(cache.obtener('k', 999)).toBe(42);
    expect(cache.obtener('k', 1000)).toBeUndefined();
    expect(cache.obtener('otra')).toBeUndefined();
  });

  it('no crece sin límite', () => {
    const cache = crearCache(1000, 3);
    ['a', 'b', 'c', 'd'].forEach((k, i) => cache.guardar(k, i, 0));
    expect(cache.obtener('a', 1)).toBeUndefined();
    expect(cache.obtener('d', 1)).toBe(3);
    cache.limpiar();
    expect(cache.obtener('d', 1)).toBeUndefined();
  });
});

describe('routing (calcularRecorrido)', () => {
  const puntos = [
    { lat: -33.4, lng: -70.65 },
    { lat: -33.42, lng: -70.65 },
    { lat: -33.44, lng: -70.65 },
  ];
  const opciones = { baseUrl: 'http://osrm.test', timeoutMs: 100, factorTiempoBus: 1.5, segundosPorParada: 30 };

  it('usa OSRM: pide lng,lat en orden y ajusta el tiempo a bus + paradas', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 4400.4, duration: 600 }] }),
    }));
    const r = await calcularRecorrido(puntos, { ...opciones, fetchImpl });

    expect(fetchImpl.mock.calls[0][0]).toBe(
      'http://osrm.test/route/v1/driving/-70.65,-33.4;-70.65,-33.42;-70.65,-33.44?overview=false&alternatives=false&steps=false'
    );
    // 600 s × 1,5 + 1 parada intermedia × 30 s = 930 s
    expect(r).toEqual({ distanciaMetros: 4400, segundos: 930, metodo: 'osrm' });
  });

  it.each([
    ['responde con error HTTP', async () => ({ ok: false, status: 503 })],
    ['no encuentra ruta', async () => ({ ok: true, json: async () => ({ code: 'NoRoute', routes: [] }) })],
    ['falla la red', async () => { throw new Error('ECONNREFUSED'); }],
  ])('si OSRM %s, estima en línea recta y lo informa', async (_, fetchImpl) => {
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await calcularRecorrido(puntos, { ...opciones, fetchImpl });
    aviso.mockRestore();

    expect(r.metodo).toBe('estimacion_lineal');
    // ~4,4 km en línea recta × 1,35 de rodeo ≈ 6 km
    expect(r.distanciaMetros).toBeGreaterThan(5500);
    expect(r.distanciaMetros).toBeLessThan(6500);
    expect(r.segundos).toBeGreaterThan(0);
  });

  it('corta la espera si el servicio no responde a tiempo', async () => {
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = (url, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('abortado')));
      });
    const r = await calcularRecorrido(puntos, { ...opciones, timeoutMs: 20, fetchImpl });
    aviso.mockRestore();
    expect(r.metodo).toBe('estimacion_lineal');
  });

  it('exige al menos dos puntos', async () => {
    await expect(calcularRecorrido([puntos[0]])).rejects.toThrow(/dos puntos/);
  });
});
