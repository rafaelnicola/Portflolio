const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');
const { requirePermiso } = require('../permisos');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const { q } = req.query;
  let pacientes;
  if (q) {
    const like = `%${q}%`;
    pacientes = db
      .prepare(
        `SELECT * FROM pacientes
         WHERE nombre LIKE ? OR apellido LIKE ? OR dni LIKE ?
         ORDER BY apellido, nombre LIMIT 200`
      )
      .all(like, like, like);
  } else {
    pacientes = db.prepare('SELECT * FROM pacientes ORDER BY apellido, nombre LIMIT 200').all();
  }
  res.json(pacientes);
});

router.get('/:id', (req, res) => {
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json(paciente);
});

router.post('/', requireRol('admin', 'recepcion', 'doctor'), (req, res) => {
  const {
    nombre,
    apellido,
    dni,
    fecha_nacimiento,
    telefono,
    email,
    direccion,
    obra_social,
    sexo,
    aseguradora,
    estado_civil,
    notas,
  } = req.body || {};
  if (!nombre || !apellido) {
    return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
  }
  try {
    const info = db
      .prepare(
        `INSERT INTO pacientes
         (nombre, apellido, dni, fecha_nacimiento, telefono, email, direccion, obra_social, sexo, aseguradora, estado_civil, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nombre,
        apellido,
        dni || null,
        fecha_nacimiento || null,
        telefono || null,
        email || null,
        direccion || null,
        obra_social || null,
        sexo || null,
        aseguradora || null,
        estado_civil || null,
        notas || null
      );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un paciente con ese DNI' });
    }
    res.status(500).json({ error: 'Error al crear paciente' });
  }
});

router.put('/:id', requireRol('admin', 'recepcion', 'doctor'), (req, res) => {
  const {
    nombre,
    apellido,
    dni,
    fecha_nacimiento,
    telefono,
    email,
    direccion,
    obra_social,
    sexo,
    aseguradora,
    estado_civil,
    notas,
  } = req.body || {};
  const existente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Paciente no encontrado' });
  db.prepare(
    `UPDATE pacientes SET nombre = ?, apellido = ?, dni = ?, fecha_nacimiento = ?, telefono = ?, email = ?,
     direccion = ?, obra_social = ?, sexo = ?, aseguradora = ?, estado_civil = ?, notas = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    nombre,
    apellido,
    dni || null,
    fecha_nacimiento || null,
    telefono || null,
    email || null,
    direccion || null,
    obra_social || null,
    sexo || null,
    aseguradora || null,
    estado_civil || null,
    notas || null,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', requirePermiso('pacientes_eliminar'), (req, res) => {
  db.prepare('DELETE FROM pacientes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
