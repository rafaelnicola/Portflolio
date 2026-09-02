const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');
const { requirePermiso } = require('../permisos');
const { generarDocxAgenda } = require('../documentos');

const router = express.Router();

router.use(requireAuth);

const SELECT_TURNO = `
  SELECT t.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.telefono AS paciente_telefono,
         u.nombre_completo AS doctor_nombre, c.nombre_completo AS creado_por_nombre
  FROM turnos t
  JOIN pacientes p ON p.id = t.paciente_id
  LEFT JOIN usuarios u ON u.id = t.doctor_id
  LEFT JOIN usuarios c ON c.id = t.creado_por_id
`;

router.get('/exportar-word', async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Falta la fecha' });
  const turnos = db.prepare(`${SELECT_TURNO} WHERE t.fecha = ? ORDER BY t.hora`).all(fecha);
  try {
    const buffer = await generarDocxAgenda(turnos, fecha);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="turnos-${fecha}.docx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo generar el documento' });
  }
});

router.get('/', (req, res) => {
  const { fecha, doctor_id, paciente_id, motivo, paciente } = req.query;
  const condiciones = [];
  const params = [];
  if (fecha) {
    condiciones.push('t.fecha = ?');
    params.push(fecha);
  }
  if (doctor_id) {
    condiciones.push('t.doctor_id = ?');
    params.push(doctor_id);
  }
  if (paciente_id) {
    condiciones.push('t.paciente_id = ?');
    params.push(paciente_id);
  }
  if (motivo) {
    condiciones.push('t.motivo LIKE ?');
    params.push(`%${motivo}%`);
  }
  if (paciente) {
    condiciones.push('(p.nombre LIKE ? OR p.apellido LIKE ? OR (p.apellido || \', \' || p.nombre) LIKE ?)');
    params.push(`%${paciente}%`, `%${paciente}%`, `%${paciente}%`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const turnos = db.prepare(`${SELECT_TURNO} ${where} ORDER BY t.fecha, t.hora`).all(...params);
  res.json(turnos);
});

router.post('/', requireRol('admin', 'recepcion', 'doctor', 'enfermera'), (req, res) => {
  const { paciente_id, doctor_id, fecha, hora, motivo } = req.body || {};
  if (!paciente_id || !fecha || !hora) {
    return res.status(400).json({ error: 'Paciente, fecha y hora son requeridos' });
  }
  const info = db
    .prepare('INSERT INTO turnos (paciente_id, doctor_id, fecha, hora, motivo, creado_por_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(paciente_id, doctor_id || null, fecha, hora, motivo || null, req.usuario.id);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRol('admin', 'recepcion', 'doctor', 'enfermera'), (req, res) => {
  const { paciente_id, doctor_id, fecha, hora, motivo } = req.body || {};
  const existente = db.prepare('SELECT id FROM turnos WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Turno no encontrado' });
  db.prepare(
    'UPDATE turnos SET paciente_id = ?, doctor_id = ?, fecha = ?, hora = ?, motivo = ? WHERE id = ?'
  ).run(paciente_id, doctor_id || null, fecha, hora, motivo || null, req.params.id);
  res.json({ ok: true });
});

router.put('/:id/estado', (req, res) => {
  const { estado } = req.body || {};
  if (!['pendiente', 'confirmado', 'cancelado', 'atendido'].includes(estado)) {
    return res.status(400).json({ error: 'Estado invalido' });
  }
  db.prepare('UPDATE turnos SET estado = ? WHERE id = ?').run(estado, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requirePermiso('turnos_eliminar'), (req, res) => {
  db.prepare('DELETE FROM turnos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
