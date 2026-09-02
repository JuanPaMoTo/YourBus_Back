const request = require('supertest');
const app = require('../src/app');

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
});

describe('GET /api/rutas/:rutaId/paraderos', () => {
  it('devuelve los paraderos de una ruta existente', async () => {
    const res = await request(app).get('/api/rutas/1/paraderos');
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('nombre');
  });

  it('devuelve 404 si la ruta no existe', async () => {
    const res = await request(app).get('/api/rutas/no-existe/paraderos');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/buses/:busId/ubicacion', () => {
  it('devuelve la ubicación de un bus existente', async () => {
    const res = await request(app).get('/api/buses/BUS-101/ubicacion');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('lat');
    expect(res.body).toHaveProperty('lng');
  });
});

describe('POST /api/buses', () => {
  it('rechaza el registro sin placa ni empresa', async () => {
    const res = await request(app).post('/api/buses').send({});
    expect(res.status).toBe(400);
  });

  it('registra un bus nuevo correctamente', async () => {
    const res = await request(app)
      .post('/api/buses')
      .send({ placa: 'ZZZZ-99', empresa: 'Transportes Test' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('ZZZZ-99');
  });
});
