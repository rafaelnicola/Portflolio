const express = require('express');
const cors = require('cors');
const os = require('os');

require('./db');

const usuariosRouter = require('./routes/usuarios');
const pacientesRouter = require('./routes/pacientes');
const turnosRouter = require('./routes/turnos');
const historiasRouter = require('./routes/historias');
const recetasRouter = require('./routes/recetas');
const configRouter = require('./routes/config');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/usuarios', usuariosRouter);
app.use('/api/pacientes', pacientesRouter);
app.use('/api/turnos', turnosRouter);
app.use('/api/historias', historiasRouter);
app.use('/api/recetas', recetasRouter);
app.use('/api/config', configRouter);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;

function direccionesLocales() {
  const interfaces = os.networkInterfaces();
  const direcciones = [];
  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        direcciones.push(iface.address);
      }
    }
  }
  return direcciones;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor del consultorio corriendo en el puerto ${PORT}`);
  console.log('Direcciones IP de esta PC en la red local (usalas en los clientes):');
  const ips = direccionesLocales();
  if (ips.length === 0) {
    console.log('  No se detecto ninguna red local activa.');
  } else {
    ips.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
  }
});
