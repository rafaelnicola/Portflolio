const path = require('path');
const fs = require('fs');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageOrientation,
  Footer,
  convertInchesToTwip,
} = require('docx');

// Proporcion real del archivo assets/logo.png (ancho x alto en px)
const LOGO_PROPORCION = 888 / 776;
const LOGO_BUFFER = fs.readFileSync(path.join(__dirname, 'assets', 'logo.png'));

function encabezadoLogo(anchoPx) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new ImageRun({
        data: LOGO_BUFFER,
        type: 'png',
        transformation: { width: anchoPx, height: Math.round(anchoPx / LOGO_PROPORCION) },
      }),
    ],
  });
}

const BORDE_TABLA = {
  top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
};

function celda(texto, { encabezado = false, ancho } = {}) {
  return new TableCell({
    width: ancho ? { size: ancho, type: WidthType.PERCENTAGE } : undefined,
    borders: BORDE_TABLA,
    shading: encabezado ? { fill: 'E9EEF3' } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text: texto || '', bold: encabezado })],
      }),
    ],
  });
}

// h.fecha se guarda en UTC (datetime('now') de SQLite); se muestra convertida
// a la hora local de esta PC (la del servidor).
function formatearFecha(fechaUtcTexto) {
  if (!fechaUtcTexto) return '-';
  const fecha = new Date(`${fechaUtcTexto.replace(' ', 'T')}Z`);
  if (Number.isNaN(fecha.getTime())) return fechaUtcTexto;
  return fecha.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function campo(etiqueta, valor) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({ text: `${etiqueta}: `, bold: true }),
      new TextRun({ text: valor && String(valor).trim() ? String(valor) : '-' }),
    ],
  });
}

function nombrePaciente(paciente) {
  return `${paciente.apellido}, ${paciente.nombre}`;
}

const SIN_BORDE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function piePaginaConsultorio(direccion, telefono) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: SIN_BORDE,
            children: [
              new Paragraph({
                children: [new TextRun({ text: direccion || '', size: 16, color: '667788' })],
              }),
            ],
          }),
          new TableCell({
            borders: SIN_BORDE,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: telefono || '', size: 16, color: '667788' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

async function generarDocxHistoria(historia, paciente) {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } },
        },
        children: [
          encabezadoLogo(150),
          new Paragraph({
            text: 'Historia clínica',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: ' ' }),
          new Paragraph({ text: 'Datos del paciente', heading: HeadingLevel.HEADING_2 }),
          campo('Paciente', nombrePaciente(paciente)),
          campo('DNI', paciente.dni),
          campo('Fecha de nacimiento', paciente.fecha_nacimiento),
          campo('Sexo', paciente.sexo),
          campo('Estado civil', paciente.estado_civil),
          campo('Obra social / Aseguradora', paciente.aseguradora || paciente.obra_social),
          campo('Teléfono', paciente.telefono),
          new Paragraph({ text: ' ' }),
          new Paragraph({ text: 'Consulta', heading: HeadingLevel.HEADING_2 }),
          campo('Fecha y hora', formatearFecha(historia.fecha)),
          campo('Doctor/a', historia.doctor_nombre),
          campo('Motivo de consulta', historia.motivo_consulta),
          campo('Presión arterial', historia.presion_arterial),
          campo('Peso', historia.peso),
          campo('Diagnóstico', historia.diagnostico),
          campo('Tratamiento', historia.tratamiento),
          campo('Observaciones', historia.observaciones),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function generarDocxTratamiento(historia, paciente, datosConsultorio = {}) {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: convertInchesToTwip(5.5),
              height: convertInchesToTwip(8.5),
            },
            margin: { top: 540, bottom: 540, left: 540, right: 540 },
          },
        },
        footers: {
          default: new Footer({
            children: [piePaginaConsultorio(datosConsultorio.direccion, datosConsultorio.telefono)],
          }),
        },
        children: [
          encabezadoLogo(110),
          new Paragraph({
            text: 'Fórmula médica',
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: ' ' }),
          campo('Paciente', nombrePaciente(paciente)),
          campo('DNI', paciente.dni),
          campo('Fecha y hora', formatearFecha(historia.fecha)),
          campo('Doctor/a', historia.doctor_nombre),
          new Paragraph({ text: ' ' }),
          new Paragraph({ text: 'Tratamiento', heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: historia.tratamiento && historia.tratamiento.trim() ? historia.tratamiento : '-' }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function generarDocxAgenda(turnos, fecha) {
  const filas = [
    new TableRow({
      children: [
        celda('Hora', { encabezado: true, ancho: 12 }),
        celda('Paciente', { encabezado: true, ancho: 38 }),
        celda('Teléfono', { encabezado: true, ancho: 20 }),
        celda('Doctor/a', { encabezado: true, ancho: 20 }),
        celda('Estado', { encabezado: true, ancho: 10 }),
      ],
    }),
    ...turnos.map(
      (t) =>
        new TableRow({
          children: [
            celda(t.hora),
            celda(`${t.paciente_apellido}, ${t.paciente_nombre}`),
            celda(t.paciente_telefono || '-'),
            celda(t.doctor_nombre || '-'),
            celda(t.estado),
          ],
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children: [
          new Paragraph({
            text: 'Listado de turnos',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: `Fecha: ${fecha}`, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: ' ' }),
          turnos.length
            ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas })
            : new Paragraph({ text: 'No hay turnos para esta fecha.' }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

module.exports = { generarDocxHistoria, generarDocxTratamiento, generarDocxAgenda };
