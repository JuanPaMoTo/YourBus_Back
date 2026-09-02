const { Schema, model } = require('mongoose');

const rutaSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    estado: {
      type: String,
      enum: ['operativa', 'suspendida', 'con_desvio'],
      default: 'operativa',
    },
  },
  { timestamps: true }
);

module.exports = model('Ruta', rutaSchema);
