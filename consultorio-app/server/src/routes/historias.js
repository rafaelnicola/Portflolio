const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');
const { generarDocxHistoria, generarDocxTratamiento } = require('../documentos');
const { enviarEmailConAdjunto } = require('../mailer');

const router = express.Router();

router.use(requireAuth);

const SELECT_HISTORIA = `
  SELECT h.*, u.nombre_completo AS doctor_nombre
  FROM historias_clinicas h
  LEFT JOIN usuarios u ON u.id = h.doctor_id
`;

function obtenerHistoriaConPaciente(id) {
  const historia = db.prepare(`${SELECT_HISTORIA} WHERE h.id = ?`).get(id);
  if (!historia) return null;
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(historia.paciente_id);
  return { historia, paciente };
}

router.get('/paciente/:pacienteId', requireRol('admin', 'doctor'), (req, res) => {
  const historias = db
    .prepare(`${SELECT_HISTORIA} WHERE h.paciente_id = ? ORDER BY h.fecha DESC, h.id DESC`)
    .all(req.params.pacienteId);
  res.json(historias);
});

// Vista limitada: solo fecha, doctor y tratamiento (sin diagnostico/signos vitales),
// para que recepcion pueda imprimir la formula sin ver el resto de la historia clinica.
router.get('/paciente/:pacienteId/tratamientos', requireRol('admin', 'doctor', 'recepcion'), (req, res) => {
  const tratamientos = db
    .prepare(
      `SELECT h.id, h.fecha, h.tratamiento, u.nombre_completo AS doctor_nombre
       FROM historias_clinicas h
       LEFT JOIN usuarios u ON u.id = h.doctor_id
       WHERE h.paciente_id = ? AND h.tratamiento IS NOT NULL AND TRIM(h.tratamiento) != ''
       ORDER BY h.fecha DESC, h.id DESC`
    )
    .all(req.params.pacienteId);
  res.json(tratamientos);
});

router.post('/', requireRol('admin', 'doctor'), (req, res) => {
  const { paciente_id, motivo_consulta, presion_arterial, peso, diagnostico, tratamiento, observaciones } = req.body || {};
  if (!paciente_id) return res.status(400).json({ error: 'Falta el paciente' });
  const info = db
    .prepare(
      `INSERT INTO historias_clinicas
       (paciente_id, doctor_id, motivo_consulta, presion_arterial, peso, diagnostico, tratamiento, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      paciente_id,
      req.usuario.id,
      motivo_consulta || null,
      presion_arterial || null,
      peso || null,
      diagnostico || null,
      tratamiento || null,
      observaciones || null
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRol('admin', 'doctor'), (req, res) => {
  const { motivo_consulta, presion_arterial, peso, diagnostico, tratamiento, observaciones } = req.body || {};
  const existente = db.prepare('SELECT id FROM historias_clinicas WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Registro no encontrado' });
  db.prepare(
    `UPDATE historias_clinicas
     SET motivo_consulta = ?, presion_arterial = ?, peso = ?, diagnostico = ?, tratamiento = ?, observaciones = ?
     WHERE id = ?`
  ).run(
    motivo_consulta || null,
    presion_arterial || null,
    peso || null,
    diagnostico || null,
    tratamiento || null,
    observaciones || null,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', requireRol('admin'), (req, res) => {
  db.prepare('DELETE FROM historias_clinicas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/exportar-word', requireRol('admin', 'doctor'), async (req, res) => {
  const datos = obtenerHistoriaConPaciente(req.params.id);
  if (!datos) return res.status(404).json({ error: 'Registro no encontrado' });
  try {
    const buffer = await generarDocxHistoria(datos.historia, datos.paciente);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="historia-clinica-${req.params.id}.docx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo generar el documento' });
  }
});

router.get('/:id/exportar-tratamiento-word', requireRol('admin', 'doctor', 'recepcion'), async (req, res) => {
  const datos = obtenerHistoriaConPaciente(req.params.id);
  if (!datos) return res.status(404).json({ error: 'Registro no encontrado' });
  try {
    const buffer = await generarDocxTratamiento(datos.historia, datos.paciente);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="tratamiento-${req.params.id}.docx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo generar el documento' });
  }
});

router.post('/:id/enviar-email', requireRol('admin', 'doctor'), async (req, res) => {
  const { destinatario } = req.body || {};
  if (!destinatario) return res.status(400).json({ error: 'Falta el email de destino' });
  const datos = obtenerHistoriaConPaciente(req.params.id);
  if (!datos) return res.status(404).json({ error: 'Registro no encontrado' });
  try {
    const buffer = await generarDocxHistoria(datos.historia, datos.paciente);
    await enviarEmailConAdjunto({
      destinatario,
      asunto: `Historia clinica - ${datos.paciente.apellido}, ${datos.paciente.nombre}`,
      texto: 'Se adjunta la historia clinica en formato Word.',
      nombreArchivo: `historia-clinica-${req.params.id}.docx`,
      contenido: Buffer.from(buffer),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'No se pudo enviar el email' });
  }
});

module.exports = router;
