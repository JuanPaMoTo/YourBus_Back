const request = require('supertest');
const app = require('../src/app');
const { Ruta, Paradero, Bus } = require('../src/models');
const { iniciarBase, cerrarBase } = require('./helpers/db');
const { crearCuenta } = require('./helpers/cuentas');

let rutaL1;
let busBus101;
let admin;

beforeAll(async () => {
  // Mongo real en memoria: los tests no dependen de Atlas ni de internet.
  await iniciarBase();

  rutaL1 = await Ruta.create({ codigo: 'L1', nombre: 'Terminal Norte - Centro' });
  await Paradero.create({ nombre: 'Terminal Norte', orden: 1, rutaId: rutaL1._id });
  busBus101 = await Bus.create({
    placa: 'BUS-101',
    empresa: 'Transportes Norte',
    lat: -33.437,
    lng: -70.6505,
  });
  admin = await crearCuenta('admin');
});

afterAll(cerrarBase);

describe('GET /health', () => {
  it('responde ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/rutas', () => {
  it('devuelve la lista de rutas', async () => {
    const res = await request(app).get('/api/rutas');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('incluye "id" en cada ruta (lo usa el front como key)', async () => {
    const res = await request(app).get('/api/rutas');
    expect(res.body[0].id).toBe(String(rutaL1._id));
    expect(res.body[0]).not.toHaveProperty('__v');
  });
});

describe('GET /api/rutas/:rutaId/paraderos', () => {
  it('devuelve los paraderos de una ruta existente (por código)', async () => {
    const res = await request(app).get('/api/rutas/L1/paraderos');
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('nombre', 'Terminal Norte');
  });

  it('devuelve 404 si la ruta no existe', async () => {
    const res = await request(app).get('/api/rutas/NO-EXISTE/paraderos');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/buses/:busId/ubicacion', () => {
  it('devuelve la ubicación de un bus existente', async () => {
    const res = await request(app).get(`/api/buses/${busBus101._id}/ubicacion`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('lat');
    expect(res.body).toHaveProperty('lng');
  });
});

describe('POST /api/buses (solo administrador)', () => {
  it('rechaza la petición sin sesión', async () => {
    const res = await request(app).post('/api/buses').send({ placa: 'AAAA-11', empresa: 'X' });
    expect(res.status).toBe(401);
  });

  it('rechaza a un pasajero', async () => {
    const pasajero = await crearCuenta('pasajero');
    const res = await request(app)
      .post('/api/buses')
      .set(pasajero.auth)
      .send({ placa: 'AAAA-11', empresa: 'X' });
    expect(res.status).toBe(403);
  });

  it('rechaza el registro sin placa ni empresa', async () => {
    const res = await request(app).post('/api/buses').set(admin.auth).send({});
    expect(res.status).toBe(400);
  });

  it('registra un bus nuevo correctamente', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set(admin.auth)
      .send({ placa: 'ZZZZ-99', empresa: 'Transportes Test' });
    expect(res.status).toBe(201);
    expect(res.body.placa).toBe('ZZZZ-99');
  });

  it('rechaza una placa duplicada', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set(admin.auth)
      .send({ placa: 'ZZZZ-99', empresa: 'Otra empresa' });
    expect(res.status).toBe(409);
  });

  it('el administrador puede listar la flota', async () => {
    const res = await request(app).get('/api/buses').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.map((b) => b.placa)).toContain('ZZZZ-99');
  });
});
