const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const fotosDir = path.join(dataDir, 'fotos');
if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'consultorio.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'doctor', 'recepcion', 'enfermera')),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pacientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT UNIQUE,
  fecha_nacimiento TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  obra_social TEXT,
  sexo TEXT,
  aseguradora TEXT,
  estado_civil TEXT,
  notas TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS turnos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  motivo TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'cancelado', 'atendido')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS historias_clinicas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  motivo_consulta TEXT,
  presion_arterial TEXT,
  peso TEXT,
  diagnostico TEXT,
  tratamiento TEXT,
  observaciones TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS permisos_usuario (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  permiso TEXT NOT NULL,
  PRIMARY KEY (usuario_id, permiso)
);

CREATE TABLE IF NOT EXISTS mensajes_soporte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  asunto TEXT,
  mensaje TEXT NOT NULL,
  leido INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remitente_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  destinatario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  mensaje TEXT NOT NULL,
  leido INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
CREATE INDEX IF NOT EXISTS idx_chat_conversacion ON chat_mensajes(remitente_id, destinatario_id);
CREATE INDEX IF NOT EXISTS idx_turnos_paciente ON turnos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_historias_paciente ON historias_clinicas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_apellido ON pacientes(apellido);
`);

function columnaExiste(tabla, columna) {
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all();
  return columnas.some((c) => c.name === columna);
}

function agregarColumnaSiFalta(tabla, columna, definicion) {
  if (!columnaExiste(tabla, columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
}

// SQLite no permite modificar un CHECK existente con ALTER TABLE: hay que
// recrear la tabla. Esto agrega el rol 'enfermera' a bases de datos creadas
// con una version anterior del esquema (que solo permitia admin/doctor/recepcion).
//
// IMPORTANTE: no se puede hacer "ALTER TABLE usuarios RENAME TO usuarios_old",
// porque SQLite actualiza automaticamente las foreign keys de otras tablas
// (turnos.doctor_id, historias_clinicas.doctor_id, etc.) para que apunten a
// "usuarios_old", y al borrar esa tabla se dispara el ON DELETE SET NULL de
// esas columnas, dejando todo en null. Por eso la tabla nueva se crea con
// otro nombre y se renombra recien al final, cuando la vieja ya no existe.
function migrarRolEnfermeraSiFalta() {
  const tabla = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'").get();
  if (!tabla || tabla.sql.includes('enfermera')) return;
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(`
    CREATE TABLE usuarios_nuevo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre_completo TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('admin', 'doctor', 'recepcion', 'enfermera')),
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO usuarios_nuevo (id, username, password_hash, nombre_completo, rol, activo, created_at)
      SELECT id, username, password_hash, nombre_completo, rol, activo, created_at FROM usuarios;
    DROP TABLE usuarios;
    ALTER TABLE usuarios_nuevo RENAME TO usuarios;
  `);
  db.exec('PRAGMA foreign_keys = ON');
}
migrarRolEnfermeraSiFalta();

// Migraciones para bases de datos creadas con una version anterior del esquema
agregarColumnaSiFalta('pacientes', 'sexo', 'TEXT');
agregarColumnaSiFalta('pacientes', 'aseguradora', 'TEXT');
agregarColumnaSiFalta('pacientes', 'estado_civil', 'TEXT');
agregarColumnaSiFalta('pacientes', 'foto', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'presion_arterial', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'peso', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'antecedentes_heredo_familiares', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'antecedentes_personales_no_patologicos', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'antecedentes_personales_patologicos', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'enfermedad_actual', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'glucometria', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'imc', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'perimetro_abdominal', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'talla', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'exploracion_fisica', 'TEXT');
agregarColumnaSiFalta('historias_clinicas', 'examenes_laboratorio', 'TEXT');

const userCount = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO usuarios (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)'
  ).run('admin', hash, 'Administrador', 'admin');
  console.log('Usuario admin creado por defecto -> usuario: admin  contraseña: admin123');
  console.log('IMPORTANTE: cambia esta contraseña desde la app apenas puedas.');
}

function getSetting(clave) {
  const fila = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
  return fila ? fila.valor : null;
}

function setSetting(clave, valor) {
  db.prepare(
    'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
  ).run(clave, valor === null || valor === undefined ? null : String(valor));
}

db.getSetting = getSetting;
db.setSetting = setSetting;
db.fotosDir = fotosDir;
db.dataDir = dataDir;

// Valores por defecto del consultorio (se pueden editar despues desde Configuracion)
if (getSetting('consultorio_direccion') === null) {
  setSetting('consultorio_direccion', 'Calle 25 No. 16-101 Barrio Los Alcázares');
}
if (getSetting('consultorio_telefono') === null) {
  setSetting('consultorio_telefono', '4336041 - 3053282029');
}

module.exports = db;
