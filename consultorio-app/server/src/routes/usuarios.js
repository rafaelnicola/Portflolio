const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generarToken, requireAuth, requireRol } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }
  const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ? AND activo = 1').get(username);
  if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const token = generarToken(usuario);
  res.json({
    token,
    usuario: {
      id: usuario.id,
      username: usuario.username,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
    },
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.usuario });
});

router.post('/cambiar-password', requireAuth, (req, res) => {
  const { password_actual, password_nuevo } = req.body || {};
  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!bcrypt.compareSync(password_actual, usuario.password_hash)) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
  }
  const hash = bcrypt.hashSync(password_nuevo, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, req.usuario.id);
  res.json({ ok: true });
});

router.get('/', requireAuth, requireRol('admin'), (req, res) => {
  const usuarios = db
    .prepare('SELECT id, username, nombre_completo, rol, activo, created_at FROM usuarios ORDER BY nombre_completo')
    .all();
  res.json(usuarios);
});

router.post('/', requireAuth, requireRol('admin'), (req, res) => {
  const { username, password, nombre_completo, rol } = req.body || {};
  if (!username || !password || !nombre_completo || !rol) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (!['admin', 'doctor', 'recepcion'].includes(rol)) {
    return res.status(400).json({ error: 'Rol invalido' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare('INSERT INTO usuarios (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)')
      .run(username, hash, nombre_completo, rol);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put('/:id/activo', requireAuth, requireRol('admin'), (req, res) => {
  const { activo } = req.body || {};
  db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.put('/:id/password', requireAuth, requireRol('admin'), (req, res) => {
  const { password_nuevo } = req.body || {};
  if (!password_nuevo) return res.status(400).json({ error: 'Falta la contraseña nueva' });
  const hash = bcrypt.hashSync(password_nuevo, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

router.get('/doctores', requireAuth, (req, res) => {
  const doctores = db
    .prepare("SELECT id, nombre_completo FROM usuarios WHERE rol = 'doctor' AND activo = 1 ORDER BY nombre_completo")
    .all();
  res.json(doctores);
});

module.exports = router;
