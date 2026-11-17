/**
 * POST /api/scan  { code, method: 'camera' | 'reader' | 'manual' }
 *
 * Hot path, kept as lean as possible:
 *   1. resolve the code from the in-memory index (no DB)
 *   2. one prepared INSERT ... ON CONFLICT statement (check-in or check-out)
 *   3. audit log is buffered and written in batches (never awaited)
 */
const express = require('express');
const { pool } = require('../db');
const cfg = require('../config');
const cache = require('../cache');
const qr = require('../qr');
const { requireAuth } = require('../auth');
const { ah, norm, today, workDate, scanWindow } = require('../util');

const router = express.Router();

// check-in window: first scan records check-in, later scans are duplicates
const CHECKIN_SQL = `
INSERT INTO attendance (staff_id, work_date, check_in, method_in)
VALUES ($1, $2, now(), $3)
ON CONFLICT (staff_id, work_date) DO NOTHING
RETURNING check_in, check_out`;

// check-out window: records / updates check-out (also when there was no check-in);
// a repeat scan within SCAN_MIN_GAP_SECONDS is a duplicate
const CHECKOUT_SQL = `
INSERT INTO attendance (staff_id, work_date, check_out, method_out)
VALUES ($1, $2, now(), $3)
ON CONFLICT (staff_id, work_date) DO UPDATE
   SET check_out = now(), method_out = EXCLUDED.method_out, scan_count = attendance.scan_count + 1
 WHERE COALESCE(attendance.check_out, attendance.check_in) < now() - make_interval(secs => $4)
RETURNING check_in, check_out`;

// ---------- buffered audit log ----------
const logBuf = [];
async function flushLogs() {
  if (!logBuf.length) return;
  const items = logBuf.splice(0, logBuf.length);
  try {
    await pool.query(
      `INSERT INTO scan_logs (at, staff_id, raw, method, result, user_id)
       SELECT * FROM unnest($1::timestamptz[], $2::int[], $3::text[], $4::text[], $5::text[], $6::int[])`,
      [
        items.map((i) => i.at),
        items.map((i) => i.staffId),
        items.map((i) => i.raw),
        items.map((i) => i.method),
        items.map((i) => i.result),
        items.map((i) => i.userId),
      ]
    );
  } catch (e) {
    console.error('[scan] audit log flush failed:', e.message);
  }
}
function logScan(e) {
  logBuf.push(e);
  if (logBuf.length >= 200) flushLogs();
}
setInterval(flushLogs, 1000).unref();
setInterval(() => {
  pool.query(`DELETE FROM scan_logs WHERE at < now() - make_interval(days => $1)`, [cfg.logRetentionDays]).catch(() => {});
}, 3600e3).unref();

// ---------- resolution ----------
async function resolve(raw) {
  // 1) signed QR printed on the card -> verifies ID number AND current card number together
  const signed = qr.parse(raw);
  if (signed) {
    if (signed.invalid) return { error: 'INVALID_QR' };
    const s = await cache.findByIdNumber(signed.id);
    if (!s) return { error: 'NOT_FOUND' };
    if (!qr.verify(signed, s)) {
      // signature mismatch: forged QR, or an old card whose card number was re-issued
      return { error: s.card_number ? 'CARD_MISMATCH' : 'INVALID_QR', staff: s };
    }
    return { staff: s, verified: s.card_number ? 'id+card' : 'id' };
  }

  for (const key of candidates(raw)) {
    // 2) card reader (RFID / magstripe / barcode) or code inside an existing QR -> card number
    const byCard = await cache.findByCardNumber(key);
    if (byCard) return { staff: byCard, verified: 'card' };

    // 3) ID number alone (typed, or an old plain-ID QR code)
    if (cfg.allowIdOnly) {
      const byId = await cache.findByIdNumber(key);
      if (byId) return { staff: byId, verified: 'id' };
    }
  }
  return { error: 'NOT_FOUND' };
}

/**
 * Keys to try for a scanned value. Existing printed cards carry URL QR codes such as
 * https://qr.poipetresort.net/r/HMVQLM4LHQ39 -> we try the whole text, then ?id= / ?code= / ?card=
 * query values, then the last path segment (HMVQLM4LHQ39). Store that code as the person's card number.
 */
function candidates(raw) {
  const out = [norm(raw)];
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      for (const p of ['id', 'code', 'card', 'no']) {
        const v = u.searchParams.get(p);
        if (v) out.push(norm(v));
      }
      const seg = u.pathname.split('/').filter(Boolean).pop();
      if (seg) out.push(norm(decodeURIComponent(seg)));
    } catch {}
  }
  return [...new Set(out)].filter(Boolean);
}

const publicStaff = (s) => ({
  id: s.id,
  idNumber: s.id_number,
  name: s.name,
  position: s.position,
  department: s.department,
  company: s.company,
  cardType: s.card_type,
  status: s.status,
  cardExpiry: s.card_expiry,
  hireDate: s.hire_date,
  passport: s.passport,
  hasPhoto: s.has_photo,
  photoVersion: s.photo_version,
  photo:s.has_photo ? `/api/staff/${s.id}/photo?v=${s.photo_version}` : null,
});

router.post(
  '/',
  express.json({ limit: '4kb' }),
  requireAuth(),
  ah(async (req, res) => {
    const t0 = process.hrtime.bigint();
    const raw = String(req.body?.code ?? '').trim().slice(0, 256);
    const method = ['camera', 'reader', 'manual'].includes(req.body?.method) ? req.body.method : 'manual';
    const ms = () => Number(process.hrtime.bigint() - t0) / 1e6;
    const base = { at: new Date(), method, userId: req.user.id };

    if (!raw) return res.status(400).json({ ok: false, code: 'EMPTY' });

    const r = await resolve(raw);
    if (!r.staff || r.error) {
      logScan({ ...base, staffId: r.staff?.id ?? null, raw: raw.slice(0, 64), result: r.error });
      return res.json({ ok: false, code: r.error, staff: r.staff ? publicStaff(r.staff) : null, ms: ms() });
    }

    const s = r.staff;
    let deny = null;
    if (s.status === 'blocked') deny = 'BLOCKED';
    else if (s.status === 'locked') deny = 'LOCKED';
    else if (s.card_expiry && s.card_expiry < today()) deny = 'EXPIRED';
    if (deny) {
      logScan({ ...base, staffId: s.id, raw: null, result: deny });
      return res.json({ ok: false, code: deny, staff: publicStaff(s), ms: ms() });
    }

    const win = scanWindow();
    if (!win) {
      logScan({ ...base, staffId: s.id, raw: null, result: 'OUTSIDE_HOURS' });
      return res.json({ ok: false, code: 'OUTSIDE_HOURS', staff: publicStaff(s), ms: ms() });
    }

    const wd = workDate();
    const up =
      win === 'in'
        ? await pool.query({ name: 'scan_checkin', text: CHECKIN_SQL, values: [s.id, wd, method] })
        : await pool.query({ name: 'scan_checkout', text: CHECKOUT_SQL, values: [s.id, wd, method, cfg.minGapSec] });
    let action;
    let row;
    if (up.rowCount) {
      row = up.rows[0];
      action = win === 'in' ? 'check_in' : 'check_out';
    } else {
      const cur = await pool.query({
        name: 'scan_current',
        text: 'SELECT check_in, check_out FROM attendance WHERE staff_id = $1 AND work_date = $2',
        values: [s.id, wd],
      });
      row = cur.rows[0] || {};
      action = 'duplicate';
    }

    logScan({ ...base, staffId: s.id, raw: null, result: action });
    res.json({
      ok: true,
      action,
      verified: r.verified,
      staff: publicStaff(s),
      checkIn: row.check_in,
      checkOut: row.check_out,
      workDate: wd,
      ms: ms(),
    });
  })
);

// Recent audit log (admin)
router.get(
  '/logs',
  requireAuth('admin'),
  ah(async (req, res) => {
    const result = String(req.query.result || '');
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const rejected = ['NOT_FOUND', 'INVALID_QR', 'CARD_MISMATCH', 'BLOCKED', 'LOCKED', 'EXPIRED', 'OUTSIDE_HOURS'];
    const where = `($1 = '' OR ($1 = 'rejected' AND l.result = ANY($2::text[])))`;
    const [{ rows }, count] = await Promise.all([
      pool.query(
        `SELECT l.id, l.at, l.raw, l.method, l.result, s.id_number, s.name, u.username
           FROM scan_logs l
           LEFT JOIN staff s ON s.id = l.staff_id
           LEFT JOIN users u ON u.id = l.user_id
          WHERE ${where}
          ORDER BY l.at DESC
          LIMIT $3 OFFSET $4`,
        [result, rejected, limit, offset]
      ),
      pool.query(`SELECT count(*)::int AS n FROM scan_logs l WHERE ${where}`, [result, rejected]),
    ]);
    res.json({ rows, total: count.rows[0].n });
  })
);

module.exports = router;
