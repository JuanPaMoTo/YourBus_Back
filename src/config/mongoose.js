const mongoose = require('mongoose');

// Todas las respuestas JSON incluyen "id" (además de "_id") y sin "__v".
// El front usa `ruta.id`; sin esto llegaba `undefined`.
// Debe ejecutarse antes de declarar los esquemas (por eso models/index.js
// lo importa en su primera línea).
mongoose.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose;
