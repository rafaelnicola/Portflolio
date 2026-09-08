const nodemailer = require('nodemailer');
const db = require('./db');

const CLAVES_SMTP = ['smtp_host', 'smtp_puerto', 'smtp_usuario', 'smtp_password', 'smtp_remitente', 'smtp_seguro'];

function obtenerConfigSmtp() {
  const config = {};
  for (const clave of CLAVES_SMTP) {
    config[clave] = db.getSetting(clave);
  }
  return config;
}

function smtpConfigurado() {
  const config = obtenerConfigSmtp();
  return Boolean(config.smtp_host && config.smtp_usuario && config.smtp_password);
}

function guardarConfigSmtp({ host, puerto, usuario, password, remitente, seguro }) {
  db.setSetting('smtp_host', host || '');
  db.setSetting('smtp_puerto', puerto || '587');
  db.setSetting('smtp_usuario', usuario || '');
  if (password) db.setSetting('smtp_password', password);
  db.setSetting('smtp_remitente', remitente || usuario || '');
  db.setSetting('smtp_seguro', seguro ? '1' : '0');
}

async function enviarEmailConAdjunto({ destinatario, asunto, texto, nombreArchivo, contenido }) {
  const config = obtenerConfigSmtp();
  if (!config.smtp_host || !config.smtp_usuario || !config.smtp_password) {
    throw new Error('El servidor de correo no esta configurado. Pedile al administrador que lo configure en Configuracion.');
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: Number(config.smtp_puerto) || 587,
    secure: config.smtp_seguro === '1',
    auth: {
      user: config.smtp_usuario,
      pass: config.smtp_password,
    },
  });

  await transporter.sendMail({
    from: config.smtp_remitente || config.smtp_usuario,
    to: destinatario,
    subject: asunto,
    text: texto,
    attachments: [
      {
        filename: nombreArchivo,
        content: contenido,
      },
    ],
  });
}

module.exports = { obtenerConfigSmtp, smtpConfigurado, guardarConfigSmtp, enviarEmailConAdjunto };
