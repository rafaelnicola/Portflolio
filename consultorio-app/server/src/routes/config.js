const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');
const { obtenerConfigSmtp, guardarConfigSmtp } = require('../mailer');

const router = express.Router();

router.use(requireAuth, requireRol('admin'));

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
