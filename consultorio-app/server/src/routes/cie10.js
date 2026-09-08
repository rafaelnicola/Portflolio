const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

// Busqueda para el autocompletado del campo Diagnostico: por prefijo de
// codigo (ej. "J45") o por texto contenido en el nombre (ej. "asma").
router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  // Un codigo CIE-10 es una letra seguida solo de digitos (ej. "J45", "J450").
  // Cualquier otra cosa (ej. "asma") se busca por texto en el nombre.
  const esCodigo = /^[a-zA-Z]\d*$/.test(q) && q.length <= 5;
  const texto = q.toUpperCase();
  const resultados = esCodigo
    ? db
        .prepare('SELECT codigo, nombre, capitulo FROM cie10 WHERE codigo LIKE ? ORDER BY codigo LIMIT 20')
        .all(`${texto}%`)
    : db
        .prepare(
          `SELECT codigo, nombre, capitulo FROM cie10
           WHERE nombre LIKE ?
           ORDER BY CASE WHEN nombre LIKE ? THEN 0 ELSE 1 END, nombre
           LIMIT 20`
        )
        .all(`%${texto}%`, `${texto}%`);
  res.json(resultados);
});

module.exports = router;
