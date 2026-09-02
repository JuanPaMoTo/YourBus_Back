const { Schema, model, Types } = require('mongoose');

const paraderoSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    orden: { type: Number, required: true },
    rutaId: { type: Types.ObjectId, ref: 'Ruta', required: true },
  },
  { timestamps: true }
);

paraderoSchema.index({ rutaId: 1, orden: 1 });

module.exports = model('Paradero', paraderoSchema);
