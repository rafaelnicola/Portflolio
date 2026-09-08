const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

router.use(requireAuth);

router.post('/', (req, res) => {
  const { asunto, mensaje } = req.body || {};
  if (!mensaje || !mensaje.trim()) return res.status(400).json({ error: 'Falta el mensaje' });
  const info = db
    .prepare('INSERT INTO mensajes_soporte (usuario_id, asunto, mensaje) VALUES (?, ?, ?)')
    .run(req.usuario.id, asunto || null, mensaje.trim());
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/', requireRol('admin'), (req, res) => {
  const mensajes = db
    .prepare(
      `SELECT m.*, u.nombre_completo AS usuario_nombre
       FROM mensajes_soporte m
       LEFT JOIN usuarios u ON u.id = m.usuario_id
       ORDER BY m.created_at DESC`
    )
    .all();
  res.json(mensajes);
});

router.get('/no-leidos', requireRol('admin'), (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM mensajes_soporte WHERE leido = 0').get();
  res.json({ noLeidos: n });
});

router.put('/:id/leido', requireRol('admin'), (req, res) => {
  db.prepare('UPDATE mensajes_soporte SET leido = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
