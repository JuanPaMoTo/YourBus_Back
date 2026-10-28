const request = require('supertest');
const app = require('../src/app');
const { Usuario } = require('../src/models');
const { iniciarBase, cerrarBase } = require('./helpers/db');
const { crearCuenta } = require('./helpers/cuentas');

beforeAll(iniciarBase);
afterAll(cerrarBase);

const datosRegistro = {
  nombre: 'Ana Pérez',
  email: 'ana@correo.cl',
  password: 'una-clave-larga',
};

describe('POST /api/auth/registro', () => {
  it('crea un pasajero y devuelve token', async () => {
    const res = await request(app).post('/api/auth/registro').send(datosRegistro);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ nombre: 'Ana Pérez', rol: 'pasajero' });
  });

  it('nunca expone el hash de la contraseña', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ ...datosRegistro, email: 'otra@correo.cl' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('ignora un rol enviado por el cliente (no se puede auto-registrar como admin)', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ ...datosRegistro, email: 'astuto@correo.cl', rol: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('pasajero');
  });

  it('rechaza un correo repetido (sin distinguir mayúsculas)', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ ...datosRegistro, email: 'ANA@correo.cl' });
    expect(res.status).toBe(409);
  });

  it.each([
    ['nombre muy corto', { nombre: 'A' }],
    ['correo inválido', { email: 'no-es-correo' }],
    ['contraseña corta', { password: '1234567' }],
    ['contraseña de más de 72 bytes', { password: 'x'.repeat(73) }],
  ])('rechaza %s', async (_, cambio) => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ ...datosRegistro, email: 'nuevo@correo.cl', ...cambio });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('inicia sesión con credenciales correctas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'Ana@Correo.cl', password: datosRegistro.password });
    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe('ana@correo.cl');
  });

  it('da el mismo error con contraseña mala y con correo inexistente', async () => {
    const mala = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@correo.cl', password: 'incorrecta-123' });
    const noExiste = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fantasma@correo.cl', password: 'incorrecta-123' });
    expect(mala.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(mala.body.error).toBe(noExiste.body.error);
  });

  it('rechaza una cuenta desactivada', async () => {
    await Usuario.updateOne({ email: 'ana@correo.cl' }, { activo: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@correo.cl', password: datosRegistro.password });
    expect(res.status).toBe(403);
    await Usuario.updateOne({ email: 'ana@correo.cl' }, { activo: true });
  });

  it('exige correo y contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el usuario de la sesión', async () => {
    const { auth } = await crearCuenta('conductor');
    const res = await request(app).get('/api/auth/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('conductor');
  });

  it('rechaza sin token, con token falso y con cuenta desactivada', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/api/auth/me').set({ Authorization: 'Bearer falso' })).status
    ).toBe(401);

    const { usuario, auth } = await crearCuenta('pasajero', 'baja@correo.cl');
    await Usuario.updateOne({ _id: usuario._id }, { activo: false });
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(401);
  });
});

describe('Panel de usuarios (solo administrador)', () => {
  let admin;
  beforeAll(async () => {
    admin = await crearCuenta('admin');
  });

  it('un pasajero no puede listar ni crear usuarios', async () => {
    const pasajero = await crearCuenta('pasajero', 'p2@correo.cl');
    expect((await request(app).get('/api/usuarios').set(pasajero.auth)).status).toBe(403);
    const res = await request(app)
      .post('/api/usuarios')
      .set(pasajero.auth)
      .send({ ...datosRegistro, email: 'c@correo.cl', rol: 'conductor' });
    expect(res.status).toBe(403);
  });

  it('el admin crea un conductor y lo filtra por rol', async () => {
    const creado = await request(app)
      .post('/api/usuarios')
      .set(admin.auth)
      .send({ nombre: 'Carlos Ruiz', email: 'carlos@correo.cl', password: 'clave-conductor-1', rol: 'conductor' });
    expect(creado.status).toBe(201);
    expect(creado.body.rol).toBe('conductor');

    const lista = await request(app).get('/api/usuarios?rol=conductor').set(admin.auth);
    expect(lista.body.map((u) => u.email)).toContain('carlos@correo.cl');
    expect(lista.body.every((u) => u.rol === 'conductor')).toBe(true);
  });

  it('valida el rol y el filtro', async () => {
    const malRol = await request(app)
      .post('/api/usuarios')
      .set(admin.auth)
      .send({ nombre: 'Rol Raro', email: 'raro@correo.cl', password: 'clave-larga-123', rol: 'dios' });
    expect(malRol.status).toBe(400);
    expect((await request(app).get('/api/usuarios?rol=dios').set(admin.auth)).status).toBe(400);
  });

  it('activa/desactiva cuentas, pero no la propia', async () => {
    const otro = await crearCuenta('conductor', 'otro@correo.cl');
    const baja = await request(app)
      .patch(`/api/usuarios/${otro.usuario._id}`)
      .set(admin.auth)
      .send({ activo: false });
    expect(baja.status).toBe(200);
    expect(baja.body.activo).toBe(false);

    const propia = await request(app)
      .patch(`/api/usuarios/${admin.usuario._id}`)
      .set(admin.auth)
      .send({ activo: false });
    expect(propia.status).toBe(409);

    expect(
      (await request(app).patch('/api/usuarios/no-es-id').set(admin.auth).send({ activo: true })).status
    ).toBe(404);
    expect(
      (await request(app).patch(`/api/usuarios/${otro.usuario._id}`).set(admin.auth).send({ activo: 'si' })).status
    ).toBe(400);
  });
});
