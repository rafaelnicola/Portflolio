const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');
const { requirePermiso } = require('../permisos');
const { generarDocxHistoria, generarDocxTratamiento } = require('../documentos');
const { generarPdfHistoria } = require('../pdf');
const { enviarEmailConAdjunto } = require('../mailer');

const router = express.Router();

const HORAS_LIMITE_EDICION = 48;

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

function horasTranscurridas(fechaTexto) {
  // Las fechas se guardan con datetime('now') de SQLite, en UTC y sin sufijo de zona horaria.
  const fechaUtc = new Date(`${fechaTexto.replace(' ', 'T')}Z`);
  return (Date.now() - fechaUtc.getTime()) / (1000 * 60 * 60);
}

function conEditable(historia) {
  return { ...historia, editable: horasTranscurridas(historia.fecha) <= HORAS_LIMITE_EDICION };
}

router.get('/paciente/:pacienteId', requireRol('admin', 'doctor', 'recepcion'), (req, res) => {
  const historias = db
    .prepare(`${SELECT_HISTORIA} WHERE h.paciente_id = ? ORDER BY h.fecha DESC, h.id DESC`)
    .all(req.params.pacienteId);
  res.json(historias.map(conEditable));
});

router.post('/', requirePermiso('historia_gestionar'), (req, res) => {
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

router.put('/:id', requirePermiso('historia_gestionar'), (req, res) => {
  const { motivo_consulta, presion_arterial, peso, diagnostico, tratamiento, observaciones } = req.body || {};
  const existente = db.prepare('SELECT id, fecha FROM historias_clinicas WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Registro no encontrado' });
  if (horasTranscurridas(existente.fecha) > HORAS_LIMITE_EDICION) {
    return res.status(403).json({
      error: `Esta valoracion ya no se puede modificar: pasaron mas de ${HORAS_LIMITE_EDICION} horas desde que se creo. Cargala como una nueva valoracion.`,
    });
  }
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

router.get('/:id/exportar-word', requireRol('admin', 'doctor', 'recepcion'), async (req, res) => {
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
    const datosConsultorio = {
      direccion: db.getSetting('consultorio_direccion'),
      telefono: db.getSetting('consultorio_telefono'),
    };
    const buffer = await generarDocxTratamiento(datos.historia, datos.paciente, datosConsultorio);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="tratamiento-${req.params.id}.docx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo generar el documento' });
  }
});

router.post('/:id/enviar-email', requireRol('admin', 'doctor', 'recepcion'), async (req, res) => {
  const { destinatario } = req.body || {};
  if (!destinatario) return res.status(400).json({ error: 'Falta el email de destino' });
  const datos = obtenerHistoriaConPaciente(req.params.id);
  if (!datos) return res.status(404).json({ error: 'Registro no encontrado' });
  try {
    const buffer = await generarPdfHistoria(datos.historia, datos.paciente);
    await enviarEmailConAdjunto({
      destinatario,
      asunto: `Historia clinica - ${datos.paciente.apellido}, ${datos.paciente.nombre}`,
      texto: 'Se adjunta la historia clinica en formato PDF.',
      nombreArchivo: `historia-clinica-${req.params.id}.pdf`,
      contenido: buffer,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'No se pudo enviar el email' });
  }
});

module.exports = router;
