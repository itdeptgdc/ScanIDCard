export const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bangkok';

export function fmtTime(iso, locale = 'th-TH') {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtDateTime(iso, locale = 'th-TH') {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, { timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** 'YYYY-MM-DD' -> localised short date, no TZ shifting. */
export function fmtDate(d, locale = 'th-TH') {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Card style date: 01-Oct-2026 */
export function cardDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}-${MON[Number(m) - 1]}-${y}`;
}

export function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function daysUntil(d) {
  if (!d) return null;
  const a = Date.parse(todayStr() + 'T00:00:00Z');
  const b = Date.parse(d + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export const maskCard = (c) => (!c ? '—' : c.length > 4 ? '•••• ' + c.slice(-4) : c);
