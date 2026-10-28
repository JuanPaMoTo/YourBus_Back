// Datos de ejemplo del sistema (rutas, paraderos con coordenadas, horarios y buses).
// Los usa `npm run db:seed` y el arranque automático cuando la base está vacía.
// Las coordenadas son aproximadas (Santiago de Chile) y sirven para la demo.
const { Ruta, Paradero, Horario, Bus, Turno } = require('./models');

const RUTAS = [
  {
    codigo: 'L1',
    nombre: 'Terminal Norte - Centro',
    paraderos: [
      { nombre: 'Terminal Norte', lat: -33.4015, lng: -70.6545 },
      { nombre: 'Av. Independencia', lat: -33.4207, lng: -70.6525 },
      { nombre: 'Plaza Central', lat: -33.4372, lng: -70.6506 },
    ],
    horarios: [
      { jornada: 'Mañana', hora: '06:00 - 09:00, cada 10 min' },
      { jornada: 'Tarde', hora: '13:00 - 19:00, cada 15 min' },
    ],
  },
  {
    codigo: 'L4',
    nombre: 'Universidad - Estación Central',
    paraderos: [
      { nombre: 'Universidad', lat: -33.441, lng: -70.6397 },
      { nombre: 'Biblioteca Pública', lat: -33.4427, lng: -70.6444 },
      { nombre: 'Estación Central', lat: -33.4528, lng: -70.6783 },
    ],
    horarios: [
      { jornada: 'Mañana', hora: '06:30 - 08:30, cada 8 min' },
      { jornada: 'Noche', hora: '20:00 - 23:00, cada 20 min' },
    ],
  },
  {
    codigo: 'L9',
    nombre: 'Circunvalación Poniente',
    paraderos: [
      { nombre: 'Rotonda Poniente', lat: -33.452, lng: -70.7 },
      { nombre: 'Parque Industrial', lat: -33.465, lng: -70.705 },
    ],
    horarios: [{ jornada: 'Todo el día', hora: 'cada 25 min' }],
  },
];

const BUSES = [
  { placa: 'ABCD-11', empresa: 'Transportes Norte', ruta: 'L1' },
  { placa: 'EFGH-22', empresa: 'Transportes Norte', ruta: 'L1' },
  { placa: 'IJKL-33', empresa: 'Buses Centro', ruta: 'L4' },
];

async function limpiarDatosBase() {
  await Promise.all([
    Ruta.deleteMany({}),
    Paradero.deleteMany({}),
    Horario.deleteMany({}),
    Bus.deleteMany({}),
    Turno.deleteMany({}),
  ]);
}

// Inserta los datos de ejemplo. Devuelve las rutas y buses creados por código/placa.
async function sembrarDatosBase() {
  const rutas = {};
  for (const datos of RUTAS) {
    const ruta = await Ruta.create({ codigo: datos.codigo, nombre: datos.nombre });
    rutas[datos.codigo] = ruta;
    await Paradero.insertMany(
      datos.paraderos.map((p, i) => ({ ...p, orden: i + 1, rutaId: ruta._id }))
    );
    await Horario.insertMany(datos.horarios.map((h) => ({ ...h, rutaId: ruta._id })));
  }

  const buses = {};
  for (const datos of BUSES) {
    buses[datos.placa] = await Bus.create({
      placa: datos.placa,
      empresa: datos.empresa,
      rutaId: rutas[datos.ruta]._id,
    });
  }
  return { rutas, buses };
}

module.exports = { limpiarDatosBase, sembrarDatosBase };
