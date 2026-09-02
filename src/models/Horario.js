const { Schema, model, Types } = require('mongoose');

const horarioSchema = new Schema(
  {
    jornada: { type: String, required: true, trim: true },
    hora: { type: String, required: true, trim: true },
    rutaId: { type: Types.ObjectId, ref: 'Ruta', required: true },
  },
  { timestamps: true }
);

horarioSchema.index({ rutaId: 1 });

module.exports = model('Horario', horarioSchema);
