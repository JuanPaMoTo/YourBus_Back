// Pobla la base con datos de ejemplo. Uso: node src/seed.js
// Requiere MONGODB_URI en el entorno (o en .env), apuntando a la base
// del entorno que quieras poblar (DEV/QA/PROD son bases distintas).
const { connectDB, disconnectDB } = require('./config/database');
const { Ruta, Paradero, Horario, Bus } = require('./models');

async function seed() {
  await connectDB();
  console.log('Conectado. Limpiando colecciones...');

  await Promise.all([
    Ruta.deleteMany({}),
    Paradero.deleteMany({}),
    Horario.deleteMany({}),
    Bus.deleteMany({}),
  ]);

  const [l1, l4, l9] = await Ruta.insertMany([
    { codigo: 'L1', nombre: 'Terminal Norte - Centro' },
    { codigo: 'L4', nombre: 'Universidad - Estación Central' },
    { codigo: 'L9', nombre: 'Circunvalación Poniente' },
  ]);

  await Paradero.insertMany([
    { nombre: 'Terminal Norte', orden: 1, rutaId: l1._id },
    { nombre: 'Av. Independencia', orden: 2, rutaId: l1._id },
    { nombre: 'Plaza Central', orden: 3, rutaId: l1._id },
    { nombre: 'Universidad', orden: 1, rutaId: l4._id },
    { nombre: 'Biblioteca Pública', orden: 2, rutaId: l4._id },
    { nombre: 'Estación Central', orden: 3, rutaId: l4._id },
    { nombre: 'Rotonda Poniente', orden: 1, rutaId: l9._id },
    { nombre: 'Parque Industrial', orden: 2, rutaId: l9._id },
  ]);

  await Horario.insertMany([
    { jornada: 'Mañana', hora: '06:00 - 09:00, cada 10 min', rutaId: l1._id },
    { jornada: 'Tarde', hora: '13:00 - 19:00, cada 15 min', rutaId: l1._id },
    { jornada: 'Mañana', hora: '06:30 - 08:30, cada 8 min', rutaId: l4._id },
    { jornada: 'Noche', hora: '20:00 - 23:00, cada 20 min', rutaId: l4._id },
    { jornada: 'Todo el día', hora: 'cada 25 min', rutaId: l9._id },
  ]);

  await Bus.insertMany([
    { placa: 'ABCD-11', empresa: 'Transportes Norte', lat: -33.437, lng: -70.6505, rutaId: l1._id },
    { placa: 'EFGH-22', empresa: 'Transportes Norte', lat: -33.44, lng: -70.64, rutaId: l1._id },
  ]);

  console.log('Datos de ejemplo insertados correctamente.');
  await disconnectDB();
}

seed().catch((err) => {
  console.error('Error al poblar la base:', err);
  process.exit(1);
});
