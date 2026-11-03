const request = require('supertest');
const app = require('../src/app');
const { Ruta, Bus, Turno, Incidente } = require('../src/models');
const { iniciarBase, cerrarBase } = require('./helpers/db');
const { crearCuenta } = require('./helpers/cuentas');

let admin;
let conductor;
let pasajero;
let rutaL1;
let rutaL2;
let bus;

beforeAll(async () => {
  await iniciarBase();
  admin = await crearCuenta('admin');
  conductor = await crearCuenta('conductor');
  pasajero = await crearCuenta('pasajero');
  rutaL1 = await Ruta.create({ codigo: 'L1', nombre: 'Terminal Norte - Centro' });
  rutaL2 = await Ruta.create({ codigo: 'L2', nombre: 'Centro - Sur' });
  bus = await Bus.create({ placa: 'AAAA-11', empresa: 'Norte' });
});

afterAll(cerrarBase);

beforeEach(async () => {
  await Incidente.deleteMany({});
  await Turno.deleteMany({});
});

const reportar = (cuerpo, quien = conductor) =>
  request(app).post('/api/incidentes').set(quien.auth).send(cuerpo);

const crearIncidente = (cambios = {}) =>
  Incidente.create({
    rutaId: rutaL1._id,
    tipo: 'bloqueo',
    descripcion: 'Calle cerrada por obras',
    reportadoPor: conductor.usuario._id,
    ...cambios,
  });

const iniciarRecorrido = (ruta = rutaL1) =>
  Turno.create({
    conductorId: conductor.usuario._id,
    rutaId: ruta._id,
    busId: bus._id,
    fecha: '2026-11-02',
    horaInicio: '08:00',
    horaFin: '12:00',
    estado: 'en_curso',
  });

describe('POST /api/incidentes (HU14)', () => {
  it('el conductor registra un incidente con su categoría y queda almacenado', async () => {
    const res = await reportar({ rutaId: 'L1', tipo: 'accidente', descripcion: 'Choque en la Av. Norte' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      tipo: 'accidente',
      descripcion: 'Choque en la Av. Norte',
      estado: 'activo',
      ruta: { codigo: 'L1' },
      reportadoPor: { nombre: 'Usuario conductor' },
    });
    expect(await Incidente.countDocuments()).toBe(1);
  });

  it('acepta el id de la ruta además del código', async () => {
    const res = await reportar({ rutaId: String(rutaL2._id), tipo: 'clima', descripcion: 'Lluvia fuerte' });
    expect(res.status).toBe(201);
    expect(res.body.ruta.codigo).toBe('L2');
  });

  it('sin ruta usa la del recorrido en curso del conductor', async () => {
    const turno = await iniciarRecorrido(rutaL2);
    const res = await reportar({ tipo: 'retraso', descripcion: 'Tráfico pesado' });
    expect(res.status).toBe(201);
    expect(res.body.ruta.codigo).toBe('L2');
    const guardado = await Incidente.findById(res.body.id);
    expect(String(guardado.turnoId)).toBe(String(turno._id));
  });

  it('sin ruta y sin recorrido en curso devuelve 400', async () => {
    const res = await reportar({ tipo: 'retraso', descripcion: 'Tráfico pesado' });
    expect(res.status).toBe(400);
  });

  it('rechaza si falta información obligatoria', async () => {
    expect((await reportar({ rutaId: 'L1', tipo: 'accidente' })).status).toBe(400);
    expect((await reportar({ rutaId: 'L1', tipo: 'accidente', descripcion: '   ' })).status).toBe(400);
    expect((await reportar({ rutaId: 'L1', descripcion: 'Algo pasó' })).status).toBe(400);
    expect(await Incidente.countDocuments()).toBe(0);
  });

  it('rechaza tipos desconocidos, rutas inexistentes y descripciones demasiado largas', async () => {
    expect((await reportar({ rutaId: 'L1', tipo: 'ovni', descripcion: 'x' })).status).toBe(400);
    expect((await reportar({ rutaId: 'NO-EXISTE', tipo: 'otro', descripcion: 'x' })).status).toBe(400);
    expect(
      (await reportar({ rutaId: 'L1', tipo: 'otro', descripcion: 'x'.repeat(281) })).status
    ).toBe(400);
  });

  it('no se deja engañar por un operador de Mongo en rutaId', async () => {
    const res = await reportar({ rutaId: { $ne: null }, tipo: 'otro', descripcion: 'x' });
    expect(res.status).toBe(400);
  });

  it('el administrador también puede registrar incidentes', async () => {
    const res = await reportar({ rutaId: 'L1', tipo: 'bloqueo', descripcion: 'Desvío por obras' }, admin);
    expect(res.status).toBe(201);
  });

  it('exige sesión y no permite reportar a un pasajero', async () => {
    const sinSesion = await request(app).post('/api/incidentes').send({});
    expect(sinSesion.status).toBe(401);
    const res = await reportar({ rutaId: 'L1', tipo: 'otro', descripcion: 'x' }, pasajero);
    expect(res.status).toBe(403);
  });
});

describe('Consulta pública de avisos (HU08 y HU07)', () => {
  it('GET /api/incidentes/activos lista solo los activos, sin datos del conductor', async () => {
    await crearIncidente();
    await crearIncidente({ tipo: 'retraso', descripcion: 'Retraso de 15 min', rutaId: rutaL2._id });
    await crearIncidente({ estado: 'finalizado', finalizadoEn: new Date() });

    const res = await request(app).get('/api/incidentes/activos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((i) => i.estado === 'activo')).toBe(true);
    expect(res.body[0]).not.toHaveProperty('reportadoPor');
    expect(res.body.map((i) => i.tipo).sort()).toEqual(['bloqueo', 'retraso']);
  });

  it('GET /api/rutas/:rutaId/incidentes muestra la afectación solo de esa ruta (HU16)', async () => {
    await crearIncidente();
    await crearIncidente({ rutaId: rutaL2._id, descripcion: 'Otra ruta' });

    const res = await request(app).get('/api/rutas/L1/incidentes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].ruta.codigo).toBe('L1');
  });

  it('devuelve lista vacía si la ruta no tiene avisos y 404 si no existe', async () => {
    const vacia = await request(app).get('/api/rutas/L2/incidentes');
    expect(vacia.status).toBe(200);
    expect(vacia.body).toEqual([]);
    expect((await request(app).get('/api/rutas/NO-EXISTE/incidentes')).status).toBe(404);
  });
});

describe('GET /api/incidentes (HU15)', () => {
  it('el administrador ve los incidentes con quién los reportó', async () => {
    await crearIncidente();
    await crearIncidente({ estado: 'finalizado', finalizadoEn: new Date() });

    const todos = await request(app).get('/api/incidentes').set(admin.auth);
    expect(todos.status).toBe(200);
    expect(todos.body).toHaveLength(2);
    expect(todos.body[0].reportadoPor).toHaveProperty('nombre');

    const activos = await request(app).get('/api/incidentes?estado=activo').set(admin.auth);
    expect(activos.body).toHaveLength(1);
    const finalizados = await request(app).get('/api/incidentes?estado=finalizado').set(admin.auth);
    expect(finalizados.body).toHaveLength(1);
  });

  it('rechaza estados inválidos y a quien no es administrador', async () => {
    expect((await request(app).get('/api/incidentes?estado=raro').set(admin.auth)).status).toBe(400);
    expect((await request(app).get('/api/incidentes').set(conductor.auth)).status).toBe(403);
    expect((await request(app).get('/api/incidentes')).status).toBe(401);
  });
});

describe('PATCH /api/incidentes/:id/estado (HU16)', () => {
  const cambiar = (id, estado, quien = admin) =>
    request(app).patch(`/api/incidentes/${id}/estado`).set(quien.auth).send({ estado });

  it('al finalizar deja de aparecer como activo', async () => {
    const inc = await crearIncidente();
    const res = await cambiar(inc._id, 'finalizado');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('finalizado');
    expect(res.body.finalizadoEn).toBeTruthy();

    const activos = await request(app).get('/api/incidentes/activos');
    expect(activos.body).toHaveLength(0);
  });

  it('puede reactivarse y limpia la fecha de cierre', async () => {
    const inc = await crearIncidente({ estado: 'finalizado', finalizadoEn: new Date() });
    const res = await cambiar(inc._id, 'activo');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('activo');
    expect(res.body.finalizadoEn).toBeNull();
  });

  it('valida el estado, el id y los permisos', async () => {
    const inc = await crearIncidente();
    expect((await cambiar(inc._id, 'raro')).status).toBe(400);
    expect((await cambiar('no-es-un-id', 'activo')).status).toBe(404);
    expect((await cambiar('64b7f0c2e1d3a4b5c6d7e8f9', 'activo')).status).toBe(404);
    expect((await cambiar(inc._id, 'finalizado', conductor)).status).toBe(403);
    const sinSesion = await request(app).patch(`/api/incidentes/${inc._id}/estado`).send({ estado: 'activo' });
    expect(sinSesion.status).toBe(401);
  });
});
