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

// Devuelve un <div> con el campo solo si tiene contenido; si no, no muestra nada.
function campoOpcional(etiqueta, valor) {
  if (!valor) return '';
  return `<div><strong>${escapeHtml(etiqueta)}:</strong> ${escapeHtml(valor)}</div>`;
}

// La historia clinica guarda h.fecha en UTC (datetime('now') de SQLite);
// esta funcion la muestra convertida a la hora local de la PC.
function formatearFecha(fechaUtcTexto) {
  if (!fechaUtcTexto) return '-';
  const fecha = new Date(`${fechaUtcTexto.replace(' ', 'T')}Z`);
  if (Number.isNaN(fecha.getTime())) return fechaUtcTexto;
  return fecha.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

// Redimensiona/comprime una imagen en el navegador antes de mandarla al
// servidor, asi no importa el tamaño de la foto original (camara, celular, etc).
function redimensionarImagen(dataUrl, maxDim = 640, calidad = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
    img.src = dataUrl;
  });
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

async function descargarDocumento(path, nombreSugerido) {
  try {
    const datos = await Api.getBinary(path);
    const resultado = await window.archivoAPI.guardar(nombreSugerido, datos);
    if (resultado.ok) {
      toast(resultado.abierto ? 'Documento guardado y abierto' : 'Documento guardado (no se pudo abrir automaticamente)', 'exito');
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ---------- Panel lateral reutilizable ---------- */

let alCerrarPanel = null;

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
  if (alCerrarPanel) {
    alCerrarPanel();
    alCerrarPanel = null;
  }
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
  $('#nav-configuracion').classList.toggle('oculto', usuarioActual.rol !== 'admin');
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
  if (vista === 'configuracion') {
    cargarConfiguracionConsultorio();
    cargarConfiguracionSmtp();
  }
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
    cargarAvataresPacientes(pacientes);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function cargarAvataresPacientes(pacientes) {
  pacientes
    .filter((p) => p.foto)
    .forEach((p) => {
      Api.getBlobUrl(`/api/pacientes/${p.id}/foto`).then((url) => {
        if (!url) return;
        const contenedor = document.querySelector(`[data-avatar-mini="${p.id}"]`);
        if (contenedor) contenedor.innerHTML = `<img src="${url}" alt="" />`;
      });
    });
}

function renderTablaPacientes(pacientes) {
  if (!pacientes.length) return '<div class="vacio">No hay pacientes registrados todavia.</div>';
  const puedeEliminar = usuarioActual.permisos.pacientes_eliminar;
  const filas = pacientes
    .map(
      (p) => `
      <tr>
        <td>
          <span class="avatar-mini" data-avatar-mini="${p.id}"><span>${escapeHtml((p.nombre || '?').charAt(0).toUpperCase())}</span></span>${escapeHtml(p.apellido)}, ${escapeHtml(p.nombre)}
        </td>
        <td>${escapeHtml(p.dni) || '-'}</td>
        <td>${escapeHtml(p.telefono) || '-'}</td>
        <td>${escapeHtml(p.obra_social) || '-'}</td>
        <td class="acciones">
          <button class="secundario" data-ver="${p.id}">Ver ficha</button>
          ${puedeEliminar ? `<button class="peligro" data-eliminar-paciente="${p.id}">Eliminar</button>` : ''}
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
  $$('#pacientes-tabla [data-eliminar-paciente]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este paciente? Se borran tambien sus turnos e historia clinica.')) return;
      try {
        await Api.del(`/api/pacientes/${btn.dataset.eliminarPaciente}`);
        toast('Paciente eliminado', 'exito');
        cargarPacientes();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });
}

function abrirFormPaciente(paciente) {
  const esEdicion = !!paciente;
  let fotoPendiente; // undefined = sin cambios, string dataURL = foto nueva, null = se quiere quitar
  let streamCamara = null;

  function detenerCamara() {
    if (streamCamara) {
      streamCamara.getTracks().forEach((t) => t.stop());
      streamCamara = null;
    }
    const contenedor = $('#camara-contenedor');
    if (contenedor) contenedor.classList.add('oculto');
  }
  alCerrarPanel = detenerCamara;

  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>${esEdicion ? 'Editar paciente' : 'Nuevo paciente'}</h2>
    <div class="campo foto-paciente-editor">
      <label>Foto</label>
      <div style="display:flex; align-items:center; gap:16px;">
        <div class="foto-paciente-avatar" id="foto-preview-contenedor">
          <img id="foto-preview-img" class="oculto" />
          <span id="foto-preview-inicial">${escapeHtml((paciente?.nombre || '?').charAt(0).toUpperCase())}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="secundario" id="btn-subir-foto">Subir desde el PC</button>
            <button type="button" class="secundario" id="btn-tomar-foto">Tomar foto</button>
            <button type="button" class="secundario oculto" id="btn-quitar-foto">Quitar foto</button>
          </div>
          <input type="file" id="input-foto" accept="image/*" class="oculto" />
        </div>
      </div>
      <div id="camara-contenedor" class="oculto" style="margin-top:10px;">
        <video id="camara-video" autoplay playsinline style="width:100%; max-width:320px; border-radius:8px; background:#000;"></video>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button type="button" id="btn-capturar-foto">Capturar</button>
          <button type="button" class="secundario" id="btn-cancelar-camara">Cancelar</button>
        </div>
      </div>
    </div>
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
      <div class="grid-2">
        <div class="campo">
          <label>Sexo</label>
          <select name="sexo">
            <option value="">Sin especificar</option>
            ${['Femenino', 'Masculino', 'Otro']
              .map((op) => `<option value="${op}" ${paciente?.sexo === op ? 'selected' : ''}>${op}</option>`)
              .join('')}
          </select>
        </div>
        <div class="campo">
          <label>Estado civil</label>
          <select name="estado_civil">
            <option value="">Sin especificar</option>
            ${['Soltero/a', 'Casado/a', 'Union libre', 'Divorciado/a', 'Viudo/a']
              .map((op) => `<option value="${op}" ${paciente?.estado_civil === op ? 'selected' : ''}>${op}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <div class="campo"><label>Direccion</label><input name="direccion" value="${escapeHtml(paciente?.direccion)}" /></div>
      <div class="grid-2">
        <div class="campo"><label>Obra social</label><input name="obra_social" value="${escapeHtml(paciente?.obra_social)}" /></div>
        <div class="campo"><label>Aseguradora</label><input name="aseguradora" value="${escapeHtml(paciente?.aseguradora)}" /></div>
      </div>
      <div class="campo"><label>Notas</label><textarea name="notas">${escapeHtml(paciente?.notas)}</textarea></div>
      <button type="submit" style="width:100%">${esEdicion ? 'Guardar cambios' : 'Crear paciente'}</button>
    </form>
  `);

  function mostrarPreviewFoto(url) {
    $('#foto-preview-img').src = url;
    $('#foto-preview-img').classList.remove('oculto');
    $('#foto-preview-inicial').classList.add('oculto');
    $('#btn-quitar-foto').classList.remove('oculto');
  }

  function ocultarPreviewFoto() {
    $('#foto-preview-img').classList.add('oculto');
    $('#foto-preview-img').src = '';
    $('#foto-preview-inicial').classList.remove('oculto');
    $('#btn-quitar-foto').classList.add('oculto');
  }

  if (esEdicion && paciente.foto) {
    Api.getBlobUrl(`/api/pacientes/${paciente.id}/foto`).then((url) => {
      if (url) mostrarPreviewFoto(url);
    });
  }

  $('#btn-subir-foto').addEventListener('click', () => $('#input-foto').click());
  $('#input-foto').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const original = await leerArchivoComoDataUrl(archivo);
      const redimensionado = await redimensionarImagen(original);
      fotoPendiente = redimensionado;
      mostrarPreviewFoto(redimensionado);
    } catch (err) {
      toast(err.message, 'error');
    }
    e.target.value = '';
  });

  $('#btn-quitar-foto').addEventListener('click', () => {
    fotoPendiente = null;
    ocultarPreviewFoto();
  });

  $('#btn-tomar-foto').addEventListener('click', async () => {
    try {
      streamCamara = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      $('#camara-video').srcObject = streamCamara;
      $('#camara-contenedor').classList.remove('oculto');
    } catch (err) {
      toast('No se pudo acceder a la camara. Revisa que este conectada y que Windows le de permiso a la app.', 'error');
    }
  });

  $('#btn-cancelar-camara').addEventListener('click', detenerCamara);

  $('#btn-capturar-foto').addEventListener('click', async () => {
    const video = $('#camara-video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    try {
      const redimensionado = await redimensionarImagen(canvas.toDataURL('image/jpeg', 0.9));
      fotoPendiente = redimensionado;
      mostrarPreviewFoto(redimensionado);
    } catch (err) {
      toast(err.message, 'error');
    }
    detenerCamara();
  });

  $('#form-paciente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    try {
      let pacienteId = paciente?.id;
      if (esEdicion) {
        await Api.put(`/api/pacientes/${pacienteId}`, datos);
      } else {
        const creado = await Api.post('/api/pacientes', datos);
        pacienteId = creado.id;
      }
      if (fotoPendiente === null) {
        await Api.del(`/api/pacientes/${pacienteId}/foto`);
      } else if (typeof fotoPendiente === 'string') {
        await Api.put(`/api/pacientes/${pacienteId}/foto`, { foto: fotoPendiente });
      }
      toast(esEdicion ? 'Paciente actualizado' : 'Paciente creado', 'exito');
      detenerCamara();
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
    abrirPanel(`
      <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:4px;">
        <div class="foto-paciente-avatar" id="ficha-avatar">
          <span>${escapeHtml((paciente.nombre || '?').charAt(0).toUpperCase())}</span>
        </div>
        <div>
          <h2 style="margin:0">${escapeHtml(paciente.apellido)}, ${escapeHtml(paciente.nombre)}</h2>
          <p style="color:#667; margin:4px 0 0;">DNI: ${escapeHtml(paciente.dni) || '-'} · Tel: ${escapeHtml(paciente.telefono) || '-'} · ${escapeHtml(paciente.obra_social) || 'Sin obra social'}</p>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn activo" data-tab="datos">Datos</button>
        <button class="tab-btn" data-tab="clinica">Historia clinica</button>
      </div>
      <div id="tab-datos" class="tab-contenido">
        <div class="campo"><label>Fecha de nacimiento</label><div>${escapeHtml(paciente.fecha_nacimiento) || '-'}</div></div>
        <div class="campo"><label>Sexo</label><div>${escapeHtml(paciente.sexo) || '-'}</div></div>
        <div class="campo"><label>Estado civil</label><div>${escapeHtml(paciente.estado_civil) || '-'}</div></div>
        <div class="campo"><label>Aseguradora</label><div>${escapeHtml(paciente.aseguradora) || '-'}</div></div>
        <div class="campo"><label>Email</label><div>${escapeHtml(paciente.email) || '-'}</div></div>
        <div class="campo"><label>Direccion</label><div>${escapeHtml(paciente.direccion) || '-'}</div></div>
        <div class="campo"><label>Notas</label><div>${escapeHtml(paciente.notas) || '-'}</div></div>
        <button class="secundario" id="btn-editar-paciente">Editar datos</button>
      </div>
      <div id="tab-clinica" class="tab-contenido oculto"></div>
    `);

    $('#btn-editar-paciente').addEventListener('click', () => abrirFormPaciente(paciente));

    if (paciente.foto) {
      Api.getBlobUrl(`/api/pacientes/${paciente.id}/foto`).then((url) => {
        if (url) $('#ficha-avatar').innerHTML = `<img src="${url}" alt="" />`;
      });
    }

    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach((b) => b.classList.toggle('activo', b === btn));
        $$('.tab-contenido').forEach((c) => c.classList.toggle('oculto', c.id !== `tab-${btn.dataset.tab}`));
      });
    });

    cargarHistoriaClinica(paciente.id);
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ---------- Historia clinica ---------- */

async function cargarHistoriaClinica(pacienteId) {
  const cont = $('#tab-clinica');
  if (!cont) return;
  try {
    const puedeGestionar = usuarioActual.permisos.historia_gestionar;
    const historias = await Api.get(`/api/historias/paciente/${pacienteId}`);
    const historiasPorId = new Map(historias.map((h) => [String(h.id), h]));
    cont.innerHTML = `
      ${puedeGestionar ? '<button id="btn-nueva-historia">+ Nueva valoracion</button>' : ''}
      <div style="margin-top:14px">
        ${
          historias.length
            ? historias
                .map(
                  (h) => `
              <div class="tarjeta-registro">
                <div class="fecha">${escapeHtml(formatearFecha(h.fecha))} ${h.editable ? '' : '<span style="color:#a12b2b; font-weight:600;">· Bloqueada (mas de 48hs)</span>'}</div>
                <div><strong>Motivo:</strong> ${escapeHtml(h.motivo_consulta) || '-'}</div>
                ${campoOpcional('Antecedentes heredo familiares', h.antecedentes_heredo_familiares)}
                ${campoOpcional('Antecedentes personales no patologicos', h.antecedentes_personales_no_patologicos)}
                ${campoOpcional('Antecedentes personales patologicos', h.antecedentes_personales_patologicos)}
                ${campoOpcional('Enfermedad actual', h.enfermedad_actual)}
                ${campoOpcional('Cuadro clinico', h.cuadro_clinico)}
                ${campoOpcional('Sintomas generales', h.sintomas_generales)}
                ${campoOpcional('Habitus exterior', h.habitus_exterior)}
                <div><strong>Presion arterial:</strong> ${escapeHtml(h.presion_arterial) || '-'}</div>
                <div><strong>Peso:</strong> ${escapeHtml(h.peso) || '-'}</div>
                ${campoOpcional('Glucometria', h.glucometria)}
                ${campoOpcional('IMC', h.imc)}
                ${campoOpcional('Perimetro abdominal', h.perimetro_abdominal)}
                ${campoOpcional('Talla', h.talla)}
                ${campoOpcional('Exploracion fisica', h.exploracion_fisica)}
                <div><strong>Diagnostico:</strong> ${escapeHtml(h.diagnostico) || '-'}</div>
                <div><strong>Tratamiento:</strong> ${escapeHtml(h.tratamiento) || '-'}</div>
                ${campoOpcional('Examenes de laboratorio', h.examenes_laboratorio)}
                ${h.observaciones ? `<div><strong>Observaciones:</strong> ${escapeHtml(h.observaciones)}</div>` : ''}
                <div class="doctor">Dr./Dra. ${escapeHtml(h.doctor_nombre) || '-'}</div>
                <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
                  ${puedeGestionar && h.editable ? `<button class="secundario" data-editar-historia="${h.id}">Editar</button>` : ''}
                  <button class="secundario" data-exportar-historia="${h.id}">Exportar a Word</button>
                  <button class="secundario" data-exportar-tratamiento="${h.id}">Exportar tratamiento (para imprimir)</button>
                  <button class="secundario" data-exportar-examenes="${h.id}">Exportar examenes (para imprimir)</button>
                  <button class="secundario" data-email-historia="${h.id}">Enviar por email</button>
                </div>
              </div>`
                )
                .join('')
            : '<div class="vacio">Sin registros de historia clinica.</div>'
        }
      </div>
    `;
    if (puedeGestionar) {
      $('#btn-nueva-historia').addEventListener('click', () => abrirFormHistoria(pacienteId));
    }
    $$('#tab-clinica [data-editar-historia]').forEach((btn) => {
      btn.addEventListener('click', () =>
        abrirFormHistoria(pacienteId, historiasPorId.get(btn.dataset.editarHistoria))
      );
    });
    $$('#tab-clinica [data-exportar-historia]').forEach((btn) => {
      btn.addEventListener('click', () =>
        descargarDocumento(
          `/api/historias/${btn.dataset.exportarHistoria}/exportar-word`,
          `historia-clinica-${btn.dataset.exportarHistoria}.docx`
        )
      );
    });
    $$('#tab-clinica [data-exportar-tratamiento]').forEach((btn) => {
      btn.addEventListener('click', () =>
        descargarDocumento(
          `/api/historias/${btn.dataset.exportarTratamiento}/exportar-tratamiento-word`,
          `tratamiento-${btn.dataset.exportarTratamiento}.docx`
        )
      );
    });
    $$('#tab-clinica [data-exportar-examenes]').forEach((btn) => {
      btn.addEventListener('click', () =>
        descargarDocumento(
          `/api/historias/${btn.dataset.exportarExamenes}/exportar-examenes-word`,
          `examenes-${btn.dataset.exportarExamenes}.docx`
        )
      );
    });
    $$('#tab-clinica [data-email-historia]').forEach((btn) => {
      btn.addEventListener('click', () => abrirFormEnviarEmail(btn.dataset.emailHistoria, pacienteId));
    });
  } catch (e) {
    toast(e.message, 'error');
  }
}

function abrirFormHistoria(pacienteId, historiaExistente) {
  const esEdicion = !!historiaExistente;
  const ahora = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>${esEdicion ? 'Editar valoracion' : 'Nueva valoracion'}</h2>
    <p style="color:#667">
      ${
        esEdicion
          ? `Fecha y hora: <strong>${escapeHtml(formatearFecha(historiaExistente.fecha))}</strong> (no se puede modificar; se puede editar hasta 48hs despues de creada)`
          : `Fecha y hora: <strong>${escapeHtml(ahora)}</strong> (se registra automaticamente)`
      }
    </p>
    <form id="form-historia">
      <div class="campo"><label>Motivo de consulta</label><textarea name="motivo_consulta">${escapeHtml(historiaExistente?.motivo_consulta)}</textarea></div>
      <div class="campo"><label>Antecedentes heredo familiares</label><textarea name="antecedentes_heredo_familiares">${escapeHtml(historiaExistente?.antecedentes_heredo_familiares)}</textarea></div>
      <div class="campo"><label>Antecedentes personales no patologicos</label><textarea name="antecedentes_personales_no_patologicos">${escapeHtml(historiaExistente?.antecedentes_personales_no_patologicos)}</textarea></div>
      <div class="campo"><label>Antecedentes personales patologicos</label><textarea name="antecedentes_personales_patologicos">${escapeHtml(historiaExistente?.antecedentes_personales_patologicos)}</textarea></div>
      <div class="campo"><label>Enfermedad actual</label><textarea name="enfermedad_actual">${escapeHtml(historiaExistente?.enfermedad_actual)}</textarea></div>
      <div class="campo"><label>Cuadro clinico</label><textarea name="cuadro_clinico">${escapeHtml(historiaExistente?.cuadro_clinico)}</textarea></div>
      <div class="campo"><label>Sintomas generales</label><textarea name="sintomas_generales">${escapeHtml(historiaExistente?.sintomas_generales)}</textarea></div>
      <div class="campo"><label>Habitus exterior</label><textarea name="habitus_exterior">${escapeHtml(historiaExistente?.habitus_exterior)}</textarea></div>
      <h3 style="margin-bottom:6px">Signos vitales</h3>
      <div class="grid-2">
        <div class="campo"><label>Presion arterial</label><input name="presion_arterial" placeholder="Ej: 120/80" value="${escapeHtml(historiaExistente?.presion_arterial)}" /></div>
        <div class="campo"><label>Peso</label><input name="peso" placeholder="Ej: 70kg" value="${escapeHtml(historiaExistente?.peso)}" /></div>
        <div class="campo"><label>Glucometria</label><input name="glucometria" value="${escapeHtml(historiaExistente?.glucometria)}" /></div>
        <div class="campo"><label>IMC</label><input name="imc" value="${escapeHtml(historiaExistente?.imc)}" /></div>
        <div class="campo"><label>Perimetro abdominal</label><input name="perimetro_abdominal" value="${escapeHtml(historiaExistente?.perimetro_abdominal)}" /></div>
        <div class="campo"><label>Talla</label><input name="talla" value="${escapeHtml(historiaExistente?.talla)}" /></div>
      </div>
      <div class="campo"><label>Exploracion fisica</label><textarea name="exploracion_fisica">${escapeHtml(historiaExistente?.exploracion_fisica)}</textarea></div>
      <div class="campo"><label>Diagnostico</label><textarea name="diagnostico">${escapeHtml(historiaExistente?.diagnostico)}</textarea></div>
      <div class="campo"><label>Tratamiento</label><textarea name="tratamiento">${escapeHtml(historiaExistente?.tratamiento)}</textarea></div>
      <div class="campo"><label>Examenes de laboratorio</label><textarea name="examenes_laboratorio">${escapeHtml(historiaExistente?.examenes_laboratorio)}</textarea></div>
      <div class="campo"><label>Observaciones</label><textarea name="observaciones">${escapeHtml(historiaExistente?.observaciones)}</textarea></div>
      <button type="submit" style="width:100%">${esEdicion ? 'Guardar cambios' : 'Guardar'}</button>
    </form>
  `);
  $('#form-historia').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (esEdicion) {
        await Api.put(`/api/historias/${historiaExistente.id}`, datos);
        toast('Valoracion actualizada', 'exito');
      } else {
        datos.paciente_id = pacienteId;
        await Api.post('/api/historias', datos);
        toast('Consulta guardada', 'exito');
      }
      abrirFichaPaciente(pacienteId);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function abrirFormEnviarEmail(historiaId, pacienteId) {
  let emailSugerido = '';
  try {
    const paciente = await Api.get(`/api/pacientes/${pacienteId}`);
    emailSugerido = paciente.email || '';
  } catch (e) {
    // si falla la sugerencia, el campo queda vacio
  }
  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>Enviar historia clinica por email</h2>
    <form id="form-enviar-email">
      <div class="campo"><label>Email de destino</label><input type="email" name="destinatario" required value="${escapeHtml(emailSugerido)}" /></div>
      <button type="submit" style="width:100%">Enviar</button>
    </form>
  `);
  $('#form-enviar-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.post(`/api/historias/${historiaId}/enviar-email`, datos);
      toast('Email enviado', 'exito');
      cerrarPanel();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ---------- Turnos / Agenda ---------- */

$('#turnos-fecha').addEventListener('change', cargarTurnos);
$('#btn-nuevo-turno').addEventListener('click', () => abrirFormTurno());
$('#btn-descargar-agenda').addEventListener('click', () => {
  const fecha = $('#turnos-fecha').value || fechaHoy();
  descargarDocumento(`/api/turnos/exportar-word?fecha=${fecha}`, `turnos-${fecha}.docx`);
});

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
  const puedeEliminar = usuarioActual.permisos.turnos_eliminar;
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
          !compacto
            ? `<td class="acciones"><button class="secundario" data-editar-turno="${t.id}">Editar</button>${puedeEliminar ? `<button class="peligro" data-eliminar-turno="${t.id}">Eliminar</button>` : ''}</td>`
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

function configurarBuscadorPaciente({ inputBuscar, inputId, resultadosDiv }) {
  let debounceId = null;

  function ocultarResultados() {
    resultadosDiv.classList.add('oculto');
    resultadosDiv.innerHTML = '';
  }

  inputBuscar.addEventListener('input', () => {
    inputId.value = '';
    clearTimeout(debounceId);
    const q = inputBuscar.value.trim();
    if (!q) {
      ocultarResultados();
      return;
    }
    debounceId = setTimeout(async () => {
      try {
        const pacientes = await Api.get(`/api/pacientes?q=${encodeURIComponent(q)}`);
        if (!pacientes.length) {
          resultadosDiv.innerHTML = '<div class="resultado-item vacio">Sin resultados</div>';
        } else {
          resultadosDiv.innerHTML = pacientes
            .slice(0, 20)
            .map(
              (p) => `
              <div class="resultado-item" data-id="${p.id}" data-nombre="${escapeHtml(p.apellido)}, ${escapeHtml(p.nombre)}">
                <strong>${escapeHtml(p.apellido)}, ${escapeHtml(p.nombre)}</strong>
                ${p.dni ? `<span class="resultado-dni">DNI ${escapeHtml(p.dni)}</span>` : ''}
              </div>`
            )
            .join('');
        }
        resultadosDiv.classList.remove('oculto');
      } catch (e) {
        ocultarResultados();
      }
    }, 250);
  });

  resultadosDiv.addEventListener('mousedown', (e) => {
    const item = e.target.closest('[data-id]');
    if (!item) return;
    inputId.value = item.dataset.id;
    inputBuscar.value = item.dataset.nombre;
    ocultarResultados();
  });

  inputBuscar.addEventListener('blur', () => {
    setTimeout(ocultarResultados, 150);
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
  const nombrePacienteInicial = turno ? `${turno.paciente_apellido}, ${turno.paciente_nombre}` : '';

  abrirPanel(`
    <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
    <h2>${esEdicion ? 'Editar turno' : 'Nuevo turno'}</h2>
    <form id="form-turno">
      <div class="campo buscador-paciente">
        <label>Paciente</label>
        <input type="text" id="turno-buscar-paciente" autocomplete="off" placeholder="Escribi nombre, apellido o DNI..." value="${escapeHtml(nombrePacienteInicial)}" required />
        <input type="hidden" name="paciente_id" id="turno-paciente-id" value="${turno ? turno.paciente_id : ''}" />
        <div id="turno-resultados-paciente" class="resultados-buscador oculto"></div>
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

  configurarBuscadorPaciente({
    inputBuscar: $('#turno-buscar-paciente'),
    inputId: $('#turno-paciente-id'),
    resultadosDiv: $('#turno-resultados-paciente'),
  });

  $('#form-turno').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!$('#turno-paciente-id').value) {
      toast('Elegi un paciente de la lista de resultados', 'error');
      return;
    }
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
        <td>
          <select data-rol="${u.id}">
            ${['recepcion', 'doctor', 'admin']
              .map((r) => `<option value="${r}" ${r === u.rol ? 'selected' : ''}>${etiquetaRol(r)}</option>`)
              .join('')}
          </select>
        </td>
        <td>${u.activo ? 'Activo' : 'Inactivo'}</td>
        <td class="acciones">
          <button class="secundario" data-permisos="${u.id}" data-nombre="${escapeHtml(u.nombre_completo)}">Permisos</button>
          <button class="secundario" data-resetpass="${u.id}">Restablecer contraseña</button>
          <button class="${u.activo ? 'peligro' : ''}" data-toggle="${u.id}" data-valor="${u.activo ? 0 : 1}">${u.activo ? 'Desactivar' : 'Activar'}</button>
        </td>
      </tr>`
    )
    .join('');
  return `<table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol / permisos base</th><th>Estado</th><th></th></tr></thead><tbody>${filas}</tbody></table>`;
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
  $$('[data-permisos]').forEach((btn) => {
    btn.addEventListener('click', () => abrirPanelPermisos(btn.dataset.permisos, btn.dataset.nombre));
  });
  $$('[data-rol]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await Api.put(`/api/usuarios/${sel.dataset.rol}/rol`, { rol: sel.value });
        toast('Rol actualizado', 'exito');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        cargarUsuarios();
      }
    });
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

async function abrirPanelPermisos(usuarioId, nombreUsuario) {
  try {
    const permisos = await Api.get(`/api/usuarios/${usuarioId}/permisos`);
    abrirPanel(`
      <button class="secundario cerrar" onclick="cerrarPanel()">Cerrar</button>
      <h2>Permisos de ${escapeHtml(nombreUsuario)}</h2>
      <p style="color:#667">
        Los permisos ya incluidos por el rol de este usuario quedan tildados y no se pueden destildar aca
        (para eso hay que cambiarle el rol). Los demas los podes prender o apagar vos.
      </p>
      <div id="lista-permisos">
        ${Object.entries(permisos)
          .map(
            ([clave, info]) => `
            <label style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--gris-borde);">
              <input type="checkbox" data-permiso="${clave}" ${info.activo ? 'checked' : ''} ${info.porRol ? 'disabled' : ''} style="width:18px; height:18px;" />
              <span>${escapeHtml(info.etiqueta)} ${info.porRol ? '<span style="color:#889">(incluido por su rol)</span>' : ''}</span>
            </label>`
          )
          .join('')}
      </div>
    `);
    $$('#lista-permisos [data-permiso]').forEach((chk) => {
      chk.addEventListener('change', async () => {
        try {
          await Api.put(`/api/usuarios/${usuarioId}/permisos/${chk.dataset.permiso}`, { activo: chk.checked });
          toast('Permiso actualizado', 'exito');
        } catch (e) {
          toast(e.message, 'error');
          chk.checked = !chk.checked;
        }
      });
    });
  } catch (e) {
    toast(e.message, 'error');
  }
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

/* ---------- Datos del consultorio (solo admin) ---------- */

async function cargarConfiguracionConsultorio() {
  if (usuarioActual.rol !== 'admin') return;
  try {
    const config = await Api.get('/api/config/consultorio');
    const form = $('#form-consultorio');
    form.direccion.value = config.direccion || '';
    form.telefono.value = config.telefono || '';
  } catch (e) {
    toast(e.message, 'error');
  }
}

$('#form-consultorio').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target).entries());
  try {
    await Api.put('/api/config/consultorio', datos);
    toast('Datos del consultorio guardados', 'exito');
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Configuracion SMTP (solo admin) ---------- */

async function cargarConfiguracionSmtp() {
  if (usuarioActual.rol !== 'admin') return;
  try {
    const config = await Api.get('/api/config/smtp');
    const form = $('#form-smtp');
    form.host.value = config.host || '';
    form.puerto.value = config.puerto || '587';
    form.usuario.value = config.usuario || '';
    form.remitente.value = config.remitente || '';
    form.seguro.value = config.seguro ? '1' : '';
    $('#smtp-estado').textContent = config.configurado
      ? 'El envio de email por correo esta configurado.'
      : 'Todavia no configuraste el envio de email.';
  } catch (e) {
    toast(e.message, 'error');
  }
}

$('#form-smtp').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target).entries());
  datos.seguro = datos.seguro === '1';
  try {
    await Api.put('/api/config/smtp', datos);
    toast('Configuracion guardada', 'exito');
    cargarConfiguracionSmtp();
  } catch (err) {
    toast(err.message, 'error');
  }
});

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
