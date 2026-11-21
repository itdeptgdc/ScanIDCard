'use client';
/**
 * Visual ID card designer: drag / resize elements on the 300 × 478 card, edit their properties,
 * upload a background image and logos. Saves to /api/card-templates.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Save, Loader2, Type, TextCursorInput, UserSquare2, QrCode, ImagePlus, Square, Circle, Minus, Trash2, Copy,
  ArrowUp, ArrowDown, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical,
  AlignEndVertical, Upload, ZoomIn, ZoomOut, Layers, Settings2, Bold, Italic, CaseUpper, PanelLeft,
} from 'lucide-react';
import { KHMER_BRAND, EN_BRAND } from '@/lib/cardTypes';
import { api, errText } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import TemplateCard, { CARD_W, CARD_H, FIELDS, FONTS, assetUrl } from '@/components/TemplateCard';

export const SAMPLE_STAFF = {
  id: 0, name: 'SOK DARA', position: 'Supervisor', department: 'Front Office', company: 'Poipet Resort & Casino',
  id_number: '20260001', card_number: '0012345678', passport: 'N1234567', hire_date: '2024-01-15', card_expiry: '2027-12-31',
  has_photo: false,
};

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v) => Math.round(v);

/**
 * Layout presets. 'strip' (default) mirrors the built-in Staff card: coloured strip on the left with the
 * brand name written vertically, logo, photo, labelled details, QR and HR signature.
 */
export const LAYOUTS = ['strip', 'band', 'blank'];

export function layoutElements(layout, color = '#4d0a40') {
  if (layout === 'blank') return [];
  if (layout === 'band') return bandElements(color);
  const row = (field, label, y) => ({ id: uid(), kind: 'field', field, prefix: label, labelWidth: 52, sep: ': ', x: 74, y, w: 218, h: 19, fontSize: 13, fontWeight: 700, color: '#1a237e', vAlign: 'center' });
  return [
    // side strip with the Khmer + English brand in gold, exactly like the built-in Staff card
    { id: uid(), kind: 'strip', style: 'house', x: 0, y: 0, w: 66, h: 478, fill: '', gold: true, fontSize: 25 },
    { id: uid(), kind: 'image', asset: 'logo', x: 136, y: 10, w: 90, h: 70, fit: 'contain', radius: 0 },
    { id: uid(), kind: 'photo', x: 116, y: 90, w: 130, h: 158, radius: 4, borderColor: color, borderWidth: 3 },
    row('name', 'Name', 266),
    row('position', 'Post.', 287),
    row('department', 'Dept.', 308),
    row('id_number', 'ID.No', 329),
    row('hire_date', 'H.date', 350),
    { id: uid(), kind: 'shape', x: 78, y: 442, w: 104, h: 1, fill: '#1a237e', radius: 0 },
    { id: uid(), kind: 'text', x: 78, y: 446, w: 104, h: 18, text: 'HR.Manager', fontSize: 11, fontWeight: 700, color: '#1a237e', align: 'center' },
    { id: uid(), kind: 'qr', x: 212, y: 384, w: 80, h: 80 },
  ];
}

function bandElements(color) {
  return [
      { id: uid(), kind: 'shape', x: 0, y: 0, w: 300, h: 92, fill: color, radius: 0 },
      { id: uid(), kind: 'text', x: 10, y: 22, w: 280, h: 48, text: 'POIPET RESORT & CASINO', fontSize: 20, fontWeight: 800, color: '#ffffff', align: 'center', letterSpacing: 1 },
      { id: uid(), kind: 'photo', x: 90, y: 108, w: 120, h: 150, radius: 8, borderColor: color, borderWidth: 3 },
      { id: uid(), kind: 'field', field: 'name', x: 10, y: 268, w: 280, h: 32, fontSize: 20, fontWeight: 800, color: '#1a237e', align: 'center', upper: true },
      { id: uid(), kind: 'field', field: 'position', x: 10, y: 300, w: 280, h: 22, fontSize: 14, fontWeight: 600, color: '#555555', align: 'center' },
      { id: uid(), kind: 'field', field: 'id_number', prefix: 'ID.No : ', x: 20, y: 332, w: 160, h: 22, fontSize: 14, fontWeight: 700, color: '#1a237e' },
      { id: uid(), kind: 'field', field: 'card_expiry', prefix: 'Exp : ', x: 20, y: 356, w: 160, h: 22, fontSize: 14, fontWeight: 700, color: '#1a237e' },
      { id: uid(), kind: 'qr', x: 196, y: 330, w: 88, h: 88 },
      { id: uid(), kind: 'shape', x: 0, y: 452, w: 300, h: 26, fill: color, radius: 0 },
  ];
}

/** Starting design for a new template (left-strip layout). */
export function starterDesign(color = '#4d0a40') {
  return { bgColor: '#ffffff', bgAsset: null, bgFit: 'cover', bgOpacity: 1, elements: layoutElements('strip', color) };
}

const DEFAULTS = {
  text: () => ({ kind: 'text', x: 40, y: 40, w: 220, h: 30, text: 'Text', fontSize: 18, fontWeight: 700, color: '#1a237e', align: 'center' }),
  field: () => ({ kind: 'field', field: 'name', prefix: '', x: 30, y: 60, w: 240, h: 28, fontSize: 16, fontWeight: 700, color: '#1a237e', align: 'left' }),
  photo: () => ({ kind: 'photo', x: 90, y: 110, w: 120, h: 150, radius: 6, borderColor: '#4d0a40', borderWidth: 0 }),
  qr: () => ({ kind: 'qr', x: 106, y: 340, w: 88, h: 88 }),
  rect: () => ({ kind: 'shape', x: 0, y: 0, w: 300, h: 60, fill: '#4d0a40', radius: 0 }),
  circle: () => ({ kind: 'shape', x: 110, y: 110, w: 80, h: 80, fill: '#d4a64a', radius: 999 }),
  line: () => ({ kind: 'shape', x: 30, y: 240, w: 240, h: 3, fill: '#d4a64a', radius: 2 }),
  logo: () => ({ kind: 'image', asset: 'logo', x: 110, y: 14, w: 80, h: 80, fit: 'contain', radius: 0 }),
  strip: () => ({ kind: 'strip', style: 'house', x: 0, y: 0, w: 66, h: 478, fill: '', gold: true, fontSize: 25 }),
};

/** Shrink big images (max 1400px) before upload; keeps PNG transparency. */
function readImage(file, max = 1400) {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(file.type === 'image/png' || file.type === 'image/webp' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PHOTO_INVALID'));
    };
    img.src = url;
  });
}

// ---------- small inputs ----------
function Num({ label, value, onChange, min, max, step = 1, suffix }) {
  return (
    <label className="dz-num">
      <span>{label}</span>
      <div>
        <input type="number" value={value ?? 0} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}
function Color({ label, value, onChange, allowNone }) {
  const v = value || '';
  return (
    <label className="dz-color">
      <span>{label}</span>
      <div>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={v} placeholder={allowNone ? 'none' : ''} onChange={(e) => onChange(e.target.value.trim())} maxLength={9} />
        {allowNone && v && (
          <button type="button" className="dz-x" onClick={() => onChange('')} title="none">
            <X size={13} />
          </button>
        )}
      </div>
    </label>
  );
}
function Seg({ value, onChange, items }) {
  return (
    <div className="dz-seg">
      {items.map(({ v, icon: Icon, label }) => (
        <button type="button" key={String(v)} className={value === v ? 'on' : ''} onClick={() => onChange(v)} title={label}>
          {Icon ? <Icon size={15} /> : label}
        </button>
      ))}
    </div>
  );
}

export default function CardDesigner({ initial, onClose, onSaved }) {
  const { t } = useI18n();
  const isNew = !initial?.id;
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || '#7b1fa2');
  const [design, setDesign] = useState(() => {
    const d = initial?.design && Array.isArray(initial.design.elements) ? initial.design : starterDesign(initial?.color || '#4d0a40');
    return JSON.parse(JSON.stringify(d));
  });
  const [sel, setSel] = useState(null);
  const [zoom, setZoom] = useState(1.3);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('props'); // mobile / narrow: props | layers
  const undo = useRef([]);
  const redo = useRef([]);
  const drag = useRef(null);
  const designRef = useRef(design);
  designRef.current = design;
  const bgFile = useRef(null);
  const imgFile = useRef(null);
  const imgTarget = useRef(null); // element id whose image is being replaced

  const selected = design.elements.find((e) => e.id === sel) || null;

  // ---------- state helpers (with undo) ----------
  const snapshot = () => {
    undo.current.push(JSON.stringify(designRef.current));
    if (undo.current.length > 100) undo.current.shift();
    redo.current = [];
  };
  const change = useCallback((fn, record = true) => {
    if (record) snapshot();
    setDesign((d) => fn(JSON.parse(JSON.stringify(d))));
    setDirty(true);
  }, []);
  const patchEl = (id, p, record = true) => change((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? { ...e, ...p } : e)) }), record);
  const patchDesign = (p) => change((d) => ({ ...d, ...p }));

  function doUndo() {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(JSON.stringify(designRef.current));
    setDesign(JSON.parse(prev));
    setDirty(true);
  }
  function doRedo() {
    const next = redo.current.pop();
    if (!next) return;
    undo.current.push(JSON.stringify(designRef.current));
    setDesign(JSON.parse(next));
    setDirty(true);
  }

  function add(type) {
    const el = { id: uid(), ...DEFAULTS[type]() };
    change((d) => ({ ...d, elements: [...d.elements, el] }));
    setSel(el.id);
  }
  function remove(id = sel) {
    if (!id) return;
    change((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
    setSel(null);
  }
  function duplicate(id = sel) {
    const src = designRef.current.elements.find((e) => e.id === id);
    if (!src) return;
    const el = { ...JSON.parse(JSON.stringify(src)), id: uid(), x: src.x + 10, y: src.y + 10 };
    change((d) => ({ ...d, elements: [...d.elements, el] }));
    setSel(el.id);
  }
  function move(id, dir) {
    change((d) => {
      const i = d.elements.findIndex((e) => e.id === id);
      const j = dir === 'up' ? i + 1 : dir === 'down' ? i - 1 : dir === 'top' ? d.elements.length - 1 : 0;
      if (i < 0 || j < 0 || j >= d.elements.length || i === j) return d;
      const els = [...d.elements];
      const [it] = els.splice(i, 1);
      els.splice(j, 0, it);
      return { ...d, elements: els };
    });
  }
  function alignEl(where) {
    if (!selected) return;
    const p = {};
    if (where === 'left') p.x = 0;
    if (where === 'hcenter') p.x = round((CARD_W - selected.w) / 2);
    if (where === 'right') p.x = CARD_W - selected.w;
    if (where === 'top') p.y = 0;
    if (where === 'vcenter') p.y = round((CARD_H - selected.h) / 2);
    if (where === 'bottom') p.y = CARD_H - selected.h;
    patchEl(selected.id, p);
  }

  // ---------- drag / resize ----------
  function startDrag(ev, el, mode) {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    setSel(el.id);
    snapshot();
    drag.current = { id: el.id, mode, sx: ev.clientX, sy: ev.clientY, o: { x: el.x, y: el.y, w: el.w, h: el.h } };
    const onMove = (e) => {
      const g = drag.current;
      if (!g) return;
      const dx = (e.clientX - g.sx) / zoom;
      const dy = (e.clientY - g.sy) / zoom;
      let { x, y, w, h } = g.o;
      if (g.mode === 'move') {
        x += dx;
        y += dy;
        // snap to card centre lines / edges (4px)
        const cx = x + w / 2;
        const cy = y + h / 2;
        if (Math.abs(cx - CARD_W / 2) < 4) x = (CARD_W - w) / 2;
        if (Math.abs(cy - CARD_H / 2) < 4) y = (CARD_H - h) / 2;
        if (Math.abs(x) < 4) x = 0;
        if (Math.abs(y) < 4) y = 0;
        if (Math.abs(x + w - CARD_W) < 4) x = CARD_W - w;
        if (Math.abs(y + h - CARD_H) < 4) y = CARD_H - h;
      } else {
        const m = g.mode;
        if (m.includes('e')) w = Math.max(4, g.o.w + dx);
        if (m.includes('s')) h = Math.max(2, g.o.h + dy);
        if (m.includes('w')) {
          w = Math.max(4, g.o.w - dx);
          x = g.o.x + g.o.w - w;
        }
        if (m.includes('n')) {
          h = Math.max(2, g.o.h - dy);
          y = g.o.y + g.o.h - h;
        }
        if (e.shiftKey && (m.length === 2)) {
          // keep proportions
          const r = g.o.w / g.o.h;
          h = w / r;
          if (m.includes('n')) y = g.o.y + g.o.h - h;
        }
      }
      setDesign((d) => ({ ...d, elements: d.elements.map((it) => (it.id === g.id ? { ...it, x: round(x), y: round(y), w: round(w), h: round(h) } : it)) }));
      setDirty(true);
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        doRedo();
        return;
      }
      if (!sel) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove(sel);
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate(sel);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const s = e.shiftKey ? 10 : 1;
        const el = designRef.current.elements.find((x) => x.id === sel);
        if (!el) return;
        const p = { x: el.x, y: el.y };
        if (e.key === 'ArrowLeft') p.x -= s;
        if (e.key === 'ArrowRight') p.x += s;
        if (e.key === 'ArrowUp') p.y -= s;
        if (e.key === 'ArrowDown') p.y += s;
        patchEl(sel, p);
      } else if (e.key === 'Escape') {
        setSel(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- images ----------
  async function upload(file) {
    if (!file || !file.type.startsWith('image/')) return null;
    setUploading(true);
    setError('');
    try {
      const data = await readImage(file);
      const r = await api('/card-templates/assets', { method: 'POST', body: { data } });
      return r.id;
    } catch (e) {
      setError(errText(e, t));
      return null;
    } finally {
      setUploading(false);
    }
  }
  async function onBg(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    const id = await upload(f);
    if (id) patchDesign({ bgAsset: id });
  }
  async function onImg(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    const id = await upload(f);
    if (!id) return;
    if (imgTarget.current) {
      patchEl(imgTarget.current, { asset: id });
    } else {
      const el = { id: uid(), kind: 'image', asset: id, x: 100, y: 20, w: 100, h: 100, fit: 'contain', radius: 0 };
      change((d) => ({ ...d, elements: [...d.elements, el] }));
      setSel(el.id);
    }
    imgTarget.current = null;
  }
  const pickImage = (targetId = null) => {
    imgTarget.current = targetId;
    imgFile.current?.click();
  };

  // ---------- save / close ----------
  async function save() {
    if (!name.trim()) {
      setError(t('err.NAME_REQUIRED'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = { name: name.trim(), color, design };
      const r = initial?.builtin
        ? await api(`/card-templates/builtin/${initial.builtin}`, { method: 'PUT', body }) // edited built-in design
        : isNew
        ? await api('/card-templates', { method: 'POST', body })
        : await api(`/card-templates/${initial.id}`, { method: 'PUT', body });
      setDirty(false);
      onSaved(r);
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (dirty && !window.confirm(t('tpl.discard'))) return;
    onClose();
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const kindLabel = (e) =>
    e.kind === 'field' ? `${t('tpl.field')}: ${t(`tpl.f.${e.field}`)}` : e.kind === 'text' ? `${t('tpl.text')}: ${String(e.text || '').slice(0, 18)}` : t(`tpl.k.${e.kind}`);
  const KIcon = { text: Type, field: TextCursorInput, photo: UserSquare2, qr: QrCode, image: ImagePlus, shape: Square, strip: PanelLeft };

  const isText = selected && (selected.kind === 'text' || selected.kind === 'field');

  return (
    <div className="designer" role="dialog" aria-modal="true">
      {/* ---------- top bar ---------- */}
      <div className="dz-top">
        <button type="button" className="icon-btn" onClick={close} title={t('common.close')}>
          <X size={18} />
        </button>
        {/* built-in types keep their name and badge colour; only the artwork is editable */}
        <input className="dz-name" value={name} readOnly={!!initial?.builtin} onChange={(e) => { setName(e.target.value); setDirty(true); }} placeholder={t('tpl.namePh')} maxLength={60} />
        {!initial?.builtin && <label className="dz-badgecolor" title={t('tpl.badgeColor')}>
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setDirty(true); }} />
          <span>{t('tpl.badgeColor')}</span>
        </label>}
        <div className="dz-top-sp" />
        <button type="button" className="icon-btn" onClick={doUndo} disabled={!undo.current.length} title="Undo (Ctrl+Z)"><Undo2 size={17} /></button>
        <button type="button" className="icon-btn" onClick={doRedo} disabled={!redo.current.length} title="Redo (Ctrl+Y)"><Redo2 size={17} /></button>
        <div className="dz-zoom">
          <button type="button" onClick={() => setZoom((z) => clamp(+(z - 0.1).toFixed(2), 0.6, 2.2))}><ZoomOut size={15} /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => clamp(+(z + 0.1).toFixed(2), 0.6, 2.2))}><ZoomIn size={15} /></button>
        </div>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || uploading}>
          {busy ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {t('common.save')}
        </button>
      </div>
      {error && <div className="dz-error">{error}</div>}

      <div className="dz-body">
        {/* ---------- left: add elements + layers ---------- */}
        <aside className="dz-left">
          <div className="dz-h">{t('tpl.add')}</div>
          <div className="dz-tools">
            <button type="button" onClick={() => add('text')}><Type size={18} /><span>{t('tpl.text')}</span></button>
            <button type="button" onClick={() => add('field')}><TextCursorInput size={18} /><span>{t('tpl.field')}</span></button>
            <button type="button" onClick={() => add('photo')}><UserSquare2 size={18} /><span>{t('tpl.k.photo')}</span></button>
            <button type="button" onClick={() => add('qr')}><QrCode size={18} /><span>{t('tpl.k.qr')}</span></button>
            <button type="button" onClick={() => pickImage(null)}><ImagePlus size={18} /><span>{t('tpl.k.image')}</span></button>
            <button type="button" onClick={() => add('logo')}><img src="/logo.png" alt="" width={20} height={20} /><span>{t('tpl.logo')}</span></button>
            <button type="button" onClick={() => add('rect')}><Square size={18} /><span>{t('tpl.rect')}</span></button>
            <button type="button" onClick={() => add('circle')}><Circle size={18} /><span>{t('tpl.circle')}</span></button>
            <button type="button" onClick={() => add('line')}><Minus size={18} /><span>{t('tpl.line')}</span></button>
            <button type="button" onClick={() => { add('strip'); }}><span className="dz-strip-ico" /><span>{t('tpl.strip')}</span></button>
          </div>

          <div className="dz-h"><Layers size={14} /> {t('tpl.layers')}</div>
          <ul className="dz-layers">
            {[...design.elements].reverse().map((e) => {
              const I = KIcon[e.kind] || Square;
              return (
                <li key={e.id} className={e.id === sel ? 'on' : ''} onClick={() => setSel(e.id)}>
                  <I size={14} />
                  <span>{kindLabel(e)}</span>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); move(e.id, 'up'); }} title={t('tpl.forward')}><ArrowUp size={13} /></button>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); move(e.id, 'down'); }} title={t('tpl.backward')}><ArrowDown size={13} /></button>
                </li>
              );
            })}
            {!design.elements.length && <li className="muted small">{t('tpl.noElements')}</li>}
          </ul>
        </aside>

        {/* ---------- centre: canvas ---------- */}
        <main className="dz-stage" onPointerDown={() => setSel(null)}>
          <div className="dz-canvas" style={{ width: CARD_W * zoom, height: CARD_H * zoom }}>
            <div className="dz-scale" style={{ transform: `scale(${zoom})` }}>
              <TemplateCard template={{ design }} staff={SAMPLE_STAFF} displayOnly />
              {/* interaction layer on top of the rendered card */}
              <div className="dz-hits">
                {design.elements.map((e) => (
                  <div
                    key={e.id}
                    className={`dz-hit ${e.id === sel ? 'on' : ''}`}
                    style={{ left: e.x, top: e.y, width: e.w, height: e.h, transform: e.rotate ? `rotate(${e.rotate}deg)` : undefined }}
                    onPointerDown={(ev) => startDrag(ev, e, 'move')}
                    onDoubleClick={() => e.kind === 'image' && pickImage(e.id)}
                  >
                    {e.id === sel &&
                      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => (
                        <i key={h} className={`dz-h-${h}`} style={{ '--z': zoom }} onPointerDown={(ev) => startDrag(ev, e, h)} />
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="dz-hint">{t('tpl.hint')}</div>
        </main>

        {/* ---------- right: properties ---------- */}
        <aside className="dz-right">
          <div className="dz-tabs">
            <button type="button" className={tab === 'props' ? 'on' : ''} onClick={() => setTab('props')}><Settings2 size={14} /> {selected ? t('tpl.element') : t('tpl.card')}</button>
          </div>

          {!selected && (
            <div className="dz-panel">
              <div className="dz-h">{t('tpl.layout')}</div>
              <div className="dz-layouts">
                {LAYOUTS.map((l) => (
                  <button
                    type="button"
                    key={l}
                    onClick={() => {
                      if (design.elements.length && !window.confirm(t('tpl.layoutConfirm'))) return;
                      // replaces the elements (background stays); Ctrl+Z restores the previous layout
                      change((d) => ({ ...d, elements: layoutElements(l, color) }));
                      setSel(null);
                    }}
                  >
                    <span className={`dz-lay dz-lay-${l}`} />
                    {t(`tpl.layout.${l}`)}
                  </button>
                ))}
              </div>
              <div className="dz-h">{t('tpl.background')}</div>
              <Color label={t('tpl.bgColor')} value={design.bgColor} onChange={(v) => patchDesign({ bgColor: v })} />
              <div className="dz-bg">
                <div className="dz-bg-prev" style={{ backgroundImage: design.bgAsset ? `url(${assetUrl(design.bgAsset)})` : 'none', backgroundColor: design.bgColor }} />
                <div className="dz-bg-btns">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => bgFile.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} {design.bgAsset ? t('tpl.changeBg') : t('tpl.uploadBg')}
                  </button>
                  {design.bgAsset && (
                    <button type="button" className="link-btn" onClick={() => patchDesign({ bgAsset: null })}>{t('tpl.removeBg')}</button>
                  )}
                </div>
              </div>
              <small className="hint">{t('tpl.bgHint')}</small>
              {design.bgAsset && (
                <>
                  <div className="dz-row">
                    <span className="dz-lbl">{t('tpl.fit')}</span>
                    <Seg value={design.bgFit || 'cover'} onChange={(v) => patchDesign({ bgFit: v })} items={[{ v: 'cover', label: t('tpl.fitCover') }, { v: 'contain', label: t('tpl.fitContain') }, { v: 'fill', label: t('tpl.fitFill') }]} />
                  </div>
                  <div className="dz-opacity">
                    <div className="dz-row">
                      <span className="dz-lbl">{t('tpl.bgOpacity')}</span>
                      <b>{Math.round((design.bgOpacity ?? 1) * 100)}%</b>
                    </div>
                    <input
                      type="range" min={0} max={100} step={1}
                      value={Math.round((design.bgOpacity ?? 1) * 100)}
                      onPointerDown={snapshot}
                      onChange={(e) => change((d) => ({ ...d, bgOpacity: Number(e.target.value) / 100 }), false)}
                    />
                    <div className="dz-presets">
                      {[100, 50, 25, 15, 10].map((p) => (
                        <button type="button" key={p} className={Math.round((design.bgOpacity ?? 1) * 100) === p ? 'on' : ''} onClick={() => patchDesign({ bgOpacity: p / 100 })}>
                          {p === 15 ? `${t('tpl.watermark')} 15%` : `${p}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="dz-h">{t('tpl.tips')}</div>
              <ul className="dz-tips">
                <li>{t('tpl.tip1')}</li>
                <li>{t('tpl.tip2')}</li>
                <li>{t('tpl.tip3')}</li>
              </ul>
            </div>
          )}

          {selected && (
            <div className="dz-panel">
              <div className="dz-el-head">
                <b>{kindLabel(selected)}</b>
                <div>
                  <button type="button" className="icon-btn sm" onClick={() => duplicate()} title={`${t('tpl.duplicate')} (Ctrl+D)`}><Copy size={15} /></button>
                  <button type="button" className="icon-btn sm danger" onClick={() => remove()} title={`${t('common.delete')} (Del)`}><Trash2 size={15} /></button>
                </div>
              </div>

              {selected.kind === 'field' && (
                <>
                  <label className="dz-field">
                    <span>{t('tpl.dataField')}</span>
                    <select value={selected.field} onChange={(e) => patchEl(selected.id, { field: e.target.value })}>
                      {FIELDS.map((f) => <option key={f} value={f}>{t(`tpl.f.${f}`)}</option>)}
                    </select>
                  </label>
                  <label className="dz-field">
                    <span>{t('tpl.prefix')}</span>
                    <input value={selected.prefix || ''} onChange={(e) => patchEl(selected.id, { prefix: e.target.value })} placeholder="Name" maxLength={40} />
                  </label>
                  <div className="dz-grid2">
                    <Num label={t('tpl.labelWidth')} value={selected.labelWidth || 0} min={0} max={200} onChange={(v) => patchEl(selected.id, { labelWidth: v })} />
                    <label className="dz-field">
                      <span>{t('tpl.sep')}</span>
                      <input value={selected.sep ?? ''} onChange={(e) => patchEl(selected.id, { sep: e.target.value })} placeholder=": " maxLength={6} />
                    </label>
                  </div>
                </>
              )}
              {selected.kind === 'text' && (
                <label className="dz-field">
                  <span>{t('tpl.text')}</span>
                  <textarea rows={2} value={selected.text || ''} onChange={(e) => patchEl(selected.id, { text: e.target.value })} maxLength={300} />
                </label>
              )}
              {selected.kind === 'image' && (
                <>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => pickImage(selected.id)} disabled={uploading}>
                    <Upload size={14} /> {t('tpl.replaceImage')}
                  </button>
                  <div className="dz-row">
                    <span className="dz-lbl">{t('tpl.fit')}</span>
                    <Seg value={selected.fit || 'contain'} onChange={(v) => patchEl(selected.id, { fit: v })} items={[{ v: 'contain', label: t('tpl.fitContain') }, { v: 'cover', label: t('tpl.fitCover') }, { v: 'fill', label: t('tpl.fitFill') }]} />
                  </div>
                </>
              )}

              {isText && (
                <>
                  <div className="dz-h">{t('tpl.textStyle')}</div>
                  <label className="dz-field">
                    <span>{t('tpl.font')}</span>
                    <select value={selected.fontFamily || FONTS[0].v} onChange={(e) => patchEl(selected.id, { fontFamily: e.target.value })}>
                      {FONTS.map((f) => <option key={f.label} value={f.v}>{f.label}</option>)}
                    </select>
                  </label>
                  <div className="dz-grid2">
                    <Num label={t('tpl.size')} value={selected.fontSize} min={6} max={120} onChange={(v) => patchEl(selected.id, { fontSize: v })} />
                    <Num label={t('tpl.spacing')} value={selected.letterSpacing || 0} min={-5} max={30} step={0.5} onChange={(v) => patchEl(selected.id, { letterSpacing: v })} />
                  </div>
                  <div className="dz-row">
                    <div className="dz-seg">
                      <button type="button" className={(selected.fontWeight || 400) >= 700 ? 'on' : ''} onClick={() => patchEl(selected.id, { fontWeight: (selected.fontWeight || 400) >= 700 ? 400 : 800 })} title="Bold"><Bold size={15} /></button>
                      <button type="button" className={selected.italic ? 'on' : ''} onClick={() => patchEl(selected.id, { italic: !selected.italic })} title="Italic"><Italic size={15} /></button>
                      <button type="button" className={selected.upper ? 'on' : ''} onClick={() => patchEl(selected.id, { upper: !selected.upper })} title="UPPERCASE"><CaseUpper size={15} /></button>
                    </div>
                    <Seg value={selected.align || 'left'} onChange={(v) => patchEl(selected.id, { align: v })} items={[{ v: 'left', icon: AlignLeft }, { v: 'center', icon: AlignCenter }, { v: 'right', icon: AlignRight }]} />
                  </div>
                  <div className="dz-row">
                    <span className="dz-lbl">{t('tpl.vAlign')}</span>
                    <Seg value={selected.vAlign || 'center'} onChange={(v) => patchEl(selected.id, { vAlign: v })} items={[{ v: 'top', icon: AlignStartVertical }, { v: 'center', icon: AlignCenterVertical }, { v: 'bottom', icon: AlignEndVertical }]} />
                  </div>
                  <Color label={t('tpl.textColor')} value={selected.color} onChange={(v) => patchEl(selected.id, { color: v })} />
                  <Color label={t('tpl.fill')} value={selected.bg} onChange={(v) => patchEl(selected.id, { bg: v })} allowNone />
                </>
              )}

              {selected.kind === 'shape' && <Color label={t('tpl.fill')} value={selected.fill} onChange={(v) => patchEl(selected.id, { fill: v })} />}

              {selected.kind === 'strip' && (
                <>
                  <div className="dz-row">
                    <span className="dz-lbl">{t('tpl.stripStyle')}</span>
                    <Seg
                      value={selected.style || 'house'}
                      onChange={(v) => patchEl(selected.id, v === 'letters' ? { style: v, fontSize: 64, w: Math.max(selected.w, 70), fill: selected.fill || '#2e7d32', gold: false, textColor: '#ffffff' } : { style: v, fontSize: 25, fill: '', gold: true })}
                      items={[{ v: 'house', label: t('tpl.stripHouse') }, { v: 'letters', label: t('tpl.stripLetters') }]}
                    />
                  </div>
                  {selected.style === 'letters' ? (
                    <label className="dz-field">
                      <span>{t('tpl.stripLettersText')}</span>
                      <input value={selected.letters ?? 'PRC'} onChange={(e) => patchEl(selected.id, { letters: e.target.value.toUpperCase() })} maxLength={8} />
                    </label>
                  ) : (
                    <>
                      <label className="dz-field">
                        <span>{t('tpl.stripKhmer')}</span>
                        <input value={selected.khmer ?? KHMER_BRAND} onChange={(e) => patchEl(selected.id, { khmer: e.target.value })} maxLength={60} />
                      </label>
                      <label className="dz-field">
                        <span>{t('tpl.stripEnglish')}</span>
                        <input value={selected.english ?? EN_BRAND} onChange={(e) => patchEl(selected.id, { english: e.target.value })} maxLength={60} />
                      </label>
                    </>
                  )}
                  <Color label={t('tpl.stripColor')} value={selected.fill} onChange={(v) => patchEl(selected.id, { fill: v })} allowNone />
                  {selected.style !== 'letters' && !selected.fill && <small className="hint">{t('tpl.stripDefault')}</small>}
                  <label className="dz-check">
                    <input type="checkbox" checked={selected.gold !== false} onChange={(e) => patchEl(selected.id, { gold: e.target.checked })} />
                    <span>{t('tpl.goldText')}</span>
                  </label>
                  {selected.gold === false && <Color label={t('tpl.textColor')} value={selected.textColor || '#ffffff'} onChange={(v) => patchEl(selected.id, { textColor: v })} />}
                  <Num label={t('tpl.size')} value={selected.fontSize || (selected.style === 'letters' ? 64 : 25)} min={8} max={120} onChange={(v) => patchEl(selected.id, { fontSize: v })} />
                </>
              )}

              {['shape', 'photo', 'image', 'qr', 'strip'].includes(selected.kind) && (
                <div className="dz-grid2">
                  <Num label={t('tpl.radius')} value={selected.radius || 0} min={0} max={999} onChange={(v) => patchEl(selected.id, { radius: v })} />
                  {!['qr', 'strip'].includes(selected.kind) && <Num label={t('tpl.border')} value={selected.borderWidth || 0} min={0} max={30} onChange={(v) => patchEl(selected.id, { borderWidth: v })} />}
                </div>
              )}
              {['shape', 'photo', 'image'].includes(selected.kind) && (selected.borderWidth || 0) > 0 && (
                <Color label={t('tpl.borderColor')} value={selected.borderColor} onChange={(v) => patchEl(selected.id, { borderColor: v })} />
              )}

              <div className="dz-h">{t('tpl.position')}</div>
              <div className="dz-grid2">
                <Num label="X" value={selected.x} onChange={(v) => patchEl(selected.id, { x: v })} />
                <Num label="Y" value={selected.y} onChange={(v) => patchEl(selected.id, { y: v })} />
                <Num label={t('tpl.width')} value={selected.w} min={2} onChange={(v) => patchEl(selected.id, { w: Math.max(2, v) })} />
                <Num label={t('tpl.height')} value={selected.h} min={2} onChange={(v) => patchEl(selected.id, { h: Math.max(2, v) })} />
                <Num label={t('tpl.rotate')} value={selected.rotate || 0} min={-180} max={180} suffix="°" onChange={(v) => patchEl(selected.id, { rotate: v })} />
                <Num label={t('tpl.opacity')} value={Math.round((selected.opacity ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(v) => patchEl(selected.id, { opacity: clamp(v, 0, 100) / 100 })} />
              </div>
              <div className="dz-row">
                <span className="dz-lbl">{t('tpl.alignCard')}</span>
                <div className="dz-seg">
                  <button type="button" onClick={() => alignEl('left')} title="Left"><AlignLeft size={15} /></button>
                  <button type="button" onClick={() => alignEl('hcenter')} title="Centre"><AlignCenter size={15} /></button>
                  <button type="button" onClick={() => alignEl('right')} title="Right"><AlignRight size={15} /></button>
                  <button type="button" onClick={() => alignEl('top')} title="Top"><AlignStartVertical size={15} /></button>
                  <button type="button" onClick={() => alignEl('vcenter')} title="Middle"><AlignCenterVertical size={15} /></button>
                  <button type="button" onClick={() => alignEl('bottom')} title="Bottom"><AlignEndVertical size={15} /></button>
                </div>
              </div>
              <div className="dz-row">
                <span className="dz-lbl">{t('tpl.order')}</span>
                <div className="dz-seg">
                  <button type="button" onClick={() => move(selected.id, 'top')}>{t('tpl.toFront')}</button>
                  <button type="button" onClick={() => move(selected.id, 'bottom')}>{t('tpl.toBack')}</button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <input ref={bgFile} type="file" accept="image/*" hidden onChange={onBg} />
      <input ref={imgFile} type="file" accept="image/*" hidden onChange={onImg} />
    </div>
  );
}
