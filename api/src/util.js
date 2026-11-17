const cfg = require('./config');

/** Normalise an ID / card number: trim + upper-case. All keys are stored this way. */
const norm = (v) => String(v ?? '').trim().toUpperCase();

/** Wrap an async express handler so rejections reach the error middleware. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.tz, year: 'numeric', month: '2-digit', day: '2-digit' });
/** Calendar date (YYYY-MM-DD) in the app time zone. */
const today = () => dateFmt.format(new Date());
const hm = (s) => {
  const [h, m] = String(s).split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
};
const WIN = {
  inStart: hm(cfg.checkinStart),
  inEnd: hm(cfg.checkinEnd),
  outStart: hm(cfg.checkoutStart),
  outEnd: hm(cfg.checkoutEnd),
};
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Minutes since midnight, app time zone. */
const nowMinutes = () => hm(timeFmt.format(new Date()));
/** inclusive range check that also works across midnight (e.g. 16:35 -> 04:00) */
const inRange = (m, a, b) => (a <= b ? m >= a && m <= b : m >= a || m <= b);
/** Which scan window is open now: 'in' | 'out' | null (outside scan hours). */
function scanWindow(m = nowMinutes()) {
  if (inRange(m, WIN.inStart, WIN.inEnd)) return 'in';
  if (inRange(m, WIN.outStart, WIN.outEnd)) return 'out';
  return null;
}
/** Work date: the work day starts at CHECKIN_START, so a 02:00 check-out still belongs to yesterday. */
const workDate = () => dateFmt.format(new Date(Date.now() - WIN.inStart * 60e3));

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // block spreadsheet formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** CSV with UTF-8 BOM so Excel shows Thai / Khmer correctly. */
const toCsv = (headers, rows) => '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

module.exports = { norm, ah, HttpError, today, workDate, scanWindow, isDate, toCsv };
