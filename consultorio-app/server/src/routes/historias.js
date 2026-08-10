const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRol('admin', 'doctor'));

router.get('/paciente/:pacienteId', (req, res) => {
  const historias = db
    .prepare(
      `SELECT h.*, u.nombre_completo AS doctor_nombre
       FROM historias_clinicas h
       LEFT JOIN usuarios u ON u.id = h.doctor_id
       WHERE h.paciente_id = ?
       ORDER BY h.fecha DESC, h.id DESC`
    )
    .all(req.params.pacienteId);
  res.json(historias);
});

router.post('/', (req, res) => {
  const { paciente_id, motivo_consulta, diagnostico, tratamiento, observaciones } = req.body || {};
  if (!paciente_id) return res.status(400).json({ error: 'Falta el paciente' });
  const info = db
    .prepare(
      `INSERT INTO historias_clinicas (paciente_id, doctor_id, motivo_consulta, diagnostico, tratamiento, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(paciente_id, req.usuario.id, motivo_consulta || null, diagnostico || null, tratamiento || null, observaciones || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { motivo_consulta, diagnostico, tratamiento, observaciones } = req.body || {};
  const existente = db.prepare('SELECT id FROM historias_clinicas WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Registro no encontrado' });
  db.prepare(
    'UPDATE historias_clinicas SET motivo_consulta = ?, diagnostico = ?, tratamiento = ?, observaciones = ? WHERE id = ?'
  ).run(motivo_consulta || null, diagnostico || null, tratamiento || null, observaciones || null, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireRol('admin'), (req, res) => {
  db.prepare('DELETE FROM historias_clinicas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
