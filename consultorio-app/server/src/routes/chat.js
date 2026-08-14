const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

const SELECT_CHAT = `
  SELECT c.*, u.nombre_completo AS usuario_nombre
  FROM chat_mensajes c
  LEFT JOIN usuarios u ON u.id = c.usuario_id
`;

const LIMITE_INICIAL = 100;

router.get('/', (req, res) => {
  const desde = Number(req.query.desde) || 0;
  let mensajes;
  if (desde > 0) {
    mensajes = db.prepare(`${SELECT_CHAT} WHERE c.id > ? ORDER BY c.id ASC`).all(desde);
  } else {
    mensajes = db
      .prepare(`SELECT * FROM (${SELECT_CHAT} ORDER BY c.id DESC LIMIT ?) sub ORDER BY sub.id ASC`)
      .all(LIMITE_INICIAL);
  }
  res.json(mensajes);
});

router.post('/', (req, res) => {
  const { mensaje } = req.body || {};
  if (!mensaje || !mensaje.trim()) return res.status(400).json({ error: 'Falta el mensaje' });
  const info = db.prepare('INSERT INTO chat_mensajes (usuario_id, mensaje) VALUES (?, ?)').run(req.usuario.id, mensaje.trim());
  const creado = db.prepare(`${SELECT_CHAT} WHERE c.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(creado);
});

module.exports = router;
