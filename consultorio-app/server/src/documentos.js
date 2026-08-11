const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip,
} = require('docx');

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

async function generarDocxHistoria(historia, paciente) {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } },
        },
        children: [
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
          campo('Fecha y hora', historia.fecha),
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

async function generarDocxTratamiento(historia, paciente) {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(5.5),
              height: convertInchesToTwip(8.5),
            },
            margin: { top: 540, bottom: 540, left: 540, right: 540 },
          },
        },
        children: [
          new Paragraph({
            text: 'Fórmula médica',
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: ' ' }),
          campo('Paciente', nombrePaciente(paciente)),
          campo('DNI', paciente.dni),
          campo('Fecha y hora', historia.fecha),
          campo('Doctor/a', historia.doctor_nombre),
          new Paragraph({ text: ' ' }),
          new Paragraph({ text: 'Tratamiento', heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: historia.tratamiento && historia.tratamiento.trim() ? historia.tratamiento : '-' }),
          new Paragraph({ text: ' ' }),
          new Paragraph({ text: ' ' }),
          new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
          new Paragraph({ text: 'Firma y sello', alignment: AlignmentType.CENTER }),
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
