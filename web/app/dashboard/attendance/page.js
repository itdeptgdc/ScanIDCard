'use client';
import { useCallback, useEffect, useState } from 'react';
import { Search, Download, UserCheck, LogOut, UserX } from 'lucide-react';
import { api, errText, download } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtTime, todayStr } from '@/lib/format';
import { useToast } from '@/components/Toast';
import StatCard from '@/components/StatCard';
import Pagination from '@/components/Pagination';
import { TypeBadge } from '@/components/Badges';
import DepartmentSelect from '@/components/DepartmentSelect';
import PageSize from '@/components/PageSize';

const SIZE = 50;

function Thumb({ r }) {
  if (r.has_photo) return <img className="thumb" src={`/api/staff/${r.staff_id}/photo?v=${r.photo_version}`} alt="" loading="lazy" />;
  return <div className="thumb thumb-ph">{(r.name || '?').trim().charAt(0).toUpperCase() || '?'}</div>;
}

function hours(a, b) {
  if (!a || !b) return '—';
  const h = (new Date(b) - new Date(a)) / 3600e3;
  return h.toFixed(2);
}

export default function AttendancePage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [dept, setDept] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(SIZE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
      const p = new URLSearchParams({ date, q: dq, department: dept, page: String(page), size: String(size) });
      setData(await api('/attendance?' + p));
    } catch (e) {
      toast(errText(e, t), 'error');
    } finally {
      setLoading(false);
    }
  }, [date, dq, dept, page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // live refresh every 15 s when looking at today
  useEffect(() => {
    if (date !== todayStr()) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [date, load]);

  const rows = data?.rows || [];

  return (
    <>
      <div className="stats stats-3">
        <StatCard value={data?.summary.present} label={t('att.present')} icon={UserCheck} />
        <StatCard value={data?.summary.checkedOut} label={t('att.checkedOut')} icon={LogOut} delay={60} />
        <StatCard value={data?.summary.notScanned} label={t('att.notScanned')} tone="gold" icon={UserX} delay={120} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-head-left">
            <div>
              <div className="eyebrow">{t('att.eyebrow')}</div>
              <h2 className="panel-title">{t('att.title')}</h2>
            </div>
            <PageSize value={size} onChange={(v) => { setSize(v); setPage(1); }} />
          </div>
          <div className="toolbar">
            <DepartmentSelect value={dept} onChange={(v) => { setDept(v); setPage(1); }} />
            <div className="search">
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('att.searchPh')} />
            </div>
            <input type="date" className="date-input" value={date} onChange={(e) => { setDate(e.target.value || todayStr()); setPage(1); }} />
            <button className="btn btn-outline" onClick={() => download(`/attendance/export.csv?${new URLSearchParams({ from: date, to: date, department: dept })}`)}>
              <Download size={16} /> {t('common.export')}
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('staff.photo')}</th>
                <th>{t('staff.idNumber')}</th>
                <th>{t('staff.name')}</th>
                <th>{t('staff.cardType')}</th>
                <th>{t('staff.department')}</th>
                <th>{t('staff.checkIn')}</th>
                <th>{t('staff.checkOut')}</th>
                <th>{t('att.hours')}</th>
                <th>{t('att.method')}</th>
                <th>{t('staff.status')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr className="skeleton-row"><td colSpan={10}><div className="skeleton" /></td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={10} className="empty">{t('att.noScans')}</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id} className="row-in" style={{ animationDelay: `${i * 12}ms` }}>
                  <td><Thumb r={r} /></td>
                  <td className="mono strong">{r.id_number}</td>
                  <td className="strong">{r.name || '—'}</td>
                  <td><TypeBadge type={r.card_type} /></td>
                  <td>{r.department || '—'}</td>
                  <td>{r.check_in ? <span className="time-in">{fmtTime(r.check_in, locale)}</span> : <span className="muted">—</span>}</td>
                  <td>{r.check_out ? <span className="time-out">{fmtTime(r.check_out, locale)}</span> : <span className="muted">—</span>}</td>
                  <td className="mono">{hours(r.check_in, r.check_out)}</td>
                  <td className="muted small">
                    {r.method_in ? t(`method.${r.method_in}`) : '—'}
                    {r.method_out ? ` / ${t(`method.${r.method_out}`)}` : ''}
                  </td>
                  <td>
                    {r.check_out ? <span className="badge badge-out">{t('att.out')}</span> : <span className="badge badge-active"><span className="live-dot" />{t('att.inWork')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={page} size={size} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}
