// Tareas de arranque: dejan el sistema usable sin tocar la base a mano.
const config = require('./config/env');
const { Ruta, Usuario } = require('./models');
const { sembrarDatosBase } = require('./seedData');
const { crearUsuario } = require('./controllers/auth.controller');

// Si la base no tiene rutas y AUTO_SEED=true, carga los datos de ejemplo.
async function sembrarSiVacio() {
  if (!config.autoSeed) return false;
  if ((await Ruta.estimatedDocumentCount()) > 0) return false;
  await sembrarDatosBase();
  console.log('Base vacía: se cargaron las rutas, paraderos, horarios y buses de ejemplo.');
  return true;
}

// Crea el administrador inicial a partir de ADMIN_EMAIL / ADMIN_PASSWORD.
async function crearAdminInicial() {
  if (!config.adminEmail || !config.adminPassword) return false;
  if (await Usuario.exists({ email: config.adminEmail })) return false;
  await crearUsuario({
    nombre: 'Administrador',
    email: config.adminEmail,
    password: config.adminPassword,
    rol: 'admin',
  });
  console.log(`Administrador inicial creado (${config.adminEmail}).`);
  return true;
}

async function inicializarDatos() {
  await sembrarSiVacio();
  try {
    await crearAdminInicial();
  } catch (err) {
    // Una contraseña inválida no debe impedir que la API arranque.
    console.error('No se pudo crear el administrador inicial:', err.message);
  }
}

module.exports = { inicializarDatos, sembrarSiVacio, crearAdminInicial };
