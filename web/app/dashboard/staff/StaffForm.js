'use client';
import { useRef, useState } from 'react';
import { CheckCircle2, Lock, Ban, Loader2, SlidersHorizontal } from 'lucide-react';
import PhotoCropper from '@/components/PhotoCropper';
import { api, errText } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useCardTypes } from '@/lib/cardTypes';
import Modal from '@/components/Modal';
import Select from '@/components/Select';

const EMPTY = {
  id_number: '', card_number: '', name: '', position: '', department: '', company: '', passport: '',
  card_type: 'casino_staff', status: 'active', hire_date: '', card_expiry: '',
  nationality: '', sex: '',
};

// suggestions only — any nationality can be typed
const NATIONALITIES = ['Cambodian', 'Thai', 'Vietnamese', 'Lao', 'Chinese', 'Malaysian', 'Filipino', 'Indonesian', 'Myanmar', 'Indian', 'Korean', 'Japanese'];

/** Downscale big camera photos (max 1600px) so the photo editor stays fast. */
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PHOTO_INVALID'));
    };
    img.src = url;
  });
}

export default function StaffForm({ initial, onClose, onSaved }) {
  const { t } = useI18n();
  const cardTypes = useCardTypes(t);
  const isNew = !initial.id;
  const [f, setF] = useState(() => {
    const o = { ...EMPTY };
    for (const k of Object.keys(EMPTY)) if (initial[k] !== null && initial[k] !== undefined) o[k] = initial[k];
    return o;
  });
  const [photo, setPhoto] = useState(initial.has_photo ? `/api/staff/${initial.id}/photo?v=${initial.photo_version}` : null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [drag, setDrag] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));

  // A newly chosen photo goes straight into the editor (crop / zoom / rotate / brightness)
  async function pick(file) {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      setCropSrc(await resizeImage(file));
    } catch {
      setError(t('err.PHOTO_INVALID'));
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let id = initial.id;
      if (isNew) id = (await api('/staff', { method: 'POST', body: f })).id;
      else await api(`/staff/${id}`, { method: 'PUT', body: f });
      if (photoChanged) {
        if (photo) await api(`/staff/${id}/photo`, { method: 'PUT', body: { data: photo } });
        else await api(`/staff/${id}/photo`, { method: 'DELETE' });
      }
      onSaved();
    } catch (err) {
      setError(errText(err, t));
      setBusy(false);
    }
  }

  const typeOptions = cardTypes.types.map((c) => ({ value: c.value, label: c.custom ? `${c.label} ★` : c.label, color: c.color }));
  const sexOptions = [
    { value: '', label: '—' },
    { value: 'male', label: t('sex.male') },
    { value: 'female', label: t('sex.female') },
  ];
  const statuses = [
    { v: 'active', icon: CheckCircle2 },
    { v: 'locked', icon: Lock },
    { v: 'blocked', icon: Ban },
  ];

  return (
    <Modal open onClose={onClose} width={760}>
      <form onSubmit={save}>
        <h3 className="modal-title">{isNew ? t('staff.new') : t('staff.edit', { name: initial.name || initial.id_number })}</h3>
        <div className="staff-form">
          <div
            className={`photo-drop ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          >
            <div
              className={`photo-frame ${photo ? 'can-adjust' : ''}`}
              onClick={() => (photo ? setCropSrc(photo) : fileRef.current?.click())}
              title={photo ? t('staff.adjustPhoto') : t('staff.choosePhoto')}
            >
              {photo && (
                <span className="photo-adjust-hint">
                  <SlidersHorizontal size={18} /> {t('staff.adjustPhoto')}
                </span>
              )}
              {photo ? (
                <img src={photo} alt="" />
              ) : (
                <svg viewBox="0 0 100 120" aria-hidden>
                  <rect width="100" height="120" fill="#ece3ea" />
                  <circle cx="50" cy="45" r="20" fill="#bba2b6" />
                  <path d="M14 120c2-26 18-40 36-40s34 14 36 40z" fill="#bba2b6" />
                </svg>
              )}
            </div>
            <div className="photo-btns">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>{t('staff.choosePhoto')}</button>
              {photo && (
                <button type="button" className="btn btn-gold btn-sm" onClick={() => setCropSrc(photo)}>
                  <SlidersHorizontal size={14} /> {t('staff.adjustPhoto')}
                </button>
              )}
            </div>
            <span className="muted small">{t('staff.dropPhoto')}</span>
            {photo && (
              <button type="button" className="link-btn" onClick={() => { setPhoto(null); setPhotoChanged(true); }}>{t('staff.removePhoto')}</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </div>

          <div className="form-grid">
            <div className="field-stack">
              <label className="field">
                <span>{t('staff.idNumber')} <em>*</em></span>
                <input className="mono" value={f.id_number} onChange={set('id_number')} required maxLength={40} />
              </label>
              {/* record-only details: not printed on the ID card */}
              <div className="field-pair">
                <label className="field">
                  <span>{t('staff.nationality')}</span>
                  <input value={f.nationality} onChange={set('nationality')} maxLength={60} list="nationality-list" />
                  <datalist id="nationality-list">
                    {NATIONALITIES.map((n) => <option key={n} value={n} />)}
                  </datalist>
                </label>
                <div className="field">
                  <span>{t('staff.sex')}</span>
                  <Select value={f.sex} onChange={set('sex')} options={sexOptions} placeholder="—" />
                </div>
              </div>
            </div>
            <label className="field">
              <span>{t('staff.cardNumber')}</span>
              <input className="mono" value={f.card_number} onChange={set('card_number')} maxLength={40} autoComplete="off" />
              <small className="hint">{t('staff.cardHint')}</small>
            </label>
            <label className="field">
              <span>{t('staff.name')}</span>
              <input value={f.name} onChange={set('name')} maxLength={120} />
            </label>
            <label className="field">
              <span>{t('staff.position')}</span>
              <input value={f.position} onChange={set('position')} maxLength={120} />
            </label>
            <label className="field">
              <span>{t('staff.department')}</span>
              <input value={f.department} onChange={set('department')} maxLength={120} />
            </label>
            <label className="field">
              <span>{t('staff.company')}</span>
              <input value={f.company} onChange={set('company')} maxLength={120} />
            </label>
            <div className="field">
              <span>{t('staff.cardType')} <em>*</em></span>
              <Select value={f.card_type} onChange={set('card_type')} options={typeOptions} />
            </div>
            <label className="field">
              <span>{t('staff.hireDate')}</span>
              <input type="date" value={f.hire_date || ''} onChange={set('hire_date')} />
            </label>
            <label className="field">
              <span>{t('staff.passport')}</span>
              <input value={f.passport} onChange={set('passport')} maxLength={40} />
            </label>
            <label className="field">
              <span>{t('staff.expiry')}</span>
              <input type="date" value={f.card_expiry || ''} onChange={set('card_expiry')} />
            </label>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-foot">
          <div className="status-seg">
            <span className="seg-label">{t('staff.status')}</span>
            <div className="seg">
              {statuses.map(({ v, icon: Icon }) => (
                <button type="button" key={v} className={`seg-btn seg-${v} ${f.status === v ? 'active' : ''}`} onClick={() => set('status')(v)}>
                  <Icon size={14} /> {t(`status.${v}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-soft" onClick={onClose}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 size={16} className="spin" />} {t('common.save')}
            </button>
          </div>
        </div>
      </form>
      {cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onApply={(data) => {
            setPhoto(data);
            setPhotoChanged(true);
            setCropSrc(null);
          }}
        />
      )}
    </Modal>
  );
}
