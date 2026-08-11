let usuarioActual = null;
let doctoresCache = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mostrarPantalla(id) {
  ['pantalla-config', 'pantalla-login', 'app'].forEach((otro) => {
    $(`#${otro}`).classList.toggle('oculto', otro !== id);
  });
}

function toast(msg, tipo = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ---------- Panel lateral reutilizable ---------- */

function abrirPanel(html) {
  cerrarPanel();
  const fondo = document.createElement('div');
  fondo.className = 'fondo-oscuro';
  fondo.id = 'panel-fondo';
  fondo.addEventListener('click', cerrarPanel);

  const panel = document.createElement('div');
  panel.className = 'panel-lateral';
  panel.id = 'panel-lateral';
  panel.innerHTML = html;
  panel.addEventListener('click', (e) => e.stopPropagation());

  document.body.appendChild(fondo);
  document.body.appendChild(panel);
}

function cerrarPanel() {
  const fondo = $('#panel-fondo');
  const panel = $('#panel-lateral');
  if (fondo) fondo.remove();
  if (panel) panel.remove();
}

/* ---------- Configuracion del servidor ---------- */

async function iniciarConfig(prefill) {
  mostrarPantalla('pantalla-config');
  $('#config-url').value = prefill || '';
  $('#config-error').classList.add('oculto');
}

$('#config-guardar').addEventListener('click', async () => {
  const url = $('#config-url').value.trim();
  const errEl = $('#config-error');
  errEl.classList.add('oculto');
  if (!url) return;
  try {
    await Api.healthCheck(url);
    await window.configAPI.setServerUrl(url);
    Api.setBaseUrl(url);
    mostrarLogin();
  } catch (e) {
    errEl.textContent = 'No se pudo conectar al servidor. Verifica la direccion y que el servidor este encendido.';
    errEl.classList.remove('oculto');
  }
});

/* ---------- Login ---------- */

function mostrarLogin() {
  mostrarPantalla('pantalla-login');
  $('#login-error').classList.add('oculto');
  $('#login-username').value = '';
  $('#login-password').value = '';
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value;
  const errEl = $('#login-error');
  errEl.classList.add('oculto');
  try {
    const data = await Api.post('/api/usuarios/login', { username, password });
    Api.setToken(data.token);
    usuarioActual = data.usuario;
    iniciarApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('oculto');
  }
});

$('#login-cambiar-servidor').addEventListener('click', async () => {
  const actual = await window.configAPI.getServerUrl();
  iniciarConfig(actual);
});

$('#btn-logout').addEventListener('click', () => {
  Api.setToken('');
  usuarioActual = null;
  mostrarLogin();
});

/* ---------- App principal / navegacion ---------- */

function iniciarApp() {
  mostrarPantalla('app');
  $('#info-nombre').textContent = usuarioActual.nombre_completo;
  $('#info-rol').textContent = etiquetaRol(usuarioActual.rol);
  $('#nav-usuarios').classList.toggle('oculto', usuarioActual.rol !== 'admin');
  cambiarVista('dashboard');
}

function etiquetaRol(rol) {
  return { admin: 'Administrador/a', doctor: 'Doctor/a', recepcion: 'Recepcion' }[rol] || rol;
}

$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
});

function cambiarVista(vista) {
  $$('.nav-btn').forEach((b) => b.classList.toggle('activo', b.dataset.vista === vista));
  $$('.vista').forEach((v) => v.classList.toggle('oculto', v.id !== `vista-${vista}`));
  if (vista === 'dashboard') cargarDashboard();
  if (vista === 'pacientes') cargarPacientes();
  if (vista === 'turnos') cargarTurnos();
  if (vista === 'usuarios') cargarUsuarios();
}

/* ---------- Dashboard ---------- */

async function cargarDashboard() {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const [turnos, pacientes] = await Promise.all([
      Api.get(`/api/turnos?fecha=${hoy}`),
      Api.get('/api/pacientes'),
    ]);
    $('#dash-turnos-hoy').textContent = turnos.length;
    $('#dash-pacientes').textContent = pacientes.length;
    $('#dash-tabla-turnos').innerHTML = renderTablaTurnos(turnos, { compacto: true });
    adjuntarEventosTurnos();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ---------- Pacientes ---------- */

let timerBusqueda = null;

$('#pacientes-buscar').addEventListener('input', () => {
  clearTimeout(timerBusqueda);
  timerBusqueda = setTimeout(cargarPacientes, 300);
});

$('#btn-nuevo-paciente').addEventListener('click', () => abrirFormPaciente());

async function cargarPacientes() {
  try {
    const q = $('#pacientes-buscar').value.trim();
    const pacientes = await Api.get(`/api/pacientes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    $('#pacientes-tabla').innerHTML = renderTablaPacientes(pacientes);
    adjuntarEventosPacientes();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderTablaPacientes(pacientes) {
  if (!pacientes.length) return '<div class="vacio">No hay pacientes registrados todavia.</div>';
  const filas = pacientes
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.apellido)}, ${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.dni) || '-'}</td>
        <td>${escapeHtml(p.telefono) || '-'}</td>
        <td>${escapeHtml(p.obra_social) || '-'}</td>
        <td class="acciones">
          <button class="secundario" data-ver="${p.id}">Ver ficha</button>
        </td>
      </tr>`
    )
    .join('');
  return `<table><thead><tr><th>Paciente</th><th>DNI</th><th>Telefono</th><th>Obra social</th><th></th></tr></thead><tbody>${filas}</tbody></table>`;
}

function adjuntarEventosPacientes() {
  $$('#pacientes-tabla [data-ver]').forEach((btn) => {
    btn.addEventListener('click', () => abrirFichaPaciente(btn.dataset.ver));
  });
}

function abrirFormPaciente(paciente) {
  const esEdicion = !!paciente;
  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>${esEdicion ? 'Editar paciente' : 'Nuevo paciente'}</h2>
    <form id="form-paciente">
      <div class="grid-2">
        <div class="campo"><label>Nombre</label><input name="nombre" required value="${escapeHtml(paciente?.nombre)}" /></div>
        <div class="campo"><label>Apellido</label><input name="apellido" required value="${escapeHtml(paciente?.apellido)}" /></div>
      </div>
      <div class="grid-2">
        <div class="campo"><label>DNI</label><input name="dni" value="${escapeHtml(paciente?.dni)}" /></div>
        <div class="campo"><label>Fecha de nacimiento</label><input type="date" name="fecha_nacimiento" value="${escapeHtml(paciente?.fecha_nacimiento)}" /></div>
      </div>
      <div class="grid-2">
        <div class="campo"><label>Telefono</label><input name="telefono" value="${escapeHtml(paciente?.telefono)}" /></div>
        <div class="campo"><label>Email</label><input type="email" name="email" value="${escapeHtml(paciente?.email)}" /></div>
      </div>
      <div class="campo"><label>Direccion</label><input name="direccion" value="${escapeHtml(paciente?.direccion)}" /></div>
      <div class="campo"><label>Obra social</label><input name="obra_social" value="${escapeHtml(paciente?.obra_social)}" /></div>
      <div class="campo"><label>Notas</label><textarea name="notas">${escapeHtml(paciente?.notas)}</textarea></div>
      <button type="submit" style="width:100%">${esEdicion ? 'Guardar cambios' : 'Crear paciente'}</button>
    </form>
  `);

  $('#form-paciente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (esEdicion) {
        await Api.put(`/api/pacientes/${paciente.id}`, datos);
        toast('Paciente actualizado', 'exito');
      } else {
        await Api.post('/api/pacientes', datos);
        toast('Paciente creado', 'exito');
      }
      cerrarPanel();
      cargarPacientes();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function abrirFichaPaciente(id) {
  try {
    const paciente = await Api.get(`/api/pacientes/${id}`);
    const puedeClinica = usuarioActual.rol === 'admin' || usuarioActual.rol === 'doctor';
    abrirPanel(`
      <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
      <h2>${escapeHtml(paciente.apellido)}, ${escapeHtml(paciente.nombre)}</h2>
      <p style="color:#667">DNI: ${escapeHtml(paciente.dni) || '-'} · Tel: ${escapeHtml(paciente.telefono) || '-'} · ${escapeHtml(paciente.obra_social) || 'Sin obra social'}</p>
      <div class="tabs">
        <button class="tab-btn activo" data-tab="datos">Datos</button>
        ${puedeClinica ? '<button class="tab-btn" data-tab="clinica">Historia clinica</button>' : ''}
        ${puedeClinica ? '<button class="tab-btn" data-tab="recetas">Recetas</button>' : ''}
      </div>
      <div id="tab-datos" class="tab-contenido">
        <div class="campo"><label>Fecha de nacimiento</label><div>${escapeHtml(paciente.fecha_nacimiento) || '-'}</div></div>
        <div class="campo"><label>Email</label><div>${escapeHtml(paciente.email) || '-'}</div></div>
        <div class="campo"><label>Direccion</label><div>${escapeHtml(paciente.direccion) || '-'}</div></div>
        <div class="campo"><label>Notas</label><div>${escapeHtml(paciente.notas) || '-'}</div></div>
        <button class="secundario" id="btn-editar-paciente">Editar datos</button>
      </div>
      ${puedeClinica ? `<div id="tab-clinica" class="tab-contenido oculto"></div>` : ''}
      ${puedeClinica ? `<div id="tab-recetas" class="tab-contenido oculto"></div>` : ''}
    `);

    $('#btn-editar-paciente').addEventListener('click', () => abrirFormPaciente(paciente));

    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach((b) => b.classList.toggle('activo', b === btn));
        $$('.tab-contenido').forEach((c) => c.classList.toggle('oculto', c.id !== `tab-${btn.dataset.tab}`));
      });
    });

    if (puedeClinica) {
      cargarHistoriaClinica(paciente.id);
      cargarRecetas(paciente.id);
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ---------- Historia clinica ---------- */

async function cargarHistoriaClinica(pacienteId) {
  const cont = $('#tab-clinica');
  if (!cont) return;
  try {
    const historias = await Api.get(`/api/historias/paciente/${pacienteId}`);
    cont.innerHTML = `
      <button id="btn-nueva-historia">+ Nueva consulta</button>
      <div style="margin-top:14px">
        ${
          historias.length
            ? historias
                .map(
                  (h) => `
              <div class="tarjeta-registro">
                <div class="fecha">${escapeHtml(h.fecha)}</div>
                <div><strong>Motivo:</strong> ${escapeHtml(h.motivo_consulta) || '-'}</div>
                <div><strong>Diagnostico:</strong> ${escapeHtml(h.diagnostico) || '-'}</div>
                <div><strong>Tratamiento:</strong> ${escapeHtml(h.tratamiento) || '-'}</div>
                ${h.observaciones ? `<div><strong>Observaciones:</strong> ${escapeHtml(h.observaciones)}</div>` : ''}
                <div class="doctor">Dr./Dra. ${escapeHtml(h.doctor_nombre) || '-'}</div>
              </div>`
                )
                .join('')
            : '<div class="vacio">Sin registros de historia clinica.</div>'
        }
      </div>
    `;
    $('#btn-nueva-historia').addEventListener('click', () => abrirFormHistoria(pacienteId));
  } catch (e) {
    toast(e.message, 'error');
  }
}

function abrirFormHistoria(pacienteId) {
  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>Nueva consulta</h2>
    <form id="form-historia">
      <div class="campo"><label>Motivo de consulta</label><textarea name="motivo_consulta"></textarea></div>
      <div class="campo"><label>Diagnostico</label><textarea name="diagnostico"></textarea></div>
      <div class="campo"><label>Tratamiento</label><textarea name="tratamiento"></textarea></div>
      <div class="campo"><label>Observaciones</label><textarea name="observaciones"></textarea></div>
      <button type="submit" style="width:100%">Guardar</button>
    </form>
  `);
  $('#form-historia').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    datos.paciente_id = pacienteId;
    try {
      await Api.post('/api/historias', datos);
      toast('Consulta guardada', 'exito');
      abrirFichaPaciente(pacienteId);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ---------- Recetas ---------- */

async function cargarRecetas(pacienteId) {
  const cont = $('#tab-recetas');
  if (!cont) return;
  try {
    const recetas = await Api.get(`/api/recetas/paciente/${pacienteId}`);
    cont.innerHTML = `
      <button id="btn-nueva-receta">+ Nueva receta</button>
      <div style="margin-top:14px">
        ${
          recetas.length
            ? recetas
                .map(
                  (r) => `
              <div class="tarjeta-registro">
                <div class="fecha">${escapeHtml(r.fecha)}</div>
                <div><strong>Medicamentos:</strong> ${escapeHtml(r.medicamentos)}</div>
                ${r.indicaciones ? `<div><strong>Indicaciones:</strong> ${escapeHtml(r.indicaciones)}</div>` : ''}
                <div class="doctor">Dr./Dra. ${escapeHtml(r.doctor_nombre) || '-'}</div>
              </div>`
                )
                .join('')
            : '<div class="vacio">Sin recetas registradas.</div>'
        }
      </div>
    `;
    $('#btn-nueva-receta').addEventListener('click', () => abrirFormReceta(pacienteId));
  } catch (e) {
    toast(e.message, 'error');
  }
}

function abrirFormReceta(pacienteId) {
  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>Nueva receta</h2>
    <form id="form-receta">
      <div class="campo"><label>Medicamentos</label><textarea name="medicamentos" required placeholder="Ej: Amoxicilina 500mg cada 8hs por 7 dias"></textarea></div>
      <div class="campo"><label>Indicaciones</label><textarea name="indicaciones"></textarea></div>
      <button type="submit" style="width:100%">Guardar receta</button>
    </form>
  `);
  $('#form-receta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    datos.paciente_id = pacienteId;
    try {
      await Api.post('/api/recetas', datos);
      toast('Receta guardada', 'exito');
      abrirFichaPaciente(pacienteId);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ---------- Turnos / Agenda ---------- */

$('#turnos-fecha').addEventListener('change', cargarTurnos);
$('#btn-nuevo-turno').addEventListener('click', () => abrirFormTurno());

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

async function cargarTurnos() {
  if (!$('#turnos-fecha').value) $('#turnos-fecha').value = fechaHoy();
  try {
    const fecha = $('#turnos-fecha').value;
    const turnos = await Api.get(`/api/turnos?fecha=${fecha}`);
    $('#turnos-tabla').innerHTML = renderTablaTurnos(turnos, { compacto: false });
    adjuntarEventosTurnos();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderTablaTurnos(turnos, { compacto }) {
  if (!turnos.length) return '<div class="vacio">No hay turnos para esta fecha.</div>';
  const puedeGestionar = usuarioActual.rol === 'admin' || usuarioActual.rol === 'recepcion';
  const filas = turnos
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.hora)}</td>
        <td>${escapeHtml(t.paciente_apellido)}, ${escapeHtml(t.paciente_nombre)}</td>
        <td>${escapeHtml(t.doctor_nombre) || '-'}</td>
        <td>${escapeHtml(t.motivo) || '-'}</td>
        <td>
          <select data-estado="${t.id}" class="badge-select">
            ${['pendiente', 'confirmado', 'atendido', 'cancelado']
              .map((e) => `<option value="${e}" ${e === t.estado ? 'selected' : ''}>${e}</option>`)
              .join('')}
          </select>
        </td>
        ${
          !compacto && puedeGestionar
            ? `<td class="acciones"><button class="secundario" data-editar-turno="${t.id}">Editar</button><button class="peligro" data-eliminar-turno="${t.id}">Eliminar</button></td>`
            : compacto
            ? '<td></td>'
            : '<td></td>'
        }
      </tr>`
    )
    .join('');
  return `<table><thead><tr><th>Hora</th><th>Paciente</th><th>Doctor/a</th><th>Motivo</th><th>Estado</th><th></th></tr></thead><tbody>${filas}</tbody></table>`;
}

function adjuntarEventosTurnos() {
  $$('[data-estado]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await Api.put(`/api/turnos/${sel.dataset.estado}/estado`, { estado: sel.value });
        toast('Estado actualizado', 'exito');
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });
  $$('[data-editar-turno]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const turnos = await Api.get(`/api/turnos?fecha=${$('#turnos-fecha').value}`);
      const turno = turnos.find((t) => String(t.id) === btn.dataset.editarTurno);
      abrirFormTurno(turno);
    });
  });
  $$('[data-eliminar-turno]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este turno?')) return;
      try {
        await Api.del(`/api/turnos/${btn.dataset.eliminarTurno}`);
        toast('Turno eliminado', 'exito');
        cargarTurnos();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });
}

async function abrirFormTurno(turno) {
  const esEdicion = !!turno;
  if (!doctoresCache.length) {
    try {
      doctoresCache = await Api.get('/api/usuarios/doctores');
    } catch (e) {
      doctoresCache = [];
    }
  }
  let pacientesOpciones = [];
  try {
    pacientesOpciones = await Api.get('/api/pacientes');
  } catch (e) {
    pacientesOpciones = [];
  }

  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>${esEdicion ? 'Editar turno' : 'Nuevo turno'}</h2>
    <form id="form-turno">
      <div class="campo">
        <label>Paciente</label>
        <select name="paciente_id" required>
          <option value="">Seleccionar...</option>
          ${pacientesOpciones
            .map(
              (p) =>
                `<option value="${p.id}" ${turno && turno.paciente_id === p.id ? 'selected' : ''}>${escapeHtml(p.apellido)}, ${escapeHtml(p.nombre)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="campo">
        <label>Doctor/a</label>
        <select name="doctor_id">
          <option value="">Sin asignar</option>
          ${doctoresCache
            .map(
              (d) =>
                `<option value="${d.id}" ${turno && turno.doctor_id === d.id ? 'selected' : ''}>${escapeHtml(d.nombre_completo)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="grid-2">
        <div class="campo"><label>Fecha</label><input type="date" name="fecha" required value="${turno ? turno.fecha : $('#turnos-fecha').value || fechaHoy()}" /></div>
        <div class="campo"><label>Hora</label><input type="time" name="hora" required value="${turno ? turno.hora : ''}" /></div>
      </div>
      <div class="campo"><label>Motivo</label><input name="motivo" value="${escapeHtml(turno?.motivo)}" /></div>
      <button type="submit" style="width:100%">${esEdicion ? 'Guardar cambios' : 'Crear turno'}</button>
    </form>
  `);

  $('#form-turno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    if (!datos.doctor_id) delete datos.doctor_id;
    try {
      if (esEdicion) {
        await Api.put(`/api/turnos/${turno.id}`, datos);
        toast('Turno actualizado', 'exito');
      } else {
        await Api.post('/api/turnos', datos);
        toast('Turno creado', 'exito');
      }
      cerrarPanel();
      cargarTurnos();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ---------- Usuarios (solo admin) ---------- */

$('#btn-nuevo-usuario').addEventListener('click', () => abrirFormUsuario());

async function cargarUsuarios() {
  if (usuarioActual.rol !== 'admin') return;
  try {
    const usuarios = await Api.get('/api/usuarios');
    $('#usuarios-tabla').innerHTML = renderTablaUsuarios(usuarios);
    adjuntarEventosUsuarios();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderTablaUsuarios(usuarios) {
  const filas = usuarios
    .map(
      (u) => `
      <tr>
        <td>${escapeHtml(u.nombre_completo)}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${etiquetaRol(u.rol)}</td>
        <td>${u.activo ? 'Activo' : 'Inactivo'}</td>
        <td class="acciones">
          <button class="secundario" data-resetpass="${u.id}">Restablecer contraseña</button>
          <button class="${u.activo ? 'peligro' : ''}" data-toggle="${u.id}" data-valor="${u.activo ? 0 : 1}">${u.activo ? 'Desactivar' : 'Activar'}</button>
        </td>
      </tr>`
    )
    .join('');
  return `<table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>${filas}</tbody></table>`;
}

function adjuntarEventosUsuarios() {
  $$('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await Api.put(`/api/usuarios/${btn.dataset.toggle}/activo`, { activo: Number(btn.dataset.valor) });
        cargarUsuarios();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });
  $$('[data-resetpass]').forEach((btn) => {
    btn.addEventListener('click', () => abrirFormResetPassword(btn.dataset.resetpass));
  });
}

function abrirFormResetPassword(usuarioId) {
  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>Restablecer contraseña</h2>
    <form id="form-reset-password">
      <div class="campo"><label>Nueva contraseña</label><input type="password" name="password_nuevo" required minlength="4" /></div>
      <button type="submit" style="width:100%">Guardar</button>
    </form>
  `);
  $('#form-reset-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.put(`/api/usuarios/${usuarioId}/password`, datos);
      toast('Contraseña actualizada', 'exito');
      cerrarPanel();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function abrirFormUsuario() {
  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>Nuevo usuario</h2>
    <form id="form-usuario">
      <div class="campo"><label>Nombre completo</label><input name="nombre_completo" required /></div>
      <div class="campo"><label>Usuario</label><input name="username" required /></div>
      <div class="campo"><label>Contraseña</label><input type="password" name="password" required /></div>
      <div class="campo">
        <label>Rol</label>
        <select name="rol" required>
          <option value="recepcion">Recepcion</option>
          <option value="doctor">Doctor/a</option>
          <option value="admin">Administrador/a</option>
        </select>
      </div>
      <button type="submit" style="width:100%">Crear usuario</button>
    </form>
  `);
  $('#form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.post('/api/usuarios', datos);
      toast('Usuario creado', 'exito');
      cerrarPanel();
      cargarUsuarios();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ---------- Arranque ---------- */

async function iniciar() {
  const url = await window.configAPI.getServerUrl();
  if (!url) {
    iniciarConfig();
    return;
  }
  Api.setBaseUrl(url);
  try {
    await Api.healthCheck(url);
  } catch (e) {
    iniciarConfig(url);
    setTimeout(() => {
      $('#config-error').textContent = 'No se pudo conectar al ultimo servidor guardado. Verifica la conexion.';
      $('#config-error').classList.remove('oculto');
    }, 100);
    return;
  }

  const token = Api.getToken();
  if (token) {
    try {
      const data = await Api.get('/api/usuarios/me');
      usuarioActual = data.usuario;
      iniciarApp();
      return;
    } catch (e) {
      Api.setToken('');
    }
  }
  mostrarLogin();
}

iniciar();
