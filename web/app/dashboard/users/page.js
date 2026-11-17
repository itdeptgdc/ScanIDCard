'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, ShieldCheck, UserRound, ScanLine, Loader2 } from 'lucide-react';
import { api, errText } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import Modal, { ConfirmModal } from '@/components/Modal';
import { RoleBadge } from '@/components/Badges';

const ROLES = [
  { v: 'admin', icon: ShieldCheck },
  { v: 'hr', icon: UserRound },
  { v: 'checker', icon: ScanLine },
];

function Toggle({ on, onChange, disabled }) {
  return (
    <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => !disabled && onChange(!on)} disabled={disabled} aria-pressed={on}>
      <span />
    </button>
  );
}

function UserForm({ initial, onClose, onSaved }) {
  const { t } = useI18n();
  const isNew = !initial.id;
  const [f, setF] = useState({
    username: initial.username || '',
    display_name: initial.display_name || '',
    role: initial.role || 'checker',
    active: initial.active ?? true,
    password: '',
  });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isNew) await api('/users', { method: 'POST', body: f });
      else await api(`/users/${initial.id}`, { method: 'PUT', body: { display_name: f.display_name, role: f.role, active: f.active, password: f.password || undefined } });
      onSaved();
    } catch (err) {
      setError(errText(err, t));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} width={480}>
      <form onSubmit={save}>
        <h3 className="modal-title">{isNew ? t('users.new') : t('users.edit', { name: initial.username })}</h3>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <label className="field">
            <span>{t('users.username')}</span>
            <input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} disabled={!isNew} required autoComplete="off" />
            <small className="hint">{t('users.usernameHint')}</small>
          </label>
          <label className="field">
            <span>{t('users.displayName')}</span>
            <input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
            <small className="hint">{t('users.displayHint')}</small>
          </label>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <span>{t('users.role')}</span>
          <div className="seg seg-full">
            {ROLES.map(({ v, icon: Icon }) => (
              <button type="button" key={v} className={`seg-btn ${f.role === v ? 'active' : ''}`} onClick={() => setF({ ...f, role: v })}>
                <Icon size={15} /> {t(`role.${v}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="field" style={{ marginTop: 14 }}>
          <span>{isNew ? t('users.password') : t('users.newPassword')}</span>
          <div className="input-icon no-lead">
            <input type={show ? 'text' : 'password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={isNew ? '' : t('users.keepPh')} required={isNew} minLength={8} autoComplete="new-password" />
            <button type="button" className="eye" onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-foot">
          <div className="status-inline">
            <span className="seg-label">{t('users.status')}</span>
            <Toggle on={f.active} onChange={(v) => setF({ ...f, active: v })} />
            <span className={f.active ? 'txt-green' : 'txt-red'}>{f.active ? t('users.active') : t('users.blocked')}</span>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-soft" onClick={onClose}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="spin" />} {t('common.save')}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);

  const load = useCallback(() => api('/users').then((r) => setRows(r.rows)).catch((e) => toast(errText(e, t), 'error')), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    api('/auth/me').then(setMe).catch(() => {});
  }, [load]);

  async function toggleActive(u, active) {
    try {
      await api(`/users/${u.id}`, { method: 'PUT', body: { active } });
      setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, active } : r)));
    } catch (e) {
      toast(errText(e, t), 'error');
    }
  }

  async function confirmDelete() {
    try {
      await api(`/users/${del.id}`, { method: 'DELETE' });
      toast(t('common.deleted'));
      setDel(null);
      load();
    } catch (e) {
      toast(errText(e, t), 'error');
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">{t('users.eyebrow')}</div>
          <h2 className="panel-title">{t('users.title')}</h2>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> {t('users.add')}</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('users.username')}</th>
              <th>{t('users.displayName')}</th>
              <th>{t('users.role')}</th>
              <th>{t('users.created')}</th>
              <th>{t('users.status')}</th>
              <th className="right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => {
              const self = me && me.id === u.id;
              return (
                <tr key={u.id} className="row-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="strong">{u.username}</td>
                  <td>{u.display_name || '—'}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td className="muted">{fmtDateTime(u.created_at, locale)}</td>
                  <td>
                    <div className="status-inline">
                      <Toggle on={u.active} disabled={self} onChange={(v) => toggleActive(u, v)} />
                      <span className={u.active ? 'txt-green' : 'txt-red'}>{u.active ? t('users.active') : t('users.blocked')}</span>
                    </div>
                  </td>
                  <td className="right">
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => setEdit(u)}><Pencil size={16} /></button>
                      <button className="icon-btn danger" disabled={self} onClick={() => setDel(u)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && <UserForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast(t('common.saved')); load(); }} />}
      <ConfirmModal
        open={!!del}
        title={t('users.deleteTitle')}
        message={del ? t('users.deleteConfirm', { name: del.username }) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onClose={() => setDel(null)}
      />
    </div>
  );
}
