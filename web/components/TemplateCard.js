'use client';
/**
 * Renders a custom card template (designed in Dashboard → Card templates).
 *
 * design = {
 *   bgColor: '#ffffff', bgAsset: <asset id> | null, bgFit: 'cover' | 'contain' | 'fill',
 *   elements: [ { id, kind, x, y, w, h, rotate, opacity, ...kind props } ]   // later elements are drawn on top
 * }
 * Coordinates are px on the 300 × 478 card (CR80 portrait, same size as the built-in designs).
 *
 * kinds:
 *   text   { text, fontSize, fontWeight, color, align, vAlign, fontFamily, italic, upper, letterSpacing, lineHeight, bg }
 *   field  { field, prefix, ...text style }        -> staff data (name, id_number, ...)
 *   photo  { radius, borderColor, borderWidth }
 *   qr     { }                                      -> real signed QR (print) / decorative pattern (kiosk)
 *   image  { asset, fit, radius }
 *   shape  { fill, radius, borderColor, borderWidth }
 */
import { cardDate } from '@/lib/format';
import { Photo, DecorQr, FitText } from './cardParts';
import { LOGO_SRC } from './Logo';
import { KHMER_BRAND, EN_BRAND } from '@/lib/cardTypes';

// gold lettering, same gradient as the built-in Tenant card
const GOLD_TEXT = { background: 'linear-gradient(180deg, #f7dc8f, #c99a3a 55%, #8f6a1f)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };

export const CARD_W = 300;
export const CARD_H = 478;

export const FIELDS = ['name', 'position', 'department', 'company', 'id_number', 'card_number', 'passport', 'hire_date', 'card_expiry'];
export const FONTS = [
  { v: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { v: "'Arial Black', Arial, sans-serif", label: 'Arial Black' },
  { v: 'Georgia, serif', label: 'Georgia' },
  { v: "'Times New Roman', serif", label: 'Times' },
  { v: "'Courier New', monospace", label: 'Courier' },
  { v: 'Tahoma, sans-serif', label: 'Tahoma' },
  { v: "'Trebuchet MS', sans-serif", label: 'Trebuchet' },
  { v: 'Impact, sans-serif', label: 'Impact' },
];

/** asset id -> URL. 'logo' = the resort logo shipped with the app (no upload needed). */
export const assetUrl = (id) => (id === 'logo' ? LOGO_SRC : `/api/card-templates/assets/${id}`);

export function fieldValue(staff, f) {
  const v = staff?.[f];
  if (!v) return '';
  if (f === 'hire_date' || f === 'card_expiry') return cardDate(v);
  return String(v);
}

function textStyle(e) {
  return {
    display: 'flex',
    alignItems: e.vAlign === 'top' ? 'flex-start' : e.vAlign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: e.align === 'center' ? 'center' : e.align === 'right' ? 'flex-end' : 'flex-start',
    textAlign: e.align || 'left',
    fontSize: e.fontSize || 16,
    fontWeight: e.fontWeight || 400,
    fontStyle: e.italic ? 'italic' : 'normal',
    fontFamily: e.fontFamily || FONTS[0].v,
    textTransform: e.upper ? 'uppercase' : 'none',
    letterSpacing: e.letterSpacing ? `${e.letterSpacing}px` : undefined,
    lineHeight: e.lineHeight || 1.2,
    color: e.color || '#1a237e',
    background: e.bg || 'transparent',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
  };
}

function Element({ e, staff, qr, displayOnly }) {
  const box = {
    position: 'absolute',
    left: e.x,
    top: e.y,
    width: e.w,
    height: e.h,
    transform: e.rotate ? `rotate(${e.rotate}deg)` : undefined,
    opacity: e.opacity ?? 1,
  };
  const border = e.borderWidth ? `${e.borderWidth}px solid ${e.borderColor || '#000'}` : undefined;

  switch (e.kind) {
    case 'text':
      return <div style={{ ...box, ...textStyle(e) }}>{e.text}</div>;
    case 'field':
      return (
        <div style={{ ...box, ...textStyle(e) }}>
          {e.labelWidth ? (
            // fixed label column so the ':' of several rows line up (like the built-in cards)
            <span style={{ display: 'flex', width: '100%', minWidth: 0, justifyContent: 'inherit' }}>
              <span style={{ flex: 'none', width: e.labelWidth }}>{e.prefix || ''}</span>
              <span style={{ flex: 'none' }}>{e.sep ?? ''}</span>
              <FitText>{fieldValue(staff, e.field) || '—'}</FitText>
            </span>
          ) : (
            <>
              {e.prefix || ''}
              {e.sep ?? ''}
              {fieldValue(staff, e.field) || (e.prefix ? '—' : '')}
            </>
          )}
        </div>
      );
    case 'photo':
      return <Photo staff={staff} className="tc-photo" style={{ ...box, borderRadius: e.radius || 0, border }} />;
    case 'qr':
      return (
        <div className="tc-qr" style={{ ...box, borderRadius: e.radius || 0 }}>
          {displayOnly ? <DecorQr seed={staff?.id_number} /> : qr ? <img src={qr} alt="QR" /> : <DecorQr seed={staff?.id_number} />}
        </div>
      );
    case 'image':
      return e.asset ? (
        <img src={assetUrl(e.asset)} alt="" style={{ ...box, objectFit: e.fit || 'contain', borderRadius: e.radius || 0, border }} draggable={false} />
      ) : (
        <div style={{ ...box, background: 'repeating-linear-gradient(45deg,#eee,#eee 6px,#ddd 6px,#ddd 12px)' }} />
      );
    case 'shape':
      return <div style={{ ...box, background: e.fill || '#4d0a40', borderRadius: e.radius || 0, border }} />;
    case 'strip': {
      // coloured side strip with the same lettering as the built-in cards
      const gold = e.gold !== false;
      const ink = gold ? GOLD_TEXT : { color: e.textColor || '#ffffff' };
      if (e.style === 'letters') {
        const letters = String(e.letters ?? 'PRC').replace(/\s+/g, '').split('').slice(0, 8);
        return (
          <div style={{ ...box, background: e.fill || '#2e7d32', borderRadius: e.radius || 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {letters.map((ch, i) => (
              <span key={i} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: e.fontSize || 64, fontWeight: 900, lineHeight: 1.12, ...ink }}>{ch}</span>
            ))}
          </div>
        );
      }
      return (
        <div style={{ ...box, background: e.fill || 'linear-gradient(180deg, #5a0c4b 0%, #48083c 60%, #3d0533 100%)', borderRadius: e.radius || 0, overflow: 'hidden' }}>
          <div className="idc-vtext">
            {e.khmer !== '' && <span className="km" style={{ fontSize: e.fontSize || 25, ...(gold ? { color: '#e9c46a' } : ink) }}>{e.khmer ?? KHMER_BRAND}</span>}
            {e.english !== '' && <span className="en" style={{ fontSize: Math.round((e.fontSize || 25) * 0.6), ...(gold ? { color: '#e9c46a' } : ink) }}>{e.english ?? EN_BRAND}</span>}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

export default function TemplateCard({ template, staff, qr = null, displayOnly = false }) {
  const d = template?.design || {};
  // background image on its own layer so it can be faded (watermark look) without fading the colour or elements
  const bgImg = d.bgAsset
    ? {
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${assetUrl(d.bgAsset)})`,
        backgroundSize: d.bgFit === 'contain' ? 'contain' : d.bgFit === 'fill' ? '100% 100%' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: d.bgOpacity ?? 1,
      }
    : null;
  return (
    <div className="idcard idc-custom" style={{ backgroundColor: d.bgColor || '#ffffff' }}>
      {bgImg && <div className="tc-bg" style={bgImg} aria-hidden />}
      {(d.elements || []).map((e) => (
        <Element key={e.id} e={e} staff={staff} qr={qr} displayOnly={displayOnly} />
      ))}
    </div>
  );
}
