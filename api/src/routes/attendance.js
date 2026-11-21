const express = require('express');
const { pool } = require('../db');
const cfg = require('../config');
const { requireAuth } = require('../auth');
const { ah, HttpError, workDate, isDate, toCsv } = require('../util');

const router = express.Router();
const HR = requireAuth('admin', 'hr');

router.get(
  '/',
  HR,
  ah(async (req, res) => {
    const date = isDate(req.query.date) ? req.query.date : workDate();
    const q = String(req.query.q || '').trim().slice(0, 60);
    const dept = String(req.query.department || '').trim().slice(0, 120);
    const like = `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 50, 1), 5000); // 5000 = "All" in the UI
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [list, sum] = await Promise.all([
      pool.query(
        `SELECT a.id, a.check_in, a.check_out, a.method_in, a.method_out, a.scan_count,
                s.id AS staff_id, s.id_number, s.name, s.card_type, s.department, s.position,
                s.has_photo, s.photo_version,
                count(*) OVER() AS total
           FROM attendance a JOIN staff s ON s.id = a.staff_id
          WHERE a.work_date = $1 AND ($2 = '' OR s.name ILIKE $3 OR s.id_number ILIKE $3)
            AND ($6 = '' OR upper(trim(s.department)) = upper($6))
          ORDER BY COALESCE(a.check_in, a.check_out) DESC
          LIMIT $4 OFFSET $5`,
        [date, q, like, size, (page - 1) * size, dept]
      ),
      pool.query(
        `SELECT count(*) AS present, count(check_out) AS checked_out,
                (SELECT count(*) FROM staff WHERE status = 'active') AS active_staff
           FROM attendance WHERE work_date = $1`,
        [date]
      ),
    ]);
    const s = sum.rows[0];
    res.json({
      date,
      rows: list.rows.map(({ total, ...r }) => r),
      total: list.rows[0]?.total ?? 0,
      page,
      size,
      summary: { present: s.present, checkedOut: s.checked_out, notScanned: Math.max(s.active_staff - s.present, 0) },
    });
  })
);

router.get(
  '/export.csv',
  HR,
  ah(async (req, res) => {
    const from = isDate(req.query.from) ? req.query.from : workDate();
    const to = isDate(req.query.to) ? req.query.to : from;
    if (to < from) throw new HttpError(400, 'BAD_RANGE');
    const dept = String(req.query.department || '').trim().slice(0, 120);
    const { rows } = await pool.query(
      `SELECT a.work_date, s.id_number, s.name, s.card_type, s.department, s.position,
              to_char(a.check_in AT TIME ZONE $3, 'HH24:MI:SS') AS check_in,
              to_char(a.check_out AT TIME ZONE $3, 'HH24:MI:SS') AS check_out,
              round(extract(epoch FROM (a.check_out - a.check_in)) / 3600.0, 2) AS hours,
              a.method_in, a.method_out, a.scan_count
         FROM attendance a JOIN staff s ON s.id = a.staff_id
        WHERE a.work_date BETWEEN $1 AND $2
          AND ($4 = '' OR upper(trim(s.department)) = upper($4))
        ORDER BY a.work_date, a.check_in`,
      [from, to, cfg.tz, dept]
    );
    const headers = ['date', 'id_number', 'name', 'card_type', 'department', 'position', 'check_in', 'check_out', 'hours', 'method_in', 'method_out', 'scan_count'];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${from}${to !== from ? '_' + to : ''}.csv"`);
    res.send(
      toCsv(
        headers,
        rows.map((r) => [r.work_date, r.id_number, r.name, r.card_type, r.department, r.position, r.check_in, r.check_out, r.hours, r.method_in, r.method_out, r.scan_count])
      )
    );
  })
);

module.exports = router;
