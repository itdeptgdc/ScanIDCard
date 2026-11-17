const express = require('express');
const { parse: parseCsv } = require('csv-parse/sync');
const { pool } = require('../db');
const cache = require('../cache');
const qr = require('../qr');
const { requireAuth } = require('../auth');
const { ah, norm, HttpError, today, workDate, isDate } = require('../util');

const router = express.Router();
const HR = requireAuth('admin', 'hr');
const ANY = requireAuth();

const { validTypes, typesByName } = require('./templates');
const STATUSES = ['active', 'locked', 'blocked'];
const ID_RE = /^[A-Z0-9][A-Z0-9._\-/]{0,39}$/;

const COLS = `s.id, s.id_number, s.card_number, s.name, s.position, s.department, s.company, s.passport,
  s.card_type, s.status, s.hire_date, s.card_expiry, s.has_photo, s.photo_version, s.created_at, s.updated_at`;

const text = (v, max = 120) => String(v ?? '').trim().slice(0, max);

/** types: Set of valid card_type values (built-ins + custom templates) */
function clean(b, types) {
  const d = {
    id_number: norm(b.id_number),
    card_number: norm(b.card_number) || null,
    name: text(b.name),
    position: text(b.position),
    department: text(b.department),
    company: text(b.company),
    passport: text(b.passport, 40),
    card_type: types.has(b.card_type) ? b.card_type : null,
    status: STATUSES.includes(b.status) ? b.status : 'active',
    hire_date: isDate(b.hire_date) ? b.hire_date : null,
    card_expiry: isDate(b.card_expiry) ? b.card_expiry : null,
  };
  if (!d.id_number) throw new HttpError(400, 'ID_REQUIRED');
  if (!ID_RE.test(d.id_number)) throw new HttpError(400, 'ID_INVALID');
  if (d.card_number && !ID_RE.test(d.card_number)) throw new HttpError(400, 'CARD_INVALID');
  if (!d.card_type) throw new HttpError(400, 'TYPE_REQUIRED');
  return d;
}

/** A card number must never equal somebody else's ID number (and vice-versa), or a scan would be ambiguous. */
async function checkConflicts(d, selfId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM staff
      WHERE id <> $3 AND (card_number = $1 OR ($2::text IS NOT NULL AND id_number = $2))
      LIMIT 1`,
    [d.id_number, d.card_number, selfId]
  );
  if (rows.length) throw new HttpError(409, 'CARD_CONFLICT');
}

const VALUES = (d) => [d.id_number, d.card_number, d.name, d.position, d.department, d.company, d.passport, d.card_type, d.status, d.hire_date, d.card_expiry];

// ---------------- stats ----------------
router.get(
  '/stats',
  HR,
  ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT (SELECT count(*) FROM staff) AS total,
              (SELECT count(*) FROM attendance WHERE work_date = $1) AS checked_in,
              (SELECT count(*) FROM attendance WHERE work_date = $1 AND check_out IS NOT NULL) AS checked_out,
              (SELECT count(*) FROM staff WHERE card_expiry BETWEEN $2::date AND $2::date + 90) AS expiring,
              (SELECT count(*) FROM staff WHERE card_expiry < $2::date) AS expired`,
      [workDate(), today()]
    );
    res.json(rows[0]);
  })
);

// ---------------- list ----------------
/** Shared search / filter clause for the list and the export. Params: $1 work date, $2 q, $3 like, $4 type, $5 status. */
function listFilter(query) {
  const q = text(query.q, 60);
  const type = /^[a-z0-9_]{1,40}$/.test(String(query.type || '')) ? query.type : '';
  const status = STATUSES.includes(query.status) ? query.status : '';
  const like = `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
  return {
    from: `FROM staff s
         LEFT JOIN attendance a ON a.staff_id = s.id AND a.work_date = $1
        WHERE ($2 = '' OR s.name ILIKE $3 OR s.id_number ILIKE $3 OR s.card_number ILIKE $3
               OR s.department ILIKE $3 OR s.position ILIKE $3 OR s.company ILIKE $3)
          AND ($4 = '' OR s.card_type = $4)
          AND ($5 = '' OR s.status = $5)`,
    params: [workDate(), q, like, type, status],
  };
}

router.get(
  '/',
  HR,
  ah(async (req, res) => {
    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 20, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const f = listFilter(req.query);
    const { rows } = await pool.query(
      `SELECT ${COLS}, a.check_in, a.check_out, count(*) OVER() AS total
         ${f.from}
        ORDER BY s.id DESC
        LIMIT $6 OFFSET $7`,
      [...f.params, size, (page - 1) * size]
    );
    res.json({ rows: rows.map(({ total, ...r }) => r), total: rows[0]?.total ?? 0, page, size });
  })
);

// ---------------- export / import ----------------
// Export returns JSON; the browser builds the Excel / PDF file (with the columns the user picked).
const FIELDS = ['id_number', 'card_number', 'name', 'position', 'department', 'company', 'passport', 'card_type', 'status', 'hire_date', 'card_expiry'];

router.get(
  '/export',
  HR,
  ah(async (req, res) => {
    const f = listFilter(req.query);
    const { rows } = await pool.query(
      `SELECT ${FIELDS.map((c) => 's.' + c).join(', ')}, a.check_in, a.check_out
         ${f.from}
        ORDER BY s.id DESC`,
      f.params
    );
    res.json({ rows, generated: today() });
  })
);

const HEADER_ALIASES = {
  id_number: ['id_number', 'id', 'id no', 'id no.', 'id number', 'idno', 'staff id', 'employee id'],
  card_number: ['card_number', 'card', 'card no', 'card no.', 'card number', 'rfid'],
  name: ['name', 'full name', 'staff name'],
  position: ['position', 'post', 'post.', 'title'],
  department: ['department', 'dept', 'dept.'],
  company: ['company', 'com', 'com.'],
  passport: ['passport', 'pp', 'pp.no', 'passport no'],
  card_type: ['card_type', 'type', 'card type', 'id card type'],
  status: ['status'],
  hire_date: ['hire_date', 'hire date', 'h.date', 'start date'],
  card_expiry: ['card_expiry', 'expiry', 'exp', 'card expiry', 'expiry date'],
};
const aliasMap = new Map();
for (const [k, list] of Object.entries(HEADER_ALIASES)) list.forEach((a) => aliasMap.set(a, k));

function importDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (isDate(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY
  if (m) {
    const d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (isDate(d)) return d;
  }
  return null;
}
/** CSV card type: built-in value ("casino staff"), template key ("tpl_3") or template name ("Gold VIP") */
const importType = (v, types, byName) => {
  const raw = String(v ?? '').trim().toLowerCase();
  const s = raw.replace(/\s+/g, '_');
  if (types.has(s)) return s;
  return byName.get(raw) || null;
};

router.post(
  '/import',
  HR,
  express.text({ type: () => true, limit: '50mb' }),
  ah(async (req, res) => {
    let records;
    try {
      records = parseCsv(String(req.body || '').replace(/^﻿/, ''), {
        columns: (h) => h.map((x) => aliasMap.get(String(x).trim().toLowerCase()) || `_${x}`),
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (e) {
      throw new HttpError(400, 'CSV_INVALID');
    }

    const errors = [];
    const byId = new Map();
    const [types, byName] = await Promise.all([validTypes(), typesByName()]);
    records.forEach((r, i) => {
      try {
        const d = clean({
          ...r,
          card_type: importType(r.card_type, types, byName) || 'casino_staff',
          status: String(r.status || 'active').trim().toLowerCase(),
          hire_date: importDate(r.hire_date),
          card_expiry: importDate(r.card_expiry),
        }, types);
        byId.set(d.id_number, { d, line: i + 2 });
      } catch (e) {
        errors.push({ line: i + 2, error: e.code || e.message });
      }
    });

    const list = [...byId.values()];
    const sql = `
      INSERT INTO staff (id_number, card_number, name, position, department, company, passport, card_type, status, hire_date, card_expiry)
      SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::date[], $11::date[])
      ON CONFLICT (id_number) DO UPDATE SET
        card_number = EXCLUDED.card_number, name = EXCLUDED.name, position = EXCLUDED.position,
        department = EXCLUDED.department, company = EXCLUDED.company, passport = EXCLUDED.passport,
        card_type = EXCLUDED.card_type, status = EXCLUDED.status, hire_date = EXCLUDED.hire_date,
        card_expiry = EXCLUDED.card_expiry, updated_at = now()`;
    const cols = (chunk) => FIELDS.map((h) => chunk.map((x) => x.d[h]));

    let ok = 0;
    for (let i = 0; i < list.length; i += 1000) {
      const chunk = list.slice(i, i + 1000);
      try {
        await pool.query(sql, cols(chunk));
        ok += chunk.length;
      } catch {
        // a bad row (e.g. duplicate card number) - retry the chunk one row at a time to isolate it
        for (const item of chunk) {
          try {
            await pool.query(sql, cols([item]));
            ok++;
          } catch (e) {
            errors.push({ line: item.line, error: e.code === '23505' ? 'CARD_EXISTS' : 'DB_ERROR' });
          }
        }
      }
    }
    res.json({ imported: ok, failed: errors.length, errors: errors.slice(0, 100) });
  })
);

// ---------------- single record ----------------
router.get(
  '/:id(\\d+)',
  HR,
  ah(async (req, res) => {
    const { rows } = await pool.query(`SELECT ${COLS} FROM staff s WHERE s.id = $1`, [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'NOT_FOUND');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  HR,
  ah(async (req, res) => {
    const d = clean(req.body || {}, await validTypes());
    await checkConflicts(d, 0);
    const { rows } = await pool.query(
      `INSERT INTO staff (id_number, card_number, name, position, department, company, passport, card_type, status, hire_date, card_expiry)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      VALUES(d)
    );
    await cache.refresh([rows[0].id]);
    res.status(201).json({ id: rows[0].id });
  })
);

router.put(
  '/:id(\\d+)',
  HR,
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const d = clean(req.body || {}, await validTypes());
    await checkConflicts(d, id);
    const r = await pool.query(
      `UPDATE staff SET id_number=$1, card_number=$2, name=$3, position=$4, department=$5, company=$6, passport=$7,
              card_type=$8, status=$9, hire_date=$10, card_expiry=$11, updated_at=now()
        WHERE id=$12`,
      [...VALUES(d), id]
    );
    if (!r.rowCount) throw new HttpError(404, 'NOT_FOUND');
    await cache.refresh([id]);
    res.json({ id });
  })
);

router.delete(
  '/:id(\\d+)',
  HR,
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM staff WHERE id = $1', [id]);
    await cache.refresh([id]);
    res.json({ ok: true });
  })
);

// ---------------- photo ----------------
router.get(
  '/:id(\\d+)/photo',
  ANY,
  ah(async (req, res) => {
    const { rows } = await pool.query('SELECT mime, data FROM staff_photos WHERE staff_id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).end();
    res.setHeader('Content-Type', rows[0].mime);
    res.setHeader('Cache-Control', 'private, max-age=604800'); // URL carries ?v=<version>
    res.end(rows[0].data);
  })
);

router.put(
  '/:id(\\d+)/photo',
  HR,
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const m = String(req.body?.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new HttpError(400, 'PHOTO_INVALID');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 1024 * 1024) throw new HttpError(413, 'PHOTO_TOO_LARGE');
    await pool.query(
      `INSERT INTO staff_photos (staff_id, mime, data) VALUES ($1, $2, $3)
       ON CONFLICT (staff_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data`,
      [id, m[1], buf]
    );
    await pool.query('UPDATE staff SET has_photo = true, photo_version = photo_version + 1, updated_at = now() WHERE id = $1', [id]);
    await cache.refresh([id]);
    res.json({ ok: true });
  })
);

router.delete(
  '/:id(\\d+)/photo',
  HR,
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM staff_photos WHERE staff_id = $1', [id]);
    await pool.query('UPDATE staff SET has_photo = false, photo_version = photo_version + 1, updated_at = now() WHERE id = $1', [id]);
    await cache.refresh([id]);
    res.json({ ok: true });
  })
);

// ---------------- signed QR for printing ----------------
router.get(
  '/:id(\\d+)/qr',
  HR,
  ah(async (req, res) => {
    const { rows } = await pool.query('SELECT id_number, card_number FROM staff WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'NOT_FOUND');
    res.json({ payload: qr.build(rows[0]) });
  })
);

module.exports = router;
