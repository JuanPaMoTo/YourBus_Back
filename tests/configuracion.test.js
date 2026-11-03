const request = require('supertest');
const app = require('../src/app');
const { Ruta, Paradero, Horario } = require('../src/models');
const { iniciarBase, cerrarBase } = require('./helpers/db');
const { crearCuenta } = require('./helpers/cuentas');

let admin;
let conductor;
let ruta;

beforeAll(async () => {
  await iniciarBase();
  admin = await crearCuenta('admin');
  conductor = await crearCuenta('conductor');
  ruta = await Ruta.create({ codigo: 'L1', nombre: 'Terminal Norte - Centro' });
});

afterAll(cerrarBase);

beforeEach(async () => {
  await Paradero.deleteMany({});
  await Horario.deleteMany({});
});

const nombresEnOrden = async () =>
  (await Paradero.find({ rutaId: ruta._id }).sort({ orden: 1 })).map((p) => `${p.orden}:${p.nombre}`);

const agregarP = (cuerpo, quien = admin, rutaId = 'L1') =>
  request(app).post(`/api/rutas/${rutaId}/paraderos`).set(quien.auth).send(cuerpo);

describe('POST /api/rutas/:rutaId/paraderos (HU12)', () => {
  it('agrega un paradero asociado a la ruta y lo deja al final', async () => {
    const a = await agregarP({ nombre: 'Terminal Norte', lat: -33.4, lng: -70.65 });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ nombre: 'Terminal Norte', orden: 1, lat: -33.4, lng: -70.65 });
    expect(String(a.body.rutaId)).toBe(String(ruta._id));

    await agregarP({ nombre: 'Plaza Central' });
    expect(await nombresEnOrden()).toEqual(['1:Terminal Norte', '2:Plaza Central']);
  });

  it('con "orden" lo inserta en esa posición y corre los demás', async () => {
    await agregarP({ nombre: 'A' });
    await agregarP({ nombre: 'B' });
    const c = await agregarP({ nombre: 'C', orden: 1 });
    expect(c.body.orden).toBe(1);
    expect(await nombresEnOrden()).toEqual(['1:C', '2:A', '3:B']);

    await agregarP({ nombre: 'D', orden: 99 });
    expect(await nombresEnOrden()).toEqual(['1:C', '2:A', '3:B', '4:D']);
  });

  it('la consulta pública los devuelve ordenados', async () => {
    await agregarP({ nombre: 'B' });
    await agregarP({ nombre: 'A', orden: 1 });
    const res = await request(app).get('/api/rutas/L1/paraderos');
    expect(res.body.map((p) => p.nombre)).toEqual(['A', 'B']);
  });

  it('impide registrar si falta información obligatoria o es inválida', async () => {
    expect((await agregarP({})).status).toBe(400);
    expect((await agregarP({ nombre: '   ' })).status).toBe(400);
    expect((await agregarP({ nombre: 'x'.repeat(81) })).status).toBe(400);
    expect((await agregarP({ nombre: 'A', orden: 0 })).status).toBe(400);
    expect((await agregarP({ nombre: 'A', orden: 'dos' })).status).toBe(400);
    expect((await agregarP({ nombre: 'A', lat: -33.4 })).status).toBe(400);
    expect((await agregarP({ nombre: 'A', lat: 100, lng: 0 })).status).toBe(400);
    expect((await agregarP({ nombre: 'A', lat: 0, lng: 200 })).status).toBe(400);
    expect((await agregarP({ nombre: 'A', lat: '1', lng: '2' })).status).toBe(400);
    expect(await Paradero.countDocuments()).toBe(0);
  });

  it('responde 404 si la ruta no existe y exige ser administrador', async () => {
    expect((await agregarP({ nombre: 'A' }, admin, 'NO-EXISTE')).status).toBe(404);
    expect((await agregarP({ nombre: 'A' }, conductor)).status).toBe(403);
    const sinSesion = await request(app).post('/api/rutas/L1/paraderos').send({ nombre: 'A' });
    expect(sinSesion.status).toBe(401);
  });
});

describe('PUT y DELETE /api/paraderos/:id', () => {
  const crear3 = async () => {
    const ids = {};
    for (const nombre of ['A', 'B', 'C']) {
      ids[nombre] = (await agregarP({ nombre })).body.id;
    }
    return ids;
  };
  const editar = (id, cuerpo, quien = admin) =>
    request(app).put(`/api/paraderos/${id}`).set(quien.auth).send(cuerpo);

  it('cambia el orden de un paradero y reordena la ruta', async () => {
    const ids = await crear3();
    const res = await editar(ids.C, { orden: 1 });
    expect(res.status).toBe(200);
    expect(res.body.orden).toBe(1);
    expect(await nombresEnOrden()).toEqual(['1:C', '2:A', '3:B']);

    await editar(ids.C, { orden: 3 });
    expect(await nombresEnOrden()).toEqual(['1:A', '2:B', '3:C']);
  });

  it('edita nombre y coordenadas, y permite quitarlas', async () => {
    const ids = await crear3();
    const res = await editar(ids.A, { nombre: ' Nuevo ', lat: 4.9, lng: -74 });
    expect(res.body).toMatchObject({ nombre: 'Nuevo', lat: 4.9, lng: -74 });
    const sin = await editar(ids.A, { lat: null, lng: null });
    expect(sin.body.lat).toBeNull();
    expect(sin.body.lng).toBeNull();
  });

  it('valida los datos, el id y los permisos', async () => {
    const ids = await crear3();
    expect((await editar(ids.A, { nombre: '' })).status).toBe(400);
    expect((await editar(ids.A, { orden: 0 })).status).toBe(400);
    expect((await editar(ids.A, { lat: 1 })).status).toBe(400);
    expect((await editar('no-es-id', {})).status).toBe(404);
    expect((await editar('64b7f0c2e1d3a4b5c6d7e8f9', {})).status).toBe(404);
    expect((await editar(ids.A, { nombre: 'X' }, conductor)).status).toBe(403);
  });

  it('al eliminar, el resto queda numerado sin huecos', async () => {
    const ids = await crear3();
    const res = await request(app).delete(`/api/paraderos/${ids.A}`).set(admin.auth);
    expect(res.status).toBe(204);
    expect(await nombresEnOrden()).toEqual(['1:B', '2:C']);

    expect((await request(app).delete(`/api/paraderos/${ids.A}`).set(admin.auth)).status).toBe(404);
    expect((await request(app).delete(`/api/paraderos/${ids.B}`).set(conductor.auth)).status).toBe(403);
  });
});

describe('Horarios (HU13)', () => {
  const agregarH = (cuerpo, quien = admin, rutaId = 'L1') =>
    request(app).post(`/api/rutas/${rutaId}/horarios`).set(quien.auth).send(cuerpo);

  it('registra un horario válido y queda disponible en la consulta pública', async () => {
    const res = await agregarH({ jornada: 'Mañana', hora: '06:00 - 09:00, cada 10 min' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ jornada: 'Mañana', hora: '06:00 - 09:00, cada 10 min' });

    const publico = await request(app).get('/api/rutas/L1/horarios');
    expect(publico.body).toHaveLength(1);
  });

  it('evita duplicados (sin distinguir mayúsculas ni espacios de más)', async () => {
    await agregarH({ jornada: 'Mañana', hora: '06:00 - 09:00' });
    const repetido = await agregarH({ jornada: '  mañana ', hora: '06:00  -  09:00' });
    expect(repetido.status).toBe(409);
    expect(await Horario.countDocuments()).toBe(1);

    const distinto = await agregarH({ jornada: 'Mañana', hora: '10:00 - 12:00' });
    expect(distinto.status).toBe(201);
  });

  it('rechaza datos incompletos o demasiado largos, rutas inexistentes y no administradores', async () => {
    expect((await agregarH({ jornada: 'Mañana' })).status).toBe(400);
    expect((await agregarH({ hora: '06:00' })).status).toBe(400);
    expect((await agregarH({ jornada: 'x'.repeat(41), hora: '06:00' })).status).toBe(400);
    expect((await agregarH({ jornada: 'M', hora: 'x'.repeat(81) })).status).toBe(400);
    expect((await agregarH({ jornada: 'M', hora: '06:00' }, admin, 'NO-EXISTE')).status).toBe(404);
    expect((await agregarH({ jornada: 'M', hora: '06:00' }, conductor)).status).toBe(403);
  });

  it('al modificar un horario, el cambio queda disponible', async () => {
    const creado = (await agregarH({ jornada: 'Mañana', hora: '06:00' })).body;
    const res = await request(app)
      .put(`/api/horarios/${creado.id}`)
      .set(admin.auth)
      .send({ hora: '06:30 - 09:00' });
    expect(res.status).toBe(200);
    expect(res.body.hora).toBe('06:30 - 09:00');
    expect(res.body.jornada).toBe('Mañana');

    const publico = await request(app).get('/api/rutas/L1/horarios');
    expect(publico.body[0].hora).toBe('06:30 - 09:00');
  });

  it('no permite que una edición cree un duplicado ni dejar campos vacíos', async () => {
    await agregarH({ jornada: 'Mañana', hora: '06:00' });
    const otro = (await agregarH({ jornada: 'Tarde', hora: '14:00' })).body;
    const put = (cuerpo, quien = admin) =>
      request(app).put(`/api/horarios/${otro.id}`).set(quien.auth).send(cuerpo);

    expect((await put({ jornada: 'Mañana', hora: '06:00' })).status).toBe(409);
    expect((await put({ hora: '' })).status).toBe(400);
    expect((await put({ hora: '15:00' }, conductor)).status).toBe(403);
    // guardar sin cambios no cuenta como duplicado de sí mismo
    expect((await put({ jornada: 'Tarde', hora: '14:00' })).status).toBe(200);
    expect(
      (await request(app).put('/api/horarios/no-es-id').set(admin.auth).send({ hora: '1' })).status
    ).toBe(404);
  });

  it('elimina un horario', async () => {
    const creado = (await agregarH({ jornada: 'Mañana', hora: '06:00' })).body;
    expect((await request(app).delete(`/api/horarios/${creado.id}`).set(admin.auth)).status).toBe(204);
    expect(await Horario.countDocuments()).toBe(0);
    expect((await request(app).delete(`/api/horarios/${creado.id}`).set(admin.auth)).status).toBe(404);
    expect((await request(app).delete(`/api/horarios/${creado.id}`).set(conductor.auth)).status).toBe(403);
  });
});
