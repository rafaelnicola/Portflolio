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

// Proporcion real de los archivos en assets/ (ancho x alto en px)
const LOGO_PROPORCION = 888 / 776;
const LOGO_BUFFER = fs.readFileSync(path.join(__dirname, 'assets', 'logo.png'));
const LOGO_MARCA_PROPORCION = 1; // logo-mark.png es cuadrado (888x888)
const LOGO_MARCA_BUFFER = fs.readFileSync(path.join(__dirname, 'assets', 'logo-mark.png'));

function encabezadoLogo(anchoPx, { soloMarca = false } = {}) {
  const buffer = soloMarca ? LOGO_MARCA_BUFFER : LOGO_BUFFER;
  const proporcion = soloMarca ? LOGO_MARCA_PROPORCION : LOGO_PROPORCION;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new ImageRun({
        data: buffer,
        type: 'png',
        transformation: { width: anchoPx, height: Math.round(anchoPx / proporcion) },
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

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Formato "12/ago/2026", igual al membrete impreso que ya usan en el consultorio.
function formatearFechaCorta(fechaUtcTexto) {
  if (!fechaUtcTexto) return '-';
  const fecha = new Date(`${fechaUtcTexto.replace(' ', 'T')}Z`);
  if (Number.isNaN(fecha.getTime())) return fechaUtcTexto;
  return `${fecha.getDate()}/${MESES_CORTOS[fecha.getMonth()]}/${fecha.getFullYear()}`;
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
                children: [
                  new TextRun({ text: 'Teléfonos ', bold: true, size: 16, color: '667788' }),
                  new TextRun({ text: telefono || '', size: 16, color: '667788' }),
                ],
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
          campo('Enfermedad actual', historia.enfermedad_actual),
          campo('Antecedentes heredo familiares', historia.antecedentes_heredo_familiares),
          campo('Antecedentes personales no patológicos', historia.antecedentes_personales_no_patologicos),
          campo('Antecedentes personales patológicos', historia.antecedentes_personales_patologicos),
          new Paragraph({ text: ' ' }),
          new Paragraph({ text: 'Signos vitales', heading: HeadingLevel.HEADING_2 }),
          campo('Presión arterial', historia.presion_arterial),
          campo('Peso', historia.peso),
          campo('Glucometría', historia.glucometria),
          campo('IMC', historia.imc),
          campo('Perímetro abdominal', historia.perimetro_abdominal),
          campo('Talla', historia.talla),
          new Paragraph({ text: ' ' }),
          campo('Exploración física', historia.exploracion_fisica),
          campo('Diagnóstico', historia.diagnostico),
          campo('Tratamiento', historia.tratamiento),
          campo('Exámenes de laboratorio', historia.examenes_laboratorio),
          campo('Observaciones', historia.observaciones),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

const FUENTE_CUERPO = 'Courier New';
const TAMANO_CUERPO = 19; // 9.5pt (docx usa medios puntos)

async function generarDocxFormula(historia, paciente, datosConsultorio = {}, contenido = '') {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11),
            },
            // El pie de pagina queda a 15cm del borde inferior de la hoja (~8504 twips).
            // El margen inferior del cuerpo se iguala a esa distancia para que el texto
            // no se superponga con el pie de pagina.
            margin: { top: 720, bottom: 8504, left: 900, right: 900, footer: 8504 },
          },
        },
        footers: {
          default: new Footer({
            children: [piePaginaConsultorio(datosConsultorio.direccion, datosConsultorio.telefono)],
          }),
        },
        children: [
          encabezadoLogo(130),
          new Paragraph({
            spacing: { after: 260, line: 240, lineRule: 'auto' },
            children: [
              new TextRun({ text: 'Nombre: ', bold: true, font: FUENTE_CUERPO, size: TAMANO_CUERPO }),
              new TextRun({ text: `${nombrePaciente(paciente).toUpperCase()}    `, font: FUENTE_CUERPO, size: TAMANO_CUERPO }),
              new TextRun({ text: 'Fecha: ', bold: true, font: FUENTE_CUERPO, size: TAMANO_CUERPO }),
              new TextRun({ text: formatearFechaCorta(historia.fecha), font: FUENTE_CUERPO, size: TAMANO_CUERPO }),
            ],
          }),
          ...String(contenido || '')
            .split('\n')
            .map(
              (linea) =>
                new Paragraph({
                  // line: 240 + lineRule: 'auto' = interlineado sencillo (1.0), en vez de heredar
                  // el que tenga por defecto la plantilla de Word de quien lo abra. after: 0 para que
                  // no quede espacio extra entre una linea del tratamiento y la siguiente.
                  spacing: { after: 0, line: 240, lineRule: 'auto' },
                  children: [new TextRun({ text: linea, font: FUENTE_CUERPO, size: TAMANO_CUERPO })],
                })
            ),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function generarDocxTratamiento(historia, paciente, datosConsultorio = {}) {
  return generarDocxFormula(historia, paciente, datosConsultorio, historia.tratamiento);
}

function generarDocxExamenes(historia, paciente, datosConsultorio = {}) {
  return generarDocxFormula(historia, paciente, datosConsultorio, historia.examenes_laboratorio);
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

module.exports = { generarDocxHistoria, generarDocxTratamiento, generarDocxExamenes, generarDocxAgenda };
