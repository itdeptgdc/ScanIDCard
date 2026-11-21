/**
 * Custom ID card templates (designed in the dashboard).
 * A staff member uses one with card_type = 'tpl_<id>'. Built-in types stay hard-coded in the web app.
 */
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../auth');
const { ah, HttpError } = require('../util');

const router = express.Router();
const HR = requireAuth('admin', 'hr');
const ANY = requireAuth();

const BUILTIN_TYPES = ['staff', 'casino_staff', 'vendor', 'tenant', 'visitor', 'contractor'];
const keyOf = (id) => `tpl_${id}`;
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;

/** All valid card_type values: built-ins + existing templates. */
async function validTypes() {
  const { rows } = await pool.query('SELECT id FROM card_templates WHERE builtin IS NULL');
  return new Set([...BUILTIN_TYPES, ...rows.map((r) => keyOf(r.id))]);
}
/** Map template name (lower-case) -> key, for CSV import ("Gold VIP" -> tpl_3). */
async function typesByName() {
  const { rows } = await pool.query('SELECT id, name FROM card_templates WHERE builtin IS NULL');
  return new Map(rows.map((r) => [r.name.trim().toLowerCase(), keyOf(r.id)]));
}

function clean(b) {
  const name = String(b?.name ?? '').trim().slice(0, 60);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED');
  const color = COLOR_RE.test(String(b?.color)) ? b.color : '#7b1fa2';
  const design = b?.design && typeof b.design === 'object' && !Array.isArray(b.design) ? b.design : {};
  if (!Array.isArray(design.elements)) design.elements = [];
  if (design.elements.length > 200) throw new HttpError(400, 'TOO_LARGE');
  if (JSON.stringify(design).length > 300000) throw new HttpError(413, 'TOO_LARGE');
  return { name, color, design };
}

const shape = (r) => ({ ...r, key: keyOf(r.id), staff_count: r.staff_count ?? 0 });

router.get(
  '/',
  ANY,
  ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.color, t.design, t.updated_at, t.builtin,
              (SELECT count(*) FROM staff s WHERE s.card_type = COALESCE(t.builtin, 'tpl_' || t.id)) AS staff_count
         FROM card_templates t ORDER BY t.name`
    );
    res.json({ rows: rows.map(shape) });
  })
);

router.post(
  '/',
  HR,
  ah(async (req, res) => {
    const d = clean(req.body);
    const { rows } = await pool.query(
      'INSERT INTO card_templates (name, color, design) VALUES ($1, $2, $3) RETURNING id, name, color, design, updated_at',
      [d.name, d.color, d.design]
    );
    res.status(201).json(shape(rows[0]));
  })
);

router.put(
  '/:id(\\d+)',
  HR,
  ah(async (req, res) => {
    const d = clean(req.body);
    const { rows } = await pool.query(
      `UPDATE card_templates SET name = $1, color = $2, design = $3, updated_at = now()
        WHERE id = $4 AND builtin IS NULL RETURNING id, name, color, design, updated_at`,
      [d.name, d.color, d.design, req.params.id]
    );
    if (!rows[0]) throw new HttpError(404, 'NOT_FOUND');
    res.json(shape(rows[0]));
  })
);

router.delete(
  '/:id(\\d+)',
  HR,
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const used = await pool.query('SELECT count(*)::int AS n FROM staff WHERE card_type = $1', [keyOf(id)]);
    if (used.rows[0].n) throw new HttpError(409, 'TEMPLATE_IN_USE');
    const r = await pool.query('DELETE FROM card_templates WHERE id = $1 AND builtin IS NULL RETURNING design', [id]);
    if (!r.rowCount) throw new HttpError(404, 'NOT_FOUND');
    await dropUnusedAssets(r.rows[0].design);
    res.json({ ok: true });
  })
);

// ---------- edited built-in designs ----------
// PUT saves a new design for a built-in card type; DELETE restores the original hard-coded artwork.
router.put(
  '/builtin/:type',
  HR,
  ah(async (req, res) => {
    const type = req.params.type;
    if (!BUILTIN_TYPES.includes(type)) throw new HttpError(404, 'NOT_FOUND');
    const d = clean({ ...req.body, name: req.body?.name || type });
    const { rows } = await pool.query(
      `INSERT INTO card_templates (name, color, design, builtin) VALUES ($1, $2, $3, $4)
       ON CONFLICT (builtin) WHERE builtin IS NOT NULL
       DO UPDATE SET design = EXCLUDED.design, updated_at = now()
       RETURNING id, name, color, design, updated_at, builtin`,
      [d.name, d.color, d.design, type]
    );
    res.json(shape(rows[0]));
  })
);

router.delete(
  '/builtin/:type',
  HR,
  ah(async (req, res) => {
    const r = await pool.query('DELETE FROM card_templates WHERE builtin = $1 RETURNING design', [req.params.type]);
    if (r.rowCount) await dropUnusedAssets(r.rows[0].design);
    res.json({ ok: true });
  })
);

/** Remove uploaded images that no remaining template uses. */
async function dropUnusedAssets(design) {
  const ids = assetIds(design);
  if (!ids.length) return;
  const all = await pool.query('SELECT design FROM card_templates');
  const keep = new Set(all.rows.flatMap((x) => assetIds(x.design)));
  const drop = ids.filter((a) => !keep.has(a));
  if (drop.length) await pool.query('DELETE FROM card_assets WHERE id = ANY($1::int[])', [drop]);
}

function assetIds(design) {
  const out = [];
  if (design?.bgAsset) out.push(Number(design.bgAsset));
  for (const e of design?.elements || []) if (e?.asset) out.push(Number(e.asset));
  return out.filter((n) => Number.isInteger(n));
}

// ---------- images ----------
router.post(
  '/assets',
  HR,
  ah(async (req, res) => {
    const m = String(req.body?.data || '').match(/^data:(image\/(?:jpeg|png|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new HttpError(400, 'PHOTO_INVALID');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 2 * 1024 * 1024) throw new HttpError(413, 'PHOTO_TOO_LARGE');
    const { rows } = await pool.query('INSERT INTO card_assets (mime, data) VALUES ($1, $2) RETURNING id', [m[1], buf]);
    res.status(201).json({ id: rows[0].id });
  })
);

router.get(
  '/assets/:id(\\d+)',
  ANY,
  ah(async (req, res) => {
    const { rows } = await pool.query('SELECT mime, data FROM card_assets WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).end();
    res.setHeader('Content-Type', rows[0].mime);
    if (rows[0].mime === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable'); // assets never change (new upload = new id)
    res.end(rows[0].data);
  })
);

module.exports = router;
module.exports.validTypes = validTypes;
module.exports.typesByName = typesByName;
