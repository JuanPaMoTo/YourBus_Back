// Pobla la base con datos de ejemplo y cuentas de demostración.
// Uso: node src/seed.js   (npm run db:seed)
// Requiere MONGODB_URI en el entorno (o en .env), apuntando a la base
// del entorno que quieras poblar (DEV/QA/PROD son bases distintas).
//
// Borra rutas, paraderos, horarios, buses y turnos, y los vuelve a crear.
// Las cuentas (admin, conductor y pasajero de demo) se crean si no existen;
// las contraseñas salen de ADMIN_PASSWORD / DEMO_PASSWORD o, si no están
// definidas, se generan al azar y se imprimen una sola vez.
const crypto = require('crypto');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');
const { Usuario, Turno } = require('./models');
const { limpiarDatosBase, sembrarDatosBase } = require('./seedData');
const { crearUsuario } = require('./controllers/auth.controller');
const { hoy } = require('./utils/fechas');

const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

async function asegurarUsuario(datos) {
  const email = datos.email.toLowerCase();
  const existente = await Usuario.findOne({ email });
  if (existente) return { usuario: existente, creado: false };
  const password = datos.password || crypto.randomBytes(9).toString('base64url');
  const usuario = await crearUsuario({ ...datos, email, password });
  return { usuario, creado: true, password };
}

async function seed() {
  await connectDB();
  console.log('Conectado. Limpiando datos de ejemplo...');
  await limpiarDatosBase();
  const { rutas, buses } = await sembrarDatosBase();

  const cuentas = [
    {
      nombre: 'Administrador',
      email: config.adminEmail || 'admin@yourbus.cl',
      password: config.adminPassword,
      rol: 'admin',
    },
    { nombre: 'Conductor Demo', email: 'conductor@yourbus.cl', password: process.env.DEMO_PASSWORD, rol: 'conductor' },
    { nombre: 'Pasajero Demo', email: 'pasajero@yourbus.cl', password: process.env.DEMO_PASSWORD, rol: 'pasajero' },
  ];
  const usuarios = {};
  for (const cuenta of cuentas) {
    const r = await asegurarUsuario(cuenta);
    usuarios[cuenta.rol] = r.usuario;
    console.log(
      r.creado
        ? `Cuenta creada: ${cuenta.email} (${cuenta.rol}) — contraseña: ${r.password}`
        : `Cuenta existente: ${cuenta.email} (${cuenta.rol})`
    );
  }

  // Turnos de ejemplo para el conductor de demo: hoy y los dos días siguientes.
  const fecha = hoy(config.tzOperacion);
  const turnos = [
    [0, 'L1', 'ABCD-11', '08:00', '12:00'],
    [0, 'L4', 'IJKL-33', '14:00', '18:00'],
    [1, 'L1', 'ABCD-11', '08:00', '12:00'],
    [2, 'L4', 'IJKL-33', '09:00', '13:00'],
  ].map(([dia, ruta, placa, horaInicio, horaFin]) => ({
    conductorId: usuarios.conductor._id,
    rutaId: rutas[ruta]._id,
    busId: buses[placa]._id,
    fecha: sumarDias(fecha, dia),
    horaInicio,
    horaFin,
  }));
  await Turno.insertMany(turnos);

  console.log('Datos de ejemplo insertados correctamente.');
  await disconnectDB();
}

seed().catch((err) => {
  console.error('Error al poblar la base:', err);
  process.exit(1);
});
