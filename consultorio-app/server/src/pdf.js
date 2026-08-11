const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const LOGO_BUFFER = fs.readFileSync(path.join(__dirname, 'assets', 'logo.png'));
const LOGO_PROPORCION = 888 / 776; // ancho / alto reales del archivo assets/logo.png

function dibujarLogo(doc, anchoLogo) {
  const alto = anchoLogo / LOGO_PROPORCION;
  const x = doc.page.margins.left + (doc.page.width - doc.page.margins.left - doc.page.margins.right - anchoLogo) / 2;
  doc.image(LOGO_BUFFER, x, doc.y, { width: anchoLogo });
  doc.x = doc.page.margins.left;
  doc.y += alto + 10;
}

// h.fecha se guarda en UTC (datetime('now') de SQLite); se muestra convertida
// a la hora local de esta PC (la del servidor).
function formatearFecha(fechaUtcTexto) {
  if (!fechaUtcTexto) return '-';
  const fecha = new Date(`${fechaUtcTexto.replace(' ', 'T')}Z`);
  if (Number.isNaN(fecha.getTime())) return fechaUtcTexto;
  return fecha.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function nombrePaciente(paciente) {
  return `${paciente.apellido}, ${paciente.nombre}`;
}

function campo(doc, etiqueta, valor) {
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(`${etiqueta}: `, { continued: true })
    .font('Helvetica')
    .text(valor && String(valor).trim() ? String(valor) : '-');
  doc.moveDown(0.3);
}

function seccion(doc, titulo) {
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').text(titulo);
  doc.moveDown(0.3);
}

function generarPdfHistoria(historia, paciente) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    dibujarLogo(doc, 130);
    doc.moveDown(0.5);

    doc.fontSize(20).font('Helvetica-Bold').text('Historia clínica', { align: 'center' });

    seccion(doc, 'Datos del paciente');
    campo(doc, 'Paciente', nombrePaciente(paciente));
    campo(doc, 'DNI', paciente.dni);
    campo(doc, 'Fecha de nacimiento', paciente.fecha_nacimiento);
    campo(doc, 'Sexo', paciente.sexo);
    campo(doc, 'Estado civil', paciente.estado_civil);
    campo(doc, 'Obra social / Aseguradora', paciente.aseguradora || paciente.obra_social);
    campo(doc, 'Teléfono', paciente.telefono);

    seccion(doc, 'Consulta');
    campo(doc, 'Fecha y hora', formatearFecha(historia.fecha));
    campo(doc, 'Doctor/a', historia.doctor_nombre);
    campo(doc, 'Motivo de consulta', historia.motivo_consulta);
    campo(doc, 'Presión arterial', historia.presion_arterial);
    campo(doc, 'Peso', historia.peso);
    campo(doc, 'Diagnóstico', historia.diagnostico);
    campo(doc, 'Tratamiento', historia.tratamiento);
    campo(doc, 'Observaciones', historia.observaciones);

    doc.end();
  });
}

module.exports = { generarPdfHistoria };
