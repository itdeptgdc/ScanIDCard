'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, errText } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';

const OK = ['check_in', 'check_out', 'duplicate'];
const SIZE = 25;

export default function LogsPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api(`/scan/logs?result=${filter === 'rejected' ? 'rejected' : ''}&limit=${SIZE}&offset=${(page - 1) * SIZE}`);
      setRows(r.rows);
      setTotal(r.total ?? r.rows.length);
    } catch (e) {
      toast(errText(e, t), 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeFilter(f) {
    setFilter(f);
    setPage(1);
  }

  useEffect(() => { load(); }, [load]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">{t('logs.eyebrow')}</div>
          <h2 className="panel-title">{t('logs.title')}</h2>
        </div>
        <div className="toolbar">
          <div className="seg">
            {['all', 'rejected'].map((f) => (
              <button key={f} className={`seg-btn ${filter === f ? 'active' : ''}`} onClick={() => changeFilter(f)}>{t(`logs.${f}`)}</button>
            ))}
          </div>
          <button className="btn btn-outline icon-only" onClick={load} title="refresh"><RefreshCw size={16} className={loading ? 'spin' : ''} /></button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('logs.time')}</th>
              <th>{t('logs.result')}</th>
              <th>{t('logs.staff')}</th>
              <th>{t('logs.raw')}</th>
              <th>{t('att.method')}</th>
              <th>{t('logs.by')}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="empty">{t('common.noData')}</td></tr>}
            {rows.map((r) => {
              const ok = OK.includes(r.result);
              return (
                <tr key={r.id}>
                  <td className="muted">{fmtDateTime(r.at, locale)}</td>
                  <td><span className={`badge ${ok ? 'badge-active' : 'badge-blocked'}`}>{ok ? t(`result.${r.result}`) : t(`err.${r.result}`)}</span></td>
                  <td>{r.name ? <><b>{r.name}</b> <span className="mono muted">{r.id_number}</span></> : '—'}</td>
                  <td className="mono muted">{r.raw || '—'}</td>
                  <td className="muted">{t(`method.${r.method}`)}</td>
                  <td>{r.username || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} size={SIZE} total={total} onPage={setPage} />
    </div>
  );
}
