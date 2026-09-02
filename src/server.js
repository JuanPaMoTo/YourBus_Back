const app = require('./app');
const config = require('./config/env');

app.listen(config.port, () => {
  console.log(`YourBus_Back escuchando en el puerto ${config.port} (${config.env})`);
  console.log(`CORS habilitado para: ${config.corsOrigins.join(', ')}`);
});
