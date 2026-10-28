const request = require('supertest');

// El servicio externo de mapas se simula: 8 minutos / 2,5 km por OSRM.
jest.mock('../src/utils/routing', () => ({
  calcularRecorrido: jest.fn(async () => ({ distanciaMetros: 2500, segundos: 480, metodo: 'osrm' })),
}));

const app = require('../src/app');
const config = require('../src/config/env');
const { calcularRecorrido } = require('../src/utils/routing');
const { limpiarCacheEta } = require('../src/utils/eta');
const { hoy } = require('../src/utils/fechas');
const { Ruta, Paradero, Bus, Turno } = require('../src/models');
const { iniciarBase, cerrarBase } = require('./helpers/db');
const { crearCuenta } = require('./helpers/cuentas');

let admin;
let conductor;
let otro;
let ruta;
let paraderos;
let bus;
let turnoId;

const post = (ruta_, quien, cuerpo = {}) => request(app).post(ruta_).set(quien.auth).send(cuerpo);

beforeAll(async () => {
  await iniciarBase();
  admin = await crearCuenta('admin');
  conductor = await crearCuenta('conductor');
  otro = await crearCuenta('conductor', 'otro@prueba.cl');

  ruta = await Ruta.create({ codigo: 'L1', nombre: 'Terminal Norte - Centro' });
  paraderos = await Paradero.insertMany([
    { nombre: 'Terminal Norte', orden: 1, rutaId: ruta._id, lat: -33.4015, lng: -70.6545 },
    { nombre: 'Av. Independencia', orden: 2, rutaId: ruta._id, lat: -33.4207, lng: -70.6525 },
    { nombre: 'Plaza Central', orden: 3, rutaId: ruta._id, lat: -33.4372, lng: -70.6506 },
    { nombre: 'Sin coordenadas', orden: 4, rutaId: ruta._id },
  ]);
  bus = await Bus.create({ placa: 'AAAA-11', empresa: 'Norte' });

  const res = await request(app)
    .post('/api/turnos')
    .set(admin.auth)
    .send({
      conductorId: String(conductor.usuario._id),
      rutaId: String(ruta._id),
      busId: String(bus._id),
      fecha: hoy(config.tzOperacion),
      horaInicio: '08:00',
      horaFin: '12:00',
    });
  turnoId = res.body.id;
});

afterAll(cerrarBase);

beforeEach(() => {
  calcularRecorrido.mockClear();
  limpiarCacheEta();
});

describe('Antes de iniciar', () => {
  it('no hay buses activos y el ETA indica que no hay ubicación', async () => {
    const activos = await request(app).get('/api/rutas/L1/buses-activos');
    expect(activos.body).toEqual([]);

    const eta = await request(app).get(`/api/turnos/${turnoId}/eta?paraderoId=${paraderos[2]._id}`);
    expect(eta.body.estado).toBe('sin_ubicacion');
  });

  it('otro conductor no puede operar el turno ajeno', async () => {
    expect((await post(`/api/turnos/${turnoId}/iniciar`, otro)).status).toBe(403);
  });

  it('no se puede enviar ubicación de un turno que no está en curso', async () => {
    const res = await post(`/api/turnos/${turnoId}/ubicacion`, conductor, { lat: -33.4, lng: -70.65 });
    expect(res.status).toBe(409);
  });

  it('no se puede iniciar un turno de otro día', async () => {
    const futuro = await Turno.create({
      conductorId: conductor.usuario._id,
      rutaId: ruta._id,
      busId: bus._id,
      fecha: '2099-01-01',
      horaInicio: '08:00',
      horaFin: '09:00',
    });
    const res = await post(`/api/turnos/${futuro._id}/iniciar`, conductor);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/hoy/);
  });
});

describe('Recorrido en vivo', () => {
  it('el conductor inicia el recorrido', async () => {
    const res = await post(`/api/turnos/${turnoId}/iniciar`, conductor);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('en_curso');
    expect((await post(`/api/turnos/${turnoId}/iniciar`, conductor)).status).toBe(409);
  });

  it('valida las coordenadas recibidas', async () => {
    const mala = await post(`/api/turnos/${turnoId}/ubicacion`, conductor, { lat: 200, lng: 0 });
    expect(mala.status).toBe(400);
    const texto = await post(`/api/turnos/${turnoId}/ubicacion`, conductor, { lat: '-33.4', lng: '-70.6' });
    expect(texto.status).toBe(400);
    const velocidad = await post(`/api/turnos/${turnoId}/ubicacion`, conductor, { lat: -33.4, lng: -70.6, velocidad: 'rápido' });
    expect(velocidad.status).toBe(400);
  });

  it('lejos del primer paradero: el bus sigue sin paraderos recorridos', async () => {
    const res = await post(`/api/turnos/${turnoId}/ubicacion`, conductor, {
      lat: -33.395,
      lng: -70.6545,
      velocidad: 8,
      rumbo: 180,
      precision: 10,
    });
    expect(res.status).toBe(200);
    expect(res.body.ultimoParaderoOrden).toBe(0);
    expect(res.body.proximoParadero).toMatchObject({ nombre: 'Terminal Norte', orden: 1 });
    expect(res.body.proximoParadero.distanciaMetros).toBeGreaterThan(500);
  });

  it('al llegar a menos de 80 m del paradero 1 lo marca como recorrido', async () => {
    const res = await post(`/api/turnos/${turnoId}/ubicacion`, conductor, { lat: -33.4016, lng: -70.6545 });
    expect(res.body.ultimoParaderoOrden).toBe(1);
    expect(res.body.proximoParadero).toMatchObject({ nombre: 'Av. Independencia', orden: 2 });
  });

  it('los pasajeros ven el bus en la ruta, sin datos del conductor', async () => {
    const res = await request(app).get('/api/rutas/L1/buses-activos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ placa: 'AAAA-11', ultimoParaderoOrden: 1, sinSenalReciente: false });
    expect(JSON.stringify(res.body)).not.toMatch(/conductor/i);
  });

  it('también actualiza el endpoint histórico de ubicación del bus', async () => {
    const res = await request(app).get(`/api/buses/${bus._id}/ubicacion`);
    expect(res.status).toBe(200);
    expect(res.body.lat).toBeCloseTo(-33.4016, 4);
  });

  it('ETA al último paradero: pasa por los paraderos intermedios, en orden', async () => {
    const res = await request(app).get(`/api/turnos/${turnoId}/eta?paraderoId=${paraderos[2]._id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'en_camino',
      minutos: 8,
      distanciaMetros: 2500,
      metodo: 'osrm',
      paradasHastaLlegar: 2,
    });

    // El recorrido pedido es: bus → paradero 2 → paradero 3
    const puntos = calcularRecorrido.mock.calls[0][0];
    expect(puntos).toHaveLength(3);
    expect(puntos[0].lat).toBeCloseTo(-33.4016, 4);
    expect(puntos[1].lat).toBeCloseTo(-33.4207, 4);
    expect(puntos[2].lat).toBeCloseTo(-33.4372, 4);
  });

  it('el ETA se guarda en caché unos segundos (no se consulta el mapa en cada petición)', async () => {
    const url = `/api/turnos/${turnoId}/eta?paraderoId=${paraderos[2]._id}`;
    await request(app).get(url);
    await request(app).get(url);
    expect(calcularRecorrido).toHaveBeenCalledTimes(1);
  });

  it('ETA de un paradero ya recorrido o sin coordenadas', async () => {
    const pasado = await request(app).get(`/api/turnos/${turnoId}/eta?paraderoId=${paraderos[0]._id}`);
    expect(pasado.body.estado).toBe('ya_paso');
    const sinCoord = await request(app).get(`/api/turnos/${turnoId}/eta?paraderoId=${paraderos[3]._id}`);
    expect(sinCoord.body.estado).toBe('sin_coordenadas');
  });

  it('valida los parámetros del ETA', async () => {
    expect((await request(app).get(`/api/turnos/${turnoId}/eta`)).status).toBe(400);
    expect((await request(app).get(`/api/turnos/${turnoId}/eta?paraderoId=${ruta._id}`)).status).toBe(404);
    expect((await request(app).get(`/api/turnos/zzz/eta?paraderoId=${paraderos[2]._id}`)).status).toBe(404);
  });

  it('ETA por paradero: elige el bus en ruta y devuelve su placa', async () => {
    const res = await request(app).get(`/api/paraderos/${paraderos[2]._id}/eta`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ minutos: 8, placa: 'AAAA-11' });
  });

  it('ETA por paradero: 404 si ningún bus viene hacia él', async () => {
    expect((await request(app).get(`/api/paraderos/${paraderos[0]._id}/eta`)).status).toBe(404);
    expect((await request(app).get('/api/paraderos/zzz/eta')).status).toBe(404);
  });

  it('el conductor finaliza el recorrido y el bus deja de aparecer', async () => {
    const res = await post(`/api/turnos/${turnoId}/finalizar`, conductor);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('completado');
    expect((await request(app).get('/api/rutas/L1/buses-activos')).body).toEqual([]);
    expect((await request(app).get(`/api/buses/${bus._id}/ubicacion`)).status).toBe(404);
    expect((await post(`/api/turnos/${turnoId}/finalizar`, conductor)).status).toBe(409);
  });
});

describe('Casos de borde', () => {
  it('un turno en curso de un día anterior se cierra solo al iniciar el de hoy', async () => {
    const viejo = await Turno.create({
      conductorId: conductor.usuario._id,
      rutaId: ruta._id,
      busId: bus._id,
      fecha: '2020-01-01',
      horaInicio: '08:00',
      horaFin: '09:00',
      estado: 'en_curso',
    });
    const hoyTurno = await Turno.create({
      conductorId: conductor.usuario._id,
      rutaId: ruta._id,
      busId: bus._id,
      fecha: hoy(config.tzOperacion),
      horaInicio: '15:00',
      horaFin: '16:00',
    });
    const res = await post(`/api/turnos/${hoyTurno._id}/iniciar`, conductor);
    expect(res.status).toBe(200);
    expect((await Turno.findById(viejo._id)).estado).toBe('completado');
  });

  it('busesActivos: 404 si la ruta no existe', async () => {
    expect((await request(app).get('/api/rutas/NOPE/buses-activos')).status).toBe(404);
  });
});
