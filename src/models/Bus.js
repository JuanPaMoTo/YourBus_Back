const { Schema, model, Types } = require('mongoose');

const busSchema = new Schema(
  {
    placa: { type: String, required: true, unique: true, uppercase: true, trim: true },
    empresa: { type: String, required: true, trim: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    rutaId: { type: Types.ObjectId, ref: 'Ruta', default: null },
  },
  { timestamps: true }
);

module.exports = model('Bus', busSchema);
