// Datos en memoria para desarrollo. En un entorno real esto vendría de una
// base de datos (Azure SQL, Cosmos DB, etc.) por eso está aislado aquí.

const rutas = [
  { id: '1', codigo: 'L1', nombre: 'Terminal Norte - Centro' },
  { id: '2', codigo: 'L4', nombre: 'Universidad - Estación Central' },
  { id: '3', codigo: 'L9', nombre: 'Circunvalación Poniente' },
];

const paraderosPorRuta = {
  1: [
    { id: 'p1', nombre: 'Terminal Norte' },
    { id: 'p2', nombre: 'Av. Independencia' },
    { id: 'p3', nombre: 'Plaza Central' },
  ],
  2: [
    { id: 'p4', nombre: 'Universidad' },
    { id: 'p5', nombre: 'Biblioteca Pública' },
    { id: 'p6', nombre: 'Estación Central' },
  ],
  3: [
    { id: 'p7', nombre: 'Rotonda Poniente' },
    { id: 'p8', nombre: 'Parque Industrial' },
  ],
};

const horariosPorRuta = {
  1: [
    { id: 'h1', jornada: 'Mañana', hora: '06:00 - 09:00, cada 10 min' },
    { id: 'h2', jornada: 'Tarde', hora: '13:00 - 19:00, cada 15 min' },
  ],
  2: [
    { id: 'h3', jornada: 'Mañana', hora: '06:30 - 08:30, cada 8 min' },
    { id: 'h4', jornada: 'Noche', hora: '20:00 - 23:00, cada 20 min' },
  ],
  3: [{ id: 'h5', jornada: 'Todo el día', hora: 'cada 25 min' }],
};

const buses = new Map([
  ['BUS-101', { id: 'BUS-101', placa: 'ABCD-11', empresa: 'Transportes Norte', lat: -33.437, lng: -70.6505 }],
  ['BUS-102', { id: 'BUS-102', placa: 'EFGH-22', empresa: 'Transportes Norte', lat: -33.44, lng: -70.64 }],
]);

const etaPorParadero = {
  p1: 3,
  p2: 7,
  p3: 12,
  p4: 5,
};

module.exports = {
  rutas,
  paraderosPorRuta,
  horariosPorRuta,
  buses,
  etaPorParadero,
};
