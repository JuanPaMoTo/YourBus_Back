const express = require('express');
const corsMiddleware = require('./middleware/cors');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const rutasRoutes = require('./routes/rutas.routes');
const busesRoutes = require('./routes/buses.routes');
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const turnosRoutes = require('./routes/turnos.routes');

const app = express();

// Azure App Service y Vercel van detrás de un proxy: necesario para ver la IP real
// del cliente (límite de intentos de login).
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));

// Usado por Azure (App Service / AKS) para comprobar que el contenedor está vivo
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'yourbus-back' });
});

app.use('/api', authRoutes);
app.use('/api', usuariosRoutes);
app.use('/api', turnosRoutes);
app.use('/api', rutasRoutes);
app.use('/api', busesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
