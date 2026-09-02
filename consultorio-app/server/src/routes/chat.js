const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

// Lista de usuarios con los que se puede chatear (todos menos uno mismo), con la
// cantidad de mensajes sin leer que le mando cada uno al usuario actual.
router.get('/usuarios', (req, res) => {
  const usuarios = db
    .prepare(
      `SELECT u.id, u.nombre_completo, u.rol,
        (SELECT COUNT(*) FROM chat_mensajes m
         WHERE m.remitente_id = u.id AND m.destinatario_id = ? AND m.leido = 0) AS no_leidos
       FROM usuarios u
       WHERE u.id != ? AND u.activo = 1
       ORDER BY u.nombre_completo`
    )
    .all(req.usuario.id, req.usuario.id);
  res.json(usuarios);
});

router.get('/no-leidos', (req, res) => {
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM chat_mensajes WHERE destinatario_id = ? AND leido = 0')
    .get(req.usuario.id);
  res.json({ noLeidos: n });
});

// Conversacion entre el usuario actual y :otroId
router.get('/:otroId', (req, res) => {
  const otroId = Number(req.params.otroId);
  const desde = Number(req.query.desde) || 0;
  const condicionPar = '((remitente_id = ? AND destinatario_id = ?) OR (remitente_id = ? AND destinatario_id = ?))';
  let mensajes;
  if (desde > 0) {
    mensajes = db
      .prepare(`SELECT * FROM chat_mensajes WHERE ${condicionPar} AND id > ? ORDER BY id ASC`)
      .all(req.usuario.id, otroId, otroId, req.usuario.id, desde);
  } else {
    mensajes = db
      .prepare(
        `SELECT * FROM (SELECT * FROM chat_mensajes WHERE ${condicionPar} ORDER BY id DESC LIMIT 100) sub ORDER BY sub.id ASC`
      )
      .all(req.usuario.id, otroId, otroId, req.usuario.id);
  }
  // Al abrir/actualizar la conversacion, se marca como leido lo que el otro usuario me mando.
  db.prepare('UPDATE chat_mensajes SET leido = 1 WHERE remitente_id = ? AND destinatario_id = ? AND leido = 0').run(
    otroId,
    req.usuario.id
  );
  res.json(mensajes);
});

router.post('/:otroId', (req, res) => {
  const otroId = Number(req.params.otroId);
  const { mensaje } = req.body || {};
  if (!mensaje || !mensaje.trim()) return res.status(400).json({ error: 'Falta el mensaje' });
  const destinatario = db.prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1').get(otroId);
  if (!destinatario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const info = db
    .prepare('INSERT INTO chat_mensajes (remitente_id, destinatario_id, mensaje) VALUES (?, ?, ?)')
    .run(req.usuario.id, otroId, mensaje.trim());
  const creado = db.prepare('SELECT * FROM chat_mensajes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(creado);
});

module.exports = router;
