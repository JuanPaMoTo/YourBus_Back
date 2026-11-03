const { Schema, model, Types } = require('mongoose');

const TIPOS = ['accidente', 'bloqueo', 'clima', 'retraso', 'otro'];
const ESTADOS = ['activo', 'finalizado'];

// Un incidente es una afectación del servicio (accidente, bloqueo, clima, retraso...)
// asociada a una ruta. Lo reporta un conductor o el administrador y mientras está
// "activo" los pasajeros lo ven como aviso en la ruta y en la página de alertas.
const incidenteSchema = new Schema(
  {
    rutaId: { type: Types.ObjectId, ref: 'Ruta', required: true },
    tipo: { type: String, enum: TIPOS, required: true },
    descripcion: { type: String, required: true, trim: true, maxlength: 280 },
    estado: { type: String, enum: ESTADOS, default: 'activo' },
    reportadoPor: { type: Types.ObjectId, ref: 'Usuario', required: true },
    // Turno en curso del conductor al reportar (si lo había).
    turnoId: { type: Types.ObjectId, ref: 'Turno', default: null },
    finalizadoEn: { type: Date, default: null },
  },
  { timestamps: true }
);

incidenteSchema.index({ estado: 1, createdAt: -1 });
incidenteSchema.index({ rutaId: 1, estado: 1 });

const Incidente = model('Incidente', incidenteSchema);
Incidente.TIPOS = TIPOS;
Incidente.ESTADOS = ESTADOS;

module.exports = Incidente;
