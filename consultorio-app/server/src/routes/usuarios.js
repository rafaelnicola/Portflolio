const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generarToken, requireAuth, requireRol } = require('../auth');
const {
  PERMISOS,
  permisosDeUsuario,
  detallePermisosUsuario,
  otorgarPermisoExtra,
  quitarPermisoExtra,
} = require('../permisos');

const router = express.Router();

const MAX_INTENTOS = 5;
const VENTANA_BLOQUEO_MS = 15 * 60 * 1000;
const intentosFallidos = new Map();

function estaBloqueado(username) {
  const registro = intentosFallidos.get(username);
  if (!registro) return false;
  if (registro.count < MAX_INTENTOS) return false;
  const tiempoRestante = registro.desde + VENTANA_BLOQUEO_MS - Date.now();
  if (tiempoRestante <= 0) {
    intentosFallidos.delete(username);
    return false;
  }
  return Math.ceil(tiempoRestante / 60000);
}

function registrarIntentoFallido(username) {
  const registro = intentosFallidos.get(username);
  if (!registro || Date.now() - registro.desde > VENTANA_BLOQUEO_MS) {
    intentosFallidos.set(username, { count: 1, desde: Date.now() });
  } else {
    registro.count += 1;
  }
}

function limpiarIntentos(username) {
  intentosFallidos.delete(username);
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const minutosRestantes = estaBloqueado(username);
  if (minutosRestantes) {
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Probá de nuevo en ${minutosRestantes} minuto(s).`,
    });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ? AND activo = 1').get(username);
  if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
    registrarIntentoFallido(username);
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  limpiarIntentos(username);
  const token = generarToken(usuario);
  res.json({
    token,
    usuario: {
      id: usuario.id,
      username: usuario.username,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
      permisos: permisosDeUsuario(usuario),
    },
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: { ...req.usuario, permisos: permisosDeUsuario(req.usuario) } });
});

router.post('/cambiar-password', requireAuth, (req, res) => {
  const { password_actual, password_nuevo } = req.body || {};
  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (password_nuevo.length < 4) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 4 caracteres' });
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
  if (!['admin', 'doctor', 'recepcion', 'enfermera'].includes(rol)) {
    return res.status(400).json({ error: 'Rol invalido' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
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

router.put('/:id/rol', requireAuth, requireRol('admin'), (req, res) => {
  const { rol } = req.body || {};
  if (!['admin', 'doctor', 'recepcion', 'enfermera'].includes(rol)) {
    return res.status(400).json({ error: 'Rol invalido' });
  }
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (usuario.rol === 'admin' && rol !== 'admin') {
    const otrosAdmins = db
      .prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1 AND id != ?")
      .get(req.params.id).n;
    if (otrosAdmins === 0) {
      return res.status(400).json({ error: 'No podés quitarle el rol de administrador al unico admin activo' });
    }
  }

  db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, req.params.id);
  res.json({ ok: true });
});

router.put('/:id/password', requireAuth, requireRol('admin'), (req, res) => {
  const { password_nuevo } = req.body || {};
  if (!password_nuevo || password_nuevo.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }
  const hash = bcrypt.hashSync(password_nuevo, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

router.get('/permisos-disponibles', requireAuth, requireRol('admin'), (req, res) => {
  const lista = Object.entries(PERMISOS).map(([clave, def]) => ({ clave, etiqueta: def.etiqueta }));
  res.json(lista);
});

router.get('/:id/permisos', requireAuth, requireRol('admin'), (req, res) => {
  const usuario = db.prepare('SELECT id, rol FROM usuarios WHERE id = ?').get(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(detallePermisosUsuario(usuario));
});

router.put('/:id/permisos/:permiso', requireAuth, requireRol('admin'), (req, res) => {
  const { activo } = req.body || {};
  const usuario = db.prepare('SELECT id, rol FROM usuarios WHERE id = ?').get(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (!PERMISOS[req.params.permiso]) return res.status(400).json({ error: 'Permiso invalido' });

  const detalle = detallePermisosUsuario(usuario)[req.params.permiso];
  if (detalle.porRol) {
    return res.status(400).json({ error: 'Este permiso ya lo tiene por su rol, no se puede modificar aca' });
  }

  if (activo) {
    otorgarPermisoExtra(usuario.id, req.params.permiso);
  } else {
    quitarPermisoExtra(usuario.id, req.params.permiso);
  }
  res.json({ ok: true });
});

router.get('/doctores', requireAuth, (req, res) => {
  const doctores = db
    .prepare("SELECT id, nombre_completo FROM usuarios WHERE rol = 'doctor' AND activo = 1 ORDER BY nombre_completo")
    .all();
  res.json(doctores);
});

module.exports = router;
