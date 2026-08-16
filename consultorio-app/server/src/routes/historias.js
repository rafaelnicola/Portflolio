const express = require('express');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');
const { requirePermiso } = require('../permisos');
const { generarDocxHistoria, generarDocxTratamiento, generarDocxExamenes } = require('../documentos');
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

router.get('/paciente/:pacienteId', requireRol('admin', 'doctor', 'recepcion', 'enfermera'), (req, res) => {
  const historias = db
    .prepare(`${SELECT_HISTORIA} WHERE h.paciente_id = ? ORDER BY h.fecha DESC, h.id DESC`)
    .all(req.params.pacienteId);
  res.json(historias.map(conEditable));
});

const CAMPOS_HISTORIA = [
  'motivo_consulta',
  'enfermedad_actual',
  'antecedentes_heredo_familiares',
  'antecedentes_personales_no_patologicos',
  'antecedentes_personales_patologicos',
  'presion_arterial',
  'peso',
  'glucometria',
  'imc',
  'perimetro_abdominal',
  'talla',
  'exploracion_fisica',
  'diagnostico',
  'tratamiento',
  'examenes_laboratorio',
  'observaciones',
];

router.post('/', requirePermiso('historia_gestionar'), (req, res) => {
  const { paciente_id } = req.body || {};
  if (!paciente_id) return res.status(400).json({ error: 'Falta el paciente' });
  const valores = CAMPOS_HISTORIA.map((campo) => req.body[campo] || null);
  const info = db
    .prepare(
      `INSERT INTO historias_clinicas
       (paciente_id, doctor_id, ${CAMPOS_HISTORIA.join(', ')})
       VALUES (?, ?, ${CAMPOS_HISTORIA.map(() => '?').join(', ')})`
    )
    .run(paciente_id, req.usuario.id, ...valores);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requirePermiso('historia_gestionar'), (req, res) => {
  const existente = db.prepare('SELECT id, fecha FROM historias_clinicas WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Registro no encontrado' });
  if (horasTranscurridas(existente.fecha) > HORAS_LIMITE_EDICION) {
    return res.status(403).json({
      error: `Esta valoracion ya no se puede modificar: pasaron mas de ${HORAS_LIMITE_EDICION} horas desde que se creo. Cargala como una nueva valoracion.`,
    });
  }
  const valores = CAMPOS_HISTORIA.map((campo) => req.body[campo] || null);
  db.prepare(
    `UPDATE historias_clinicas SET ${CAMPOS_HISTORIA.map((campo) => `${campo} = ?`).join(', ')} WHERE id = ?`
  ).run(...valores, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requirePermiso('historia_eliminar'), (req, res) => {
  db.prepare('DELETE FROM historias_clinicas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Anotaciones de enfermeria: notas independientes ligadas a una valoracion, para
// registrar seguimientos posteriores (ej. terapias) sin depender del limite de
// 48hs que aplica a la valoracion en si. Las puede ver cualquier usuario, pero
// solo cargarlas/editarlas quien tenga el permiso correspondiente.
const SELECT_ANOTACION = `
  SELECT a.*, u.nombre_completo AS usuario_nombre
  FROM anotaciones_enfermeria a
  LEFT JOIN usuarios u ON u.id = a.usuario_id
`;

router.get('/:id/anotaciones', requireRol('admin', 'doctor', 'recepcion', 'enfermera'), (req, res) => {
  const anotaciones = db
    .prepare(`${SELECT_ANOTACION} WHERE a.historia_id = ? ORDER BY a.created_at ASC, a.id ASC`)
    .all(req.params.id);
  res.json(anotaciones);
});

router.post('/:id/anotaciones', requirePermiso('anotaciones_enfermeria_gestionar'), (req, res) => {
  const { nota } = req.body || {};
  if (!nota || !nota.trim()) return res.status(400).json({ error: 'Falta la anotacion' });
  const historia = db.prepare('SELECT id FROM historias_clinicas WHERE id = ?').get(req.params.id);
  if (!historia) return res.status(404).json({ error: 'Historia no encontrada' });
  const info = db
    .prepare('INSERT INTO anotaciones_enfermeria (historia_id, usuario_id, nota) VALUES (?, ?, ?)')
    .run(req.params.id, req.usuario.id, nota.trim());
  const creada = db.prepare(`${SELECT_ANOTACION} WHERE a.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(creada);
});

router.put('/:id/anotaciones/:notaId', requirePermiso('anotaciones_enfermeria_gestionar'), (req, res) => {
  const { nota } = req.body || {};
  if (!nota || !nota.trim()) return res.status(400).json({ error: 'Falta la anotacion' });
  const existente = db
    .prepare('SELECT id FROM anotaciones_enfermeria WHERE id = ? AND historia_id = ?')
    .get(req.params.notaId, req.params.id);
  if (!existente) return res.status(404).json({ error: 'Anotacion no encontrada' });
  db.prepare("UPDATE anotaciones_enfermeria SET nota = ?, updated_at = datetime('now') WHERE id = ?").run(
    nota.trim(),
    req.params.notaId
  );
  const actualizada = db.prepare(`${SELECT_ANOTACION} WHERE a.id = ?`).get(req.params.notaId);
  res.json(actualizada);
});

router.get('/:id/exportar-word', requireRol('admin', 'doctor', 'recepcion', 'enfermera'), async (req, res) => {
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

router.get('/:id/exportar-tratamiento-word', requireRol('admin', 'doctor', 'recepcion', 'enfermera'), async (req, res) => {
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

router.get('/:id/exportar-examenes-word', requireRol('admin', 'doctor', 'recepcion', 'enfermera'), async (req, res) => {
  const datos = obtenerHistoriaConPaciente(req.params.id);
  if (!datos) return res.status(404).json({ error: 'Registro no encontrado' });
  try {
    const datosConsultorio = {
      direccion: db.getSetting('consultorio_direccion'),
      telefono: db.getSetting('consultorio_telefono'),
    };
    const buffer = await generarDocxExamenes(datos.historia, datos.paciente, datosConsultorio);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="examenes-${req.params.id}.docx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo generar el documento' });
  }
});

router.post('/:id/enviar-email', requireRol('admin', 'doctor', 'recepcion', 'enfermera'), async (req, res) => {
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
