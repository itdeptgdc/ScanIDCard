'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Sun, Contrast, Undo2, Check, X, Move } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

// Frame = ID-card photo shape (5:6). Output 400 × 480 JPEG.
const FW = 300;
const FH = 360;
const OUT_W = 400;
const OUT_H = 480;

/**
 * Photo adjuster: drag to move, wheel / slider to zoom, rotate 90°, brightness & contrast.
 * src: data URL or same-origin URL. onApply(dataUrl) returns the cropped JPEG.
 */
export default function PhotoCropper({ src, onApply, onCancel }) {
  const { t } = useI18n();
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [bright, setBright] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [error, setError] = useState(false);
  const drag = useRef(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setError(true);
    i.src = src;
  }, [src]);

  // Esc closes only the cropper (capture phase, before the staff modal sees it)
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onCancel]);

  const swap = rot % 180 !== 0;
  const iw = img ? (swap ? img.naturalHeight : img.naturalWidth) : 1;
  const ih = img ? (swap ? img.naturalWidth : img.naturalHeight) : 1;
  const base = Math.max(FW / iw, FH / ih); // "cover" the frame at zoom 1
  const scale = base * zoom;

  const clamp = (o, z = zoom) => {
    const s = base * z;
    const mx = Math.max(0, (iw * s - FW) / 2);
    const my = Math.max(0, (ih * s - FH) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  };

  const setZoomC = (z) => {
    const nz = Math.min(5, Math.max(1, z));
    setZoom(nz);
    setOff((o) => clamp(o, nz));
  };

  // re-clamp after rotation changes the image bounds
  useEffect(() => {
    setOff((o) => clamp(o));
  }, [rot, img]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, o: off };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const d = drag.current;
    setOff(clamp({ x: d.o.x + e.clientX - d.x, y: d.o.y + e.clientY - d.y }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e) => setZoomC(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));

  const filter = `brightness(${bright}%) contrast(${contrast}%)`;

  function reset() {
    setZoom(1);
    setRot(0);
    setOff({ x: 0, y: 0 });
    setBright(100);
    setContrast(100);
  }

  function apply() {
    if (!img) return;
    const k = OUT_W / FW;
    const c = document.createElement('canvas');
    c.width = OUT_W;
    c.height = OUT_H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.filter = filter;
    ctx.translate(OUT_W / 2 + off.x * k, OUT_H / 2 + off.y * k);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(scale * k, scale * k);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    onApply(c.toDataURL('image/jpeg', 0.9));
  }

  return createPortal(
    <div className="crop-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="crop-modal" role="dialog" aria-modal="true">
        <div className="crop-head">
          <h3 className="modal-title">{t('crop.title')}</h3>
          <button className="icon-btn" onClick={onCancel} aria-label="close"><X size={16} /></button>
        </div>

        <div className="crop-body">
          <div
            className="crop-frame"
            style={{ width: FW, height: FH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {img && (
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) rotate(${rot}deg) scale(${scale})`,
                  filter,
                }}
              />
            )}
            {!img && !error && <div className="spinner" style={{ margin: 'auto' }} />}
            {error && <div className="muted small" style={{ margin: 'auto' }}>{t('err.PHOTO_INVALID')}</div>}
            <div className="crop-guides" aria-hidden>
              <i /><i /><i /><i />
              <div className="crop-face" />
            </div>
          </div>

          <div className="crop-controls">
            <div className="crop-hint"><Move size={15} /> {t('crop.hint')}</div>

            <label className="crop-row">
              <span><ZoomIn size={15} /> {t('crop.zoom')}</span>
              <div className="crop-slider">
                <button type="button" className="icon-btn sm" onClick={() => setZoomC(zoom / 1.15)}><ZoomOut size={14} /></button>
                <input type="range" min="1" max="5" step="0.01" value={zoom} onChange={(e) => setZoomC(Number(e.target.value))} />
                <button type="button" className="icon-btn sm" onClick={() => setZoomC(zoom * 1.15)}><ZoomIn size={14} /></button>
              </div>
            </label>

            <div className="crop-row">
              <span><RotateCw size={15} /> {t('crop.rotate')}</span>
              <div className="crop-btns">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setRot((r) => (r + 270) % 360)}><RotateCcw size={15} /> 90°</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setRot((r) => (r + 90) % 360)}><RotateCw size={15} /> 90°</button>
              </div>
            </div>

            <label className="crop-row">
              <span><Sun size={15} /> {t('crop.brightness')} <em>{bright}%</em></span>
              <input type="range" min="50" max="160" value={bright} onChange={(e) => setBright(Number(e.target.value))} />
            </label>

            <label className="crop-row">
              <span><Contrast size={15} /> {t('crop.contrast')} <em>{contrast}%</em></span>
              <input type="range" min="50" max="160" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
            </label>

            <button type="button" className="link-btn crop-reset" onClick={reset}><Undo2 size={14} /> {t('crop.reset')}</button>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn-soft" onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" onClick={apply} disabled={!img}><Check size={16} /> {t('crop.apply')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
