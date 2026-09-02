const express = require('express');
const corsMiddleware = require('./middleware/cors');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const rutasRoutes = require('./routes/rutas.routes');
const busesRoutes = require('./routes/buses.routes');

const app = express();

app.use(corsMiddleware);
app.use(express.json());

// Usado por Azure (App Service / AKS) para comprobar que el contenedor está vivo
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'yourbus-back' });
});

app.use('/api', rutasRoutes);
app.use('/api', busesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
