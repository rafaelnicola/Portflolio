const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRol('admin', 'doctor'));

router.get('/paciente/:pacienteId', (req, res) => {
  const recetas = db
    .prepare(
      `SELECT r.*, u.nombre_completo AS doctor_nombre
       FROM recetas r
       LEFT JOIN usuarios u ON u.id = r.doctor_id
       WHERE r.paciente_id = ?
       ORDER BY r.fecha DESC, r.id DESC`
    )
    .all(req.params.pacienteId);
  res.json(recetas);
});

router.post('/', (req, res) => {
  const { paciente_id, historia_id, medicamentos, indicaciones } = req.body || {};
  if (!paciente_id || !medicamentos) {
    return res.status(400).json({ error: 'Paciente y medicamentos son requeridos' });
  }
  const info = db
    .prepare(
      'INSERT INTO recetas (paciente_id, historia_id, doctor_id, medicamentos, indicaciones) VALUES (?, ?, ?, ?, ?)'
    )
    .run(paciente_id, historia_id || null, req.usuario.id, medicamentos, indicaciones || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/:id', requireRol('admin'), (req, res) => {
  db.prepare('DELETE FROM recetas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
