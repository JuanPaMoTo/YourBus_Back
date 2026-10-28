const { Schema, model, Types } = require('mongoose');

const ESTADOS = ['programado', 'en_curso', 'completado', 'cancelado'];

// Un turno es "el conductor X maneja el bus Y por la ruta Z el día D de H1 a H2".
// Mientras está en curso guarda además la última posición GPS (polling).
const turnoSchema = new Schema(
  {
    conductorId: { type: Types.ObjectId, ref: 'Usuario', required: true },
    rutaId: { type: Types.ObjectId, ref: 'Ruta', required: true },
    busId: { type: Types.ObjectId, ref: 'Bus', required: true },
    // Fecha y horas como texto ("2026-10-27", "08:30") para evitar problemas de
    // zona horaria: son hora local de operación, no instantes UTC.
    fecha: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    horaInicio: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    horaFin: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    estado: { type: String, enum: ESTADOS, default: 'programado' },
    inicioReal: { type: Date, default: null },
    finReal: { type: Date, default: null },
    // Orden del último paradero al que llegó el bus (0 = aún no sale).
    ultimoParaderoOrden: { type: Number, default: 0 },
    ubicacion: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      velocidad: { type: Number, default: null }, // m/s, si el dispositivo lo informa
      rumbo: { type: Number, default: null }, // grados
      precision: { type: Number, default: null }, // metros
      actualizado: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

turnoSchema.index({ conductorId: 1, fecha: 1 });
turnoSchema.index({ busId: 1, fecha: 1 });
turnoSchema.index({ rutaId: 1, estado: 1 });

const Turno = model('Turno', turnoSchema);
Turno.ESTADOS = ESTADOS;

module.exports = Turno;
