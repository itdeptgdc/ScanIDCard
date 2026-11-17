'use client';
import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import Modal from '@/components/Modal';
import { useI18n } from '@/lib/i18n';
import { EXPORT_COLS } from '@/lib/staffExport';

const STORE = 'staff.exportCols';
const ALL = EXPORT_COLS.map((c) => c.key);

function loadSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (Array.isArray(v)) {
      const keep = v.filter((k) => ALL.includes(k));
      if (keep.length) return keep;
    }
  } catch {}
  return ALL;
}

/** Column picker for Excel / PDF export. format: 'xlsx' | 'pdf' */
export default function ExportDialog({ format, filterNote, onClose, onExport }) {
  const { t } = useI18n();
  const [sel, setSel] = useState(ALL);
  const [busy, setBusy] = useState(false);
  const allRef = useRef(null);

  useEffect(() => { if (format) setSel(loadSaved()); }, [format]);

  const allOn = sel.length === ALL.length;
  const someOn = sel.length > 0 && !allOn;
  useEffect(() => { if (allRef.current) allRef.current.indeterminate = someOn; }, [someOn]);

  const toggle = (k) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const toggleAll = () => setSel(allOn ? [] : ALL);

  async function run() {
    if (!sel.length) return;
    try { localStorage.setItem(STORE, JSON.stringify(sel)); } catch {}
    setBusy(true);
    try {
      // keep table order regardless of click order
      await onExport(EXPORT_COLS.filter((c) => sel.includes(c.key)));
    } finally {
      setBusy(false);
    }
  }

  const isPdf = format === 'pdf';
  const Icon = isPdf ? FileText : FileSpreadsheet;

  return (
    <Modal open={!!format} onClose={busy ? undefined : onClose} width={560}>
      <div className="export-head">
        <span className={`export-icon ${isPdf ? 'pdf' : 'xlsx'}`}><Icon size={22} /></span>
        <div>
          <h3 className="modal-title">{t(isPdf ? 'export.titlePdf' : 'export.titleExcel')}</h3>
          <p className="muted small">{t('export.hint')}</p>
        </div>
      </div>

      <label className="col-check col-all">
        <input ref={allRef} type="checkbox" checked={allOn} onChange={toggleAll} />
        <span>{t('export.selectAll')}</span>
        <span className="muted small">{t('export.selected', { n: sel.length, total: ALL.length })}</span>
      </label>

      <div className="col-grid">
        {EXPORT_COLS.map((c) => (
          <label key={c.key} className={`col-check ${sel.includes(c.key) ? 'on' : ''}`}>
            <input type="checkbox" checked={sel.includes(c.key)} onChange={() => toggle(c.key)} />
            <span>{t(c.label)}</span>
          </label>
        ))}
      </div>

      {filterNote && <p className="muted small export-note">{t('export.filtered', { f: filterNote })}</p>}
      {isPdf && <p className="muted small export-note">{t('export.pdfNote')}</p>}

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button className="btn btn-soft" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={run} disabled={busy || !sel.length}>
          {busy ? <Loader2 size={16} className="spin" /> : <Icon size={16} />}
          {t(isPdf ? 'export.downloadPdf' : 'export.downloadExcel')}
        </button>
      </div>
    </Modal>
  );
}
