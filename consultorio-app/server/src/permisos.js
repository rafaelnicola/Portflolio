const db = require('./db');

// Cada permiso define que roles lo tienen por defecto. El admin puede otorgar
// un permiso extra a un usuario puntual (tabla permisos_usuario) aunque su rol
// no lo incluya por defecto. Nunca se puede quitar un permiso que ya viene
// incluido por el rol desde esta tabla (eso se cambia cambiando el rol).
const PERMISOS = {
  historia_gestionar: {
    etiqueta: 'Crear y editar historia clinica',
    rolesPorDefecto: ['admin', 'doctor'],
  },
  pacientes_eliminar: {
    etiqueta: 'Eliminar pacientes',
    rolesPorDefecto: ['admin'],
  },
  turnos_eliminar: {
    etiqueta: 'Eliminar turnos',
    rolesPorDefecto: ['admin', 'recepcion', 'doctor'],
  },
};

function otorgadoPorRol(permiso, rol) {
  const def = PERMISOS[permiso];
  return Boolean(def && def.rolesPorDefecto.includes(rol));
}

function tieneExtra(usuarioId, permiso) {
  const fila = db
    .prepare('SELECT 1 FROM permisos_usuario WHERE usuario_id = ? AND permiso = ?')
    .get(usuarioId, permiso);
  return Boolean(fila);
}

function usuarioTienePermiso(usuario, permiso) {
  if (!usuario) return false;
  if (usuario.rol === 'admin') return true;
  if (otorgadoPorRol(permiso, usuario.rol)) return true;
  return tieneExtra(usuario.id, permiso);
}

// Devuelve { permiso: true/false } para todos los permisos definidos, para
// mandarselo al cliente (ej. al hacer login) y que la UI sepa que mostrar.
function permisosDeUsuario(usuario) {
  const resultado = {};
  for (const permiso of Object.keys(PERMISOS)) {
    resultado[permiso] = usuarioTienePermiso(usuario, permiso);
  }
  return resultado;
}

// Detalle para la pantalla de administracion: si ya lo tiene por el rol
// (no se puede tocar) o si es un extra que el admin otorgo a mano.
function detallePermisosUsuario(usuarioConRolId) {
  const resultado = {};
  for (const [permiso, def] of Object.entries(PERMISOS)) {
    const porRol = otorgadoPorRol(permiso, usuarioConRolId.rol);
    resultado[permiso] = {
      etiqueta: def.etiqueta,
      porRol,
      extra: tieneExtra(usuarioConRolId.id, permiso),
      activo: porRol || tieneExtra(usuarioConRolId.id, permiso),
    };
  }
  return resultado;
}

function otorgarPermisoExtra(usuarioId, permiso) {
  if (!PERMISOS[permiso]) throw new Error('Permiso invalido');
  db.prepare('INSERT OR IGNORE INTO permisos_usuario (usuario_id, permiso) VALUES (?, ?)').run(usuarioId, permiso);
}

function quitarPermisoExtra(usuarioId, permiso) {
  db.prepare('DELETE FROM permisos_usuario WHERE usuario_id = ? AND permiso = ?').run(usuarioId, permiso);
}

function requirePermiso(permiso) {
  return (req, res, next) => {
    if (!usuarioTienePermiso(req.usuario, permiso)) {
      return res.status(403).json({ error: 'No tenes permiso para esta accion' });
    }
    next();
  };
}

module.exports = {
  PERMISOS,
  usuarioTienePermiso,
  permisosDeUsuario,
  detallePermisosUsuario,
  otorgarPermisoExtra,
  quitarPermisoExtra,
  requirePermiso,
};
