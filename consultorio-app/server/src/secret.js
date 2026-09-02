const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const secretFile = path.join(dataDir, 'jwt.secret');

function getOrCrearSecreto() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf-8').trim();
  }
  const nuevo = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretFile, nuevo, { mode: 0o600 });
  return nuevo;
}

module.exports = { JWT_SECRET: getOrCrearSecreto() };
