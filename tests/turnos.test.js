const request = require('supertest');
const app = require('../src/app');
const { Ruta, Bus } = require('../src/models');
const { iniciarBase, cerrarBase } = require('./helpers/db');
const { crearCuenta } = require('./helpers/cuentas');

let admin;
let conductor;
let otroConductor;
let ruta;
let bus;
let bus2;

beforeAll(async () => {
  await iniciarBase();
  admin = await crearCuenta('admin');
  conductor = await crearCuenta('conductor');
  otroConductor = await crearCuenta('conductor', 'otro@prueba.cl');
  ruta = await Ruta.create({ codigo: 'L1', nombre: 'Terminal Norte - Centro' });
  bus = await Bus.create({ placa: 'AAAA-11', empresa: 'Norte' });
  bus2 = await Bus.create({ placa: 'BBBB-22', empresa: 'Norte' });
});

afterAll(cerrarBase);

const turnoBase = () => ({
  conductorId: String(conductor.usuario._id),
  rutaId: String(ruta._id),
  busId: String(bus._id),
  fecha: '2026-11-02',
  horaInicio: '08:00',
  horaFin: '12:00',
});

const crear = (cambios = {}, quien = admin) =>
  request(app)
    .post('/api/turnos')
    .set(quien.auth)
    .send({ ...turnoBase(), ...cambios });

describe('Crear turnos (administrador)', () => {
  it('crea un turno y devuelve conductor, ruta y bus legibles', async () => {
    const res = await crear();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fecha: '2026-11-02',
      horaInicio: '08:00',
      estado: 'programado',
      ruta: { codigo: 'L1' },
      bus: { placa: 'AAAA-11' },
      conductor: { nombre: 'Usuario conductor' },
    });
  });

  it('un conductor o pasajero no puede crear turnos', async () => {
    expect((await crear({}, conductor)).status).toBe(403);
    const pasajero = await crearCuenta('pasajero');
    expect((await crear({}, pasajero)).status).toBe(403);
    expect((await request(app).post('/api/turnos').send(turnoBase())).status).toBe(401);
  });

  it('rechaza a un conductor que ya tiene un turno que se cruza', async () => {
    const res = await crear({ busId: String(bus2._id), horaInicio: '11:00', horaFin: '14:00' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/conductor/i);
  });

  it('rechaza un bus ya ocupado en ese horario', async () => {
    const res = await crear({
      conductorId: String(otroConductor.usuario._id),
      horaInicio: '10:00',
      horaFin: '13:00',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/bus/i);
  });

  it('acepta turnos consecutivos (uno termina cuando empieza el otro)', async () => {
    const res = await crear({ horaInicio: '12:00', horaFin: '16:00' });
    expect(res.status).toBe(201);
  });

  it.each([
    ['fecha inexistente', { fecha: '2026-02-31' }],
    ['fecha con otro formato', { fecha: '02/11/2026' }],
    ['hora inválida', { horaInicio: '25:00' }],
    ['fin antes del inicio', { horaInicio: '15:00', horaFin: '09:00' }],
    ['conductor que no existe', { conductorId: '64b64b64b64b64b64b64b64b' }],
    ['conductor con rol administrador', { conductorId: 'ADMIN' }],
    ['ruta que no existe', { rutaId: '64b64b64b64b64b64b64b64b' }],
    ['id mal formado', { busId: 'xyz' }],
  ])('rechaza %s', async (_, cambio) => {
    const cuerpo = { fecha: '2026-12-01', ...cambio };
    if (cuerpo.conductorId === 'ADMIN') cuerpo.conductorId = String(admin.usuario._id);
    const res = await crear(cuerpo);
    expect(res.status).toBe(400);
  });
});

describe('Listar, editar y borrar', () => {
  it('el admin filtra por rango de fechas y conductor', async () => {
    const res = await request(app)
      .get(`/api/turnos?desde=2026-11-01&hasta=2026-11-30&conductorId=${conductor.usuario._id}`)
      .set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].horaInicio <= res.body[1].horaInicio).toBe(true);
  });

  it('valida los filtros', async () => {
    expect((await request(app).get('/api/turnos?desde=ayer').set(admin.auth)).status).toBe(400);
    expect((await request(app).get('/api/turnos?estado=raro').set(admin.auth)).status).toBe(400);
    expect((await request(app).get('/api/turnos?rutaId=zz').set(admin.auth)).status).toBe(400);
  });

  it('el conductor solo ve SUS turnos', async () => {
    await crear({ conductorId: String(otroConductor.usuario._id), busId: String(bus2._id), fecha: '2026-11-03' });
    const mios = await request(app).get('/api/turnos/mios').set(conductor.auth);
    expect(mios.status).toBe(200);
    expect(mios.body.length).toBe(2);
    expect(mios.body.every((t) => t.conductor.id === String(conductor.usuario._id))).toBe(true);

    const delOtro = await request(app).get('/api/turnos/mios').set(otroConductor.auth);
    expect(delOtro.body.length).toBe(1);
    expect((await request(app).get('/api/turnos/mios').set(admin.auth)).status).toBe(403);
  });

  it('edita un turno programado y vuelve a validar los cruces', async () => {
    const [primero] = (await request(app).get('/api/turnos?hasta=2026-11-02').set(admin.auth)).body;
    const ok = await request(app).put(`/api/turnos/${primero.id}`).set(admin.auth).send({ horaFin: '11:30' });
    expect(ok.status).toBe(200);
    expect(ok.body.horaFin).toBe('11:30');

    const cruce = await request(app).put(`/api/turnos/${primero.id}`).set(admin.auth).send({ horaFin: '13:00' });
    expect(cruce.status).toBe(409);
  });

  it('cancela y elimina turnos', async () => {
    const creado = await crear({ fecha: '2026-11-09' });
    const cancelado = await request(app).post(`/api/turnos/${creado.body.id}/cancelar`).set(admin.auth);
    expect(cancelado.body.estado).toBe('cancelado');
    // un turno cancelado ya no bloquea el horario
    expect((await crear({ fecha: '2026-11-09' })).status).toBe(201);
    // y no se puede editar ni cancelar de nuevo
    expect((await request(app).put(`/api/turnos/${creado.body.id}`).set(admin.auth).send({})).status).toBe(409);

    expect((await request(app).delete(`/api/turnos/${creado.body.id}`).set(admin.auth)).status).toBe(204);
    expect((await request(app).delete(`/api/turnos/${creado.body.id}`).set(admin.auth)).status).toBe(404);
  });
});
