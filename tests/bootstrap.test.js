const config = require('../src/config/env');
const { Ruta, Paradero, Usuario } = require('../src/models');
const { sembrarSiVacio, crearAdminInicial, inicializarDatos } = require('../src/bootstrap');
const { iniciarBase, cerrarBase } = require('./helpers/db');

beforeAll(iniciarBase);
afterAll(cerrarBase);

describe('arranque automático', () => {
  const original = { ...config };
  afterEach(() => Object.assign(config, original));

  it('no siembra si AUTO_SEED no está activado', async () => {
    config.autoSeed = false;
    expect(await sembrarSiVacio()).toBe(false);
    expect(await Ruta.countDocuments()).toBe(0);
  });

  it('siembra rutas, paraderos con coordenadas, horarios y buses si la base está vacía', async () => {
    config.autoSeed = true;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(await sembrarSiVacio()).toBe(true);
    log.mockRestore();
    expect(await Ruta.countDocuments()).toBe(3);
    const sinCoordenadas = await Paradero.countDocuments({ lat: null });
    expect(sinCoordenadas).toBe(0);
  });

  it('no vuelve a sembrar (no pisa datos existentes)', async () => {
    config.autoSeed = true;
    expect(await sembrarSiVacio()).toBe(false);
    expect(await Ruta.countDocuments()).toBe(3);
  });

  it('crea el administrador inicial una sola vez', async () => {
    config.adminEmail = 'jefe@terminal.cl';
    config.adminPassword = 'clave-del-jefe-1';
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(await crearAdminInicial()).toBe(true);
    expect(await crearAdminInicial()).toBe(false);
    log.mockRestore();
    const admin = await Usuario.findOne({ email: 'jefe@terminal.cl' });
    expect(admin.rol).toBe('admin');
  });

  it('sin variables de admin no crea nada', async () => {
    config.adminEmail = '';
    config.adminPassword = '';
    expect(await crearAdminInicial()).toBe(false);
  });

  it('una contraseña inválida no detiene el arranque', async () => {
    config.autoSeed = false;
    config.adminEmail = 'otro@terminal.cl';
    config.adminPassword = 'corta';
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(inicializarDatos()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('configuración', () => {
  const cargar = (variables) => {
    const previo = { ...process.env };
    jest.resetModules();
    Object.assign(process.env, variables);
    try {
      return require('../src/config/env');
    } finally {
      process.env = previo;
    }
  };

  it('en producción exige un JWT_SECRET largo', () => {
    expect(() => cargar({ NODE_ENV: 'production', JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
    expect(() => cargar({ NODE_ENV: 'production', JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('rechaza la variable sin resolver del pipeline ("$(JWT_SECRET)")', () => {
    expect(() => cargar({ NODE_ENV: 'qa', JWT_SECRET: '$(JWT_SECRET)-xxxxxxxxxxxxx' })).toThrow(/JWT_SECRET/);
  });

  it('con un secreto válido arranca', () => {
    const cfg = cargar({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) });
    expect(cfg.jwtSecret).toBe('x'.repeat(32));
  });

  it('en desarrollo genera un secreto aleatorio', () => {
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const cfg = cargar({ NODE_ENV: 'development', JWT_SECRET: '' });
    aviso.mockRestore();
    expect(cfg.jwtSecret).toHaveLength(64);
  });
});
