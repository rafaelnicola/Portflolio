const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAuth, requireRol } = require('../auth');
const { requirePermiso } = require('../permisos');

const router = express.Router();

router.use(requireAuth);

const TIPOS_FOTO_PERMITIDOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function rutaFoto(pacienteId, extension) {
  return path.join(db.fotosDir, `paciente-${pacienteId}.${extension}`);
}

function borrarFotoSiExiste(paciente) {
  if (!paciente || !paciente.foto) return;
  const archivo = path.join(db.fotosDir, paciente.foto);
  if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
}

router.get('/', (req, res) => {
  const { q } = req.query;
  let pacientes;
  if (q) {
    const like = `%${q}%`;
    pacientes = db
      .prepare(
        `SELECT * FROM pacientes
         WHERE activo = 1 AND (nombre LIKE ? OR apellido LIKE ? OR dni LIKE ?)
         ORDER BY apellido, nombre LIMIT 200`
      )
      .all(like, like, like);
  } else {
    pacientes = db.prepare('SELECT * FROM pacientes WHERE activo = 1 ORDER BY apellido, nombre LIMIT 200').all();
  }
  res.json(pacientes);
});

// Papelera: pacientes "eliminados" (activo = 0), para poder restaurarlos.
// Tiene que ir antes de "/:id" para que Express no lo interprete como un id.
router.get('/papelera', requirePermiso('pacientes_eliminar'), (req, res) => {
  const pacientes = db
    .prepare('SELECT * FROM pacientes WHERE activo = 0 ORDER BY eliminado_en DESC')
    .all();
  res.json(pacientes);
});

router.get('/:id', (req, res) => {
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json(paciente);
});

router.post('/', requireRol('admin', 'recepcion', 'doctor', 'enfermera'), (req, res) => {
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

router.put('/:id', requireRol('admin', 'recepcion', 'doctor', 'enfermera'), (req, res) => {
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

// "Eliminar" un paciente lo manda a la papelera (activo = 0): no se borra nada
// todavia, se puede restaurar despues. El borrado definitivo es otra ruta.
router.delete('/:id', requirePermiso('pacientes_eliminar'), (req, res) => {
  const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  db.prepare("UPDATE pacientes SET activo = 0, eliminado_en = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.put('/:id/restaurar', requirePermiso('pacientes_eliminar'), (req, res) => {
  const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  db.prepare('UPDATE pacientes SET activo = 1, eliminado_en = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Borrado definitivo (irreversible): solo permitido desde la papelera, para
// evitar borrar por error un paciente que todavia esta activo.
router.delete('/:id/definitivo', requirePermiso('pacientes_eliminar'), (req, res) => {
  const paciente = db.prepare('SELECT foto, activo FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  if (paciente.activo) {
    return res.status(400).json({ error: 'Primero hay que eliminarlo (mandarlo a la papelera)' });
  }
  borrarFotoSiExiste(paciente);
  db.prepare('DELETE FROM pacientes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Foto de perfil del paciente. Habilitado para cualquier usuario autenticado
// (admin, doctor, recepcion): identificar pacientes por foto es util para todos.
router.get('/:id/foto', (req, res) => {
  const paciente = db.prepare('SELECT foto FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente || !paciente.foto) return res.status(404).json({ error: 'Este paciente no tiene foto' });
  const archivo = path.join(db.fotosDir, paciente.foto);
  if (!fs.existsSync(archivo)) return res.status(404).json({ error: 'Este paciente no tiene foto' });
  const extension = paciente.foto.split('.').pop().toLowerCase();
  const tipo = Object.entries(TIPOS_FOTO_PERMITIDOS).find(([, ext]) => ext === extension);
  res.setHeader('Content-Type', tipo ? tipo[0] : 'application/octet-stream');
  res.sendFile(archivo);
});

router.put('/:id/foto', (req, res) => {
  const { foto } = req.body || {};
  if (!foto || typeof foto !== 'string') return res.status(400).json({ error: 'Falta la foto' });

  const coincidencia = foto.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!coincidencia) return res.status(400).json({ error: 'Formato de imagen invalido' });
  const [, mimeType, base64] = coincidencia;
  const extension = TIPOS_FOTO_PERMITIDOS[mimeType];
  if (!extension) return res.status(400).json({ error: 'Solo se aceptan imagenes JPG, PNG, WEBP o GIF' });

  const paciente = db.prepare('SELECT id, foto FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

  const buffer = Buffer.from(base64, 'base64');
  const LIMITE_BYTES = 8 * 1024 * 1024;
  if (buffer.length > LIMITE_BYTES) return res.status(400).json({ error: 'La imagen es demasiado grande' });

  borrarFotoSiExiste(paciente);
  const nombreArchivo = `paciente-${paciente.id}.${extension}`;
  fs.writeFileSync(rutaFoto(paciente.id, extension), buffer);
  db.prepare('UPDATE pacientes SET foto = ? WHERE id = ?').run(nombreArchivo, paciente.id);
  res.json({ ok: true });
});

router.delete('/:id/foto', (req, res) => {
  const paciente = db.prepare('SELECT id, foto FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  borrarFotoSiExiste(paciente);
  db.prepare('UPDATE pacientes SET foto = NULL WHERE id = ?').run(paciente.id);
  res.json({ ok: true });
});

module.exports = router;
