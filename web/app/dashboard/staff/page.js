'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus, Pencil, Trash2, CreditCard, Users, LogIn, LogOut, CalendarClock, Printer, FileSpreadsheet, FileText, ImageDown, Loader2, Upload, FileDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { saveCardPng } from '@/lib/saveCard';
import { api, errText } from '@/lib/api';
import { DICT } from '@/lib/i18n';
import { exportStaffExcel, exportStaffPdf, readStaffExcel, downloadStaffTemplate } from '@/lib/staffExport';
import ExportDialog from './ExportDialog';
import { useI18n } from '@/lib/i18n';
import { useCardTypes } from '@/lib/cardTypes';
import { fmtTime, fmtDate, daysUntil, maskCard } from '@/lib/format';
import { useToast } from '@/components/Toast';
import StatCard from '@/components/StatCard';
import Select from '@/components/Select';
import Modal, { ConfirmModal } from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { TypeBadge, StatusBadge } from '@/components/Badges';
import IdCard from '@/components/IdCard';
import { printCard } from '@/lib/printCard';
import StaffForm from './StaffForm';
import DepartmentSelect from '@/components/DepartmentSelect';
import PageSize from '@/components/PageSize';

const SIZE = 25; // default rows per page (one of PAGE_SIZES)

function Thumb({ s }) {
  if (s.has_photo) return <img className="thumb" src={`/api/staff/${s.id}/photo?v=${s.photo_version}`} alt="" loading="lazy" />;
  return <div className="thumb thumb-ph">{(s.name || '?').trim().charAt(0).toUpperCase() || '?'}</div>;
}

function SortTh({ k, sort, onSort, children }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`th-sort${active ? ' active' : ''}`} onClick={() => onSort(k)}>
        {children} <Icon size={13} />
      </button>
    </th>
  );
}

function Expiry({ d }) {
  const { t, locale } = useI18n();
  if (!d) return <span className="muted">—</span>;
  const n = daysUntil(d);
  return (
    <span className="expiry">
      {fmtDate(d, locale)}
      {n < 0 && <span className="tag tag-red">{t('staff.expired')}</span>}
      {n >= 0 && n <= 30 && <span className="tag tag-amber">{t('staff.expiringSoon')}</span>}
    </span>
  );
}

export default function StaffPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const cardTypes = useCardTypes(t);
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(SIZE);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [type, setType] = useState('');
  const [dept, setDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [preview, setPreview] = useState(null);
  const [del, setDel] = useState(null);
  const [exportFmt, setExportFmt] = useState(null); // 'xlsx' | 'pdf' | null
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importRes, setImportRes] = useState(null);
  const fileRef = useRef(null);
  const printRef = useRef(null);

  // column sort: click cycles asc → desc → default (newest first)
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const sortParams = sort.key ? { sort: sort.key, dir: sort.dir } : {};
  const toggleSort = (key) => {
    setSort((s) => (s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: '', dir: 'asc' }));
    setPage(1);
  };

  useEffect(() => {
    const h = setTimeout(() => {
      setDq(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ q: dq, type, department: dept, page: String(page), size: String(size), ...sortParams });
      const r = await api('/staff?' + p);
      setRows(r.rows);
      setTotal(r.total);
    } catch (e) {
      toast(errText(e, t), 'error');
    } finally {
      setLoading(false);
    }
  }, [dq, type, dept, page, size, sort.key, sort.dir]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = useCallback(() => api('/staff/stats').then(setStats).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const refresh = () => {
    load();
    loadStats();
  };

  async function confirmDelete() {
    try {
      await api(`/staff/${del.id}`, { method: 'DELETE' });
      toast(t('common.deleted'));
      setDel(null);
      refresh();
    } catch (e) {
      toast(errText(e, t), 'error');
    }
  }

  const typeLabelEn = (v) => (cardTypes.find(v)?.custom ? cardTypes.label(v) : DICT.en[`type.${v}`] || v);
  const filterNote = [type && cardTypes.label(type), dq && `“${dq}”`].filter(Boolean).join(' · ');
  const filterNoteEn = [type && typeLabelEn(type), dq && `"${dq}"`].filter(Boolean).join(' · ');

  /** Import Excel: rows are saved to the database (new ID numbers added, existing ones updated). */
  async function onImport(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setImporting(true);
    try {
      const { body, rowNums } = await readStaffExcel(f, cardTypes.templates);
      const r = await api('/staff/import', { method: 'POST', body, headers: { 'Content-Type': 'text/csv' } });
      toast(t('staff.importDone', { n: r.imported.toLocaleString(), f: r.failed }), r.failed ? 'error' : 'success');
      // the server numbers the converted lines; map them back to Excel row numbers
      if (r.failed) setImportRes({ ...r, errors: r.errors.map((x) => ({ ...x, line: rowNums[x.line - 2] ?? x.line })) });
      refresh();
    } catch (err) {
      toast(errText(err, t), 'error');
    } finally {
      setImporting(false);
    }
  }

  async function downloadTemplate() {
    try {
      await downloadStaffTemplate({ t, types: cardTypes.types });
    } catch {
      toast(t('err.SERVER_ERROR'), 'error');
    }
  }

  async function saveCard() {
    setSaving(true);
    try {
      const safe = String(preview?.id_number || 'card').replace(/[^A-Za-z0-9._-]/g, '_');
      await saveCardPng(printRef.current, `card-${safe}.png`);
    } catch {
      toast(t('err.SERVER_ERROR'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function runExport(cols) {
    try {
      const r = await api('/staff/export?' + new URLSearchParams({ q: dq, type, department: dept, ...sortParams }));
      if (!r.rows.length) {
        toast(t('common.noData'), 'error');
        return;
      }
      if (exportFmt === 'pdf') await exportStaffPdf({ rows: r.rows, cols, typeLabelEn, filterNote: filterNoteEn });
      else await exportStaffExcel({ rows: r.rows, cols, t, typeLabel: cardTypes.label });
      toast(t('export.done', { n: r.rows.length.toLocaleString() }));
      setExportFmt(null);
    } catch (e) {
      toast(errText(e, t), 'error');
    }
  }

  const typeOptions = [{ value: '', label: t('type.all'), color: 'rainbow' }, ...cardTypes.types.map((c) => ({ value: c.value, label: c.label, color: c.color }))];

  return (
    <>
      <div className="stats">
        <StatCard value={stats?.total} label={t('stats.total')} icon={Users} />
        <StatCard value={stats?.checked_in} label={t('stats.checkedIn')} icon={LogIn} delay={60} />
        <StatCard value={stats?.checked_out} label={t('stats.checkedOut')} tone="gold" icon={LogOut} delay={120} />
        <StatCard value={stats?.expiring} label={t('stats.expiring')} tone="gold" icon={CalendarClock} delay={180} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-head-left">
            <div>
              <div className="eyebrow">{t('staff.eyebrow')}</div>
              <h2 className="panel-title">{t('staff.title')}</h2>
            </div>
            <PageSize value={size} onChange={(v) => { setSize(v); setPage(1); }} />
          </div>
          <div className="toolbar">
            <DepartmentSelect value={dept} onChange={(v) => { setDept(v); setPage(1); }} />
            <Select value={type} onChange={(v) => { setType(v); setPage(1); }} options={typeOptions} className="w-220" />
            <div className="search">
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('staff.searchPh')} />
            </div>
            <div className="btn-group">
              <button className="btn btn-outline" onClick={() => fileRef.current?.click()} disabled={importing} title={t('staff.importExcel')}>
                {importing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} <span className="hide-sm">{t('staff.importExcel')}</span>
              </button>
              <button className="btn btn-outline" onClick={() => setExportFmt('xlsx')} title={t('staff.exportExcel')}>
                <FileSpreadsheet size={16} /> <span className="hide-sm">{t('staff.exportExcel')}</span>
              </button>
              <button className="btn btn-outline" onClick={() => setExportFmt('pdf')} title={t('staff.exportPdf')}>
                <FileText size={16} /> <span className="hide-sm">{t('staff.exportPdf')}</span>
              </button>
              <button className="btn btn-outline icon-only" onClick={downloadTemplate} title={t('staff.templateExcel')}>
                <FileDown size={16} />
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={onImport} />
            <button className="btn btn-primary" onClick={() => setEdit({})}>
              <Plus size={17} /> {t('staff.add')}
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('staff.photo')}</th>
                <SortTh k="id_number" sort={sort} onSort={toggleSort}>{t('staff.idNumber')}</SortTh>
                <SortTh k="card_number" sort={sort} onSort={toggleSort}>{t('staff.cardNumber')}</SortTh>
                <th>{t('staff.name')}</th>
                <th>{t('staff.position')}</th>
                <th>{t('staff.department')}</th>
                <th>{t('staff.checkIn')}</th>
                <th>{t('staff.checkOut')}</th>
                <th>{t('staff.cardType')}</th>
                <th>{t('staff.status')}</th>
                <th>{t('staff.expiry')}</th>
                <th className="sticky-col right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="skeleton-row">
                    <td colSpan={12}><div className="skeleton" /></td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty">{t('common.noData')}</td>
                </tr>
              )}
              {rows.map((s, i) => (
                <tr key={s.id} className="row-in" style={{ animationDelay: `${i * 18}ms` }}>
                  <td><Thumb s={s} /></td>
                  <td className="mono strong">{s.id_number}</td>
                  <td className="mono muted" title={s.card_number || ''}>{maskCard(s.card_number)}</td>
                  <td className="strong">{s.name || '—'}</td>
                  <td>{s.position || '—'}</td>
                  <td>{s.department || s.company || '—'}</td>
                  <td>{s.check_in ? <span className="time-in">{fmtTime(s.check_in, locale)}</span> : <span className="muted">—</span>}</td>
                  <td>{s.check_out ? <span className="time-out">{fmtTime(s.check_out, locale)}</span> : <span className="muted">—</span>}</td>
                  <td><TypeBadge type={s.card_type} /></td>
                  <td><StatusBadge status={s.status} /></td>
                  <td><Expiry d={s.card_expiry} /></td>
                  <td className="sticky-col right">
                    <div className="row-actions">
                      <button className="icon-btn" title={t('staff.preview')} onClick={() => setPreview(s)}><CreditCard size={16} /></button>
                      <button className="icon-btn" title={t('staff.edit', { name: s.name })} onClick={() => setEdit(s)}><Pencil size={16} /></button>
                      <button className="icon-btn danger" title={t('common.delete')} onClick={() => setDel(s)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} size={size} total={total} onPage={setPage} />
      </div>

      {edit && (
        <StaffForm
          initial={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            toast(t('common.saved'));
            refresh();
          }}
        />
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} width={420} className="modal-card">
        {preview && (
          <>
            <div className="print-area" ref={printRef}>
              <IdCard staff={preview} />
            </div>
            <p className="muted small center" style={{ margin: '14px 6px 0' }}>{t('staff.qrNote')}</p>
            <div className="modal-actions center">
              <button className="btn btn-soft" onClick={() => setPreview(null)}>{t('common.close')}</button>
              <button className="btn btn-outline" onClick={saveCard} disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : <ImageDown size={16} />} {t('staff.saveCard')}
              </button>
              <button className="btn btn-gold" onClick={() => printCard(printRef.current)}><Printer size={16} /> {t('staff.print')}</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={!!del}
        title={t('staff.deleteTitle')}
        message={del ? t('staff.deleteConfirm', { name: del.name || '—', id: del.id_number }) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onClose={() => setDel(null)}
      />

      <ExportDialog format={exportFmt} filterNote={filterNote} onClose={() => setExportFmt(null)} onExport={runExport} />

      <Modal open={!!importRes} onClose={() => setImportRes(null)} width={520}>
        <h3 className="modal-title">{t('staff.importErrors')}</h3>
        <p className="muted small" style={{ margin: '6px 0 0' }}>{t('staff.importDone', { n: importRes?.imported ?? 0, f: importRes?.failed ?? 0 })}</p>
        <div className="table-wrap" style={{ maxHeight: 360, marginTop: 12 }}>
          <table className="table compact">
            <thead><tr><th>{t('staff.line')}</th><th>Error</th></tr></thead>
            <tbody>
              {importRes?.errors.map((e, i) => (
                <tr key={i}><td className="mono">{e.line}</td><td>{t(`err.${e.error}`) === `err.${e.error}` ? e.error : t(`err.${e.error}`)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}><button className="btn btn-soft" onClick={() => setImportRes(null)}>{t('common.close')}</button></div>
      </Modal>
    </>
  );
}
