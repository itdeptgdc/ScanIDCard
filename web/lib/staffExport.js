'use client';
// Staff Excel export / import and PDF export. Heavy libraries are loaded on demand.
import { DICT } from './i18n';
import { CARD_TYPES } from './cardTypes';
import { TZ, todayStr, cardDate } from './format';

const PLUM = '4D0A40';
const PLUM_RGB = [77, 10, 64];
const ZEBRA_RGB = [250, 244, 248];
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Columns that can be exported, in table order. `label` is an i18n key. */
export const EXPORT_COLS = [
  { key: 'id_number', label: 'staff.idNumber', width: 16 },
  { key: 'card_number', label: 'staff.cardNumber', width: 18 },
  { key: 'name', label: 'staff.name', width: 28 },
  { key: 'position', label: 'staff.position', width: 26 },
  { key: 'department', label: 'staff.department', width: 24 },
  { key: 'company', label: 'staff.company', width: 22 },
  { key: 'passport', label: 'staff.passport', width: 16 },
  { key: 'nationality', label: 'staff.nationality', width: 16 },
  { key: 'sex', label: 'staff.sex', width: 10 },
  { key: 'check_in', label: 'staff.checkIn', width: 12, time: true },
  { key: 'check_out', label: 'staff.checkOut', width: 12, time: true },
  { key: 'card_type', label: 'staff.cardType', width: 18 },
  { key: 'status', label: 'staff.status', width: 12 },
  { key: 'hire_date', label: 'staff.hireDate', width: 14, date: true },
  { key: 'card_expiry', label: 'staff.expiry', width: 14, date: true },
];

/** Fields the import saves (the others, like check-in, are ignored). */
const IMPORT_FIELDS = ['id_number', 'card_number', 'name', 'position', 'department', 'company', 'passport', 'card_type', 'status', 'hire_date', 'card_expiry'];

const tEn = (k) => DICT.en[k] ?? k;

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const timeOf = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '';

const dateOf = (d) => {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};

/** Display value for one cell. `forPdf` returns plain strings only. */
function cellValue(row, col, { t, typeLabel }, forPdf) {
  const v = row[col.key];
  if (col.time) return timeOf(v);
  if (col.date) return forPdf ? (v ? cardDate(v) : '') : dateOf(v);
  if (col.key === 'card_type') return v ? typeLabel(v) : '';
  if (col.key === 'status') return v ? t(`status.${v}`) : '';
  if (col.key === 'sex') return v ? t(`sex.${v}`) : '';
  return v ?? '';
}

async function loadExcel() {
  const m = await import('exceljs');
  return m.default || m;
}

function styleHeader(ws, count) {
  const head = ws.getRow(1);
  head.height = 24;
  for (let i = 1; i <= count; i++) {
    const c = head.getCell(i);
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PLUM } };
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    c.border = { bottom: { style: 'medium', color: { argb: 'FFD4A64A' } } };
  }
}

/**
 * Build and download an .xlsx file.
 * rows: export API rows · cols: subset of EXPORT_COLS · t: translator · typeLabel: card type -> label
 */
export async function exportStaffExcel({ rows, cols, t, typeLabel }) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Poipet Resort & Casino';
  wb.created = new Date();
  const ws = wb.addWorksheet('Staff', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map((c) => ({
    header: t(c.label),
    key: c.key,
    width: c.width,
    style: c.date ? { numFmt: 'dd-mmm-yyyy', alignment: { horizontal: 'left' } } : {},
  }));
  rows.forEach((r, i) => {
    const row = ws.addRow(Object.fromEntries(cols.map((c) => [c.key, cellValue(r, c, { t, typeLabel }, false)])));
    if (i % 2 === 1) row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF4F8' } };
    });
  });
  styleHeader(ws, cols.length);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: XLSX_MIME }), `staff-${todayStr()}.xlsx`);
}

/** Build and download a landscape PDF. Labels are English (the built-in PDF font is Latin only). */
export async function exportStaffPdf({ rows, cols, typeLabelEn, filterNote }) {
  const [{ jsPDF }, at] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = at.autoTable || at.default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: cols.length > 9 ? 'a3' : 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const generated = new Date().toLocaleString('en-GB', { timeZone: TZ, hour12: false });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...PLUM_RGB);
  doc.text('Poipet Resort & Casino', 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 70, 85);
  doc.text(`Staff list  ·  ${rows.length} records${filterNote ? '  ·  ' + filterNote : ''}  ·  Generated ${generated}`, 40, 58);

  autoTable(doc, {
    startY: 72,
    head: [cols.map((c) => tEn(c.label))],
    body: rows.map((r) => cols.map((c) => String(cellValue(r, c, { t: tEn, typeLabel: typeLabelEn }, true)))),
    theme: 'grid',
    margin: { left: 40, right: 40, bottom: 36 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [236, 223, 232], lineWidth: 0.5, textColor: [43, 10, 37] },
    headStyles: { fillColor: PLUM_RGB, textColor: 255, fontStyle: 'bold', lineColor: PLUM_RGB },
    alternateRowStyles: { fillColor: ZEBRA_RGB },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(138, 115, 132);
      doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageW - 40, pageH - 18, { align: 'right' });
    },
  });
  doc.save(`staff-${todayStr()}.pdf`);
}

/** Download an Excel template with sample rows and a sheet of valid card types / statuses. */
export async function downloadStaffTemplate({ t, types }) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Staff', { views: [{ state: 'frozen', ySplit: 1 }] });
  const cols = EXPORT_COLS.filter((c) => IMPORT_FIELDS.includes(c.key));
  ws.columns = cols.map((c) => ({ header: t(c.label), key: c.key, width: c.width, style: c.date ? { numFmt: 'dd-mmm-yyyy' } : {} }));
  const label = (v) => types.find((x) => x.value === v)?.label || v;
  ws.addRow({
    id_number: '20070046', card_number: '0012345678', name: 'SENG SAMBAT', position: 'CHIEF ARTIST', department: 'DIGITAL MARKETING',
    card_type: label('casino_staff'), status: t('status.active'), hire_date: dateOf('2007-03-01'), card_expiry: dateOf('2027-12-31'),
  });
  ws.addRow({ id_number: 'V0001', name: 'JOHN WICK', position: 'COFFEE TREE', company: 'COFFEE TREE', card_type: label('vendor'), status: t('status.active'), card_expiry: dateOf('2026-10-01') });
  // keep ID / card numbers as text so leading zeros survive
  ['id_number', 'card_number'].forEach((k) => { ws.getColumn(k).numFmt = '@'; });
  styleHeader(ws, cols.length);

  const ref = wb.addWorksheet('Valid values');
  ref.columns = [{ header: t('staff.cardType'), width: 28 }, { header: t('staff.status'), width: 18 }];
  const statuses = ['active', 'locked', 'blocked'].map((s) => t(`status.${s}`));
  for (let i = 0; i < Math.max(types.length, statuses.length); i++) ref.addRow([types[i]?.label || '', statuses[i] || '']);
  styleHeader(ref, 2);

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: XLSX_MIME }), 'staff-template.xlsx');
}

// ---------------- import ----------------
const pad = (n) => String(n).padStart(2, '0');

function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return isNaN(v) ? '' : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((x) => x.text).join('');
    if ('result' in v) return cellText(v.result);
    if ('text' in v) return cellText(v.text);
    return '';
  }
  return String(v).trim();
}

const csvCell = (s) => `"${String(s).replace(/"/g, '""')}"`;
const low = (s) => String(s || '').trim().toLowerCase();
const fail = (code) => Object.assign(new Error(code), { code });

/**
 * Read the first sheet of an .xlsx file and convert it to the canonical import format
 * (field-key headers, card type / status values instead of labels).
 * Returns { body, rowNums }: the request body for POST /staff/import and the sheet row of each data line.
 * templates: custom card templates [{ key, name }]
 */
export async function readStaffExcel(file, templates = []) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw fail('EXCEL_INVALID');
  }
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) throw fail('EXCEL_EMPTY');

  // header label (English or Thai) -> field key; unknown headers pass through to the server's aliases ("ID No", "Dept." ...)
  const headerMap = new Map();
  for (const c of EXPORT_COLS) {
    if (!IMPORT_FIELDS.includes(c.key)) continue;
    headerMap.set(c.key, c.key);
    for (const lang of Object.values(DICT)) if (lang[c.label]) headerMap.set(low(lang[c.label]), c.key);
  }
  const typeMap = new Map();
  for (const c of CARD_TYPES) {
    typeMap.set(c.value, c.value);
    for (const lang of Object.values(DICT)) if (lang[`type.${c.value}`]) typeMap.set(low(lang[`type.${c.value}`]), c.value);
  }
  for (const tp of templates) {
    typeMap.set(low(tp.key), tp.key);
    if (tp.name) typeMap.set(low(tp.name), tp.key);
  }
  const statusMap = new Map();
  for (const s of ['active', 'locked', 'blocked']) {
    statusMap.set(s, s);
    for (const lang of Object.values(DICT)) if (lang[`status.${s}`]) statusMap.set(low(lang[`status.${s}`]), s);
  }

  const head = [];
  for (let i = 1; i <= ws.columnCount; i++) {
    const h = cellText(ws.getRow(1).getCell(i).value);
    head.push(headerMap.get(low(h)) || h);
  }
  if (!head.includes('id_number') && !head.some((h) => /^(id|id ?no\.?|idno|staff id|employee id)$/i.test(h))) throw fail('EXCEL_NO_ID');

  const lines = [head.map(csvCell).join(',')];
  const rowNums = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const vals = head.map((h, i) => {
      const s = cellText(row.getCell(i + 1).value);
      if (h === 'card_type') return typeMap.get(low(s)) || s;
      if (h === 'status') return statusMap.get(low(s)) || s;
      return s;
    });
    if (vals.every((v) => v === '')) continue;
    lines.push(vals.map(csvCell).join(','));
    rowNums.push(r);
  }
  if (lines.length < 2) throw fail('EXCEL_EMPTY');
  return { body: lines.join('\r\n'), rowNums };
}