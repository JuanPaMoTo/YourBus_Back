const { Schema, model } = require('mongoose');

const ROLES = ['pasajero', 'conductor', 'admin'];

const usuarioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select:false → nunca viaja en consultas normales; solo se pide al hacer login.
    passwordHash: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, default: 'pasajero', required: true },
    activo: { type: Boolean, default: true },
    ultimoLogin: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

const Usuario = model('Usuario', usuarioSchema);
Usuario.ROLES = ROLES;

module.exports = Usuario;
