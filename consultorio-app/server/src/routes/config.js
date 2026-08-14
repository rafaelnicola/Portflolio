const express = require('express');
const { ZipArchive } = require('archiver');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');
const { obtenerConfigSmtp, guardarConfigSmtp } = require('../mailer');

const router = express.Router();

router.use(requireAuth, requireRol('admin'));

router.get('/backup-ahora', (req, res) => {
  const fecha = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1-$2');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="backup-consultorio-${fecha}.zip"`);

  const archivo = new ZipArchive({ zlib: { level: 9 } });
  archivo.on('error', (err) => {
    console.error(err);
    if (!res.headersSent) res.status(500);
    res.end();
  });
  archivo.pipe(res);
  // Se incluyen los datos del consultorio (base de datos y fotos), sin el jwt.secret
  // (esa clave no es informacion del consultorio y no tiene por que salir en un backup).
  archivo.glob('consultorio.db*', { cwd: db.dataDir }, { prefix: 'data' });
  archivo.directory(db.fotosDir, 'data/fotos');
  archivo.finalize();
});

router.get('/consultorio', (req, res) => {
  res.json({
    direccion: db.getSetting('consultorio_direccion') || '',
    telefono: db.getSetting('consultorio_telefono') || '',
  });
});

router.put('/consultorio', (req, res) => {
  const { direccion, telefono } = req.body || {};
  db.setSetting('consultorio_direccion', direccion || '');
  db.setSetting('consultorio_telefono', telefono || '');
  res.json({ ok: true });
});

router.get('/smtp', (req, res) => {
  const config = obtenerConfigSmtp();
  res.json({
    host: config.smtp_host || '',
    puerto: config.smtp_puerto || '587',
    usuario: config.smtp_usuario || '',
    remitente: config.smtp_remitente || '',
    seguro: config.smtp_seguro === '1',
    configurado: Boolean(config.smtp_host && config.smtp_usuario && config.smtp_password),
  });
});

router.put('/smtp', (req, res) => {
  const { host, puerto, usuario, password, remitente, seguro } = req.body || {};
  if (!host || !usuario) {
    return res.status(400).json({ error: 'El servidor y el usuario son requeridos' });
  }
  guardarConfigSmtp({ host, puerto, usuario, password, remitente, seguro });
  res.json({ ok: true });
});

module.exports = router;
