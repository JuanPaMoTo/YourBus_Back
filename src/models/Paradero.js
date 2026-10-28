const { Schema, model, Types } = require('mongoose');

const paraderoSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    orden: { type: Number, required: true },
    rutaId: { type: Types.ObjectId, ref: 'Ruta', required: true },
    // Coordenadas del paradero: necesarias para calcular el ETA por calles.
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { timestamps: true }
);

paraderoSchema.index({ rutaId: 1, orden: 1 });

module.exports = model('Paradero', paraderoSchema);
