/**
 * Editable copies of the built-in card artwork (components/IdCard.js), expressed as designer elements
 * (see components/TemplateCard.js). Used as the starting point when a built-in card is edited the first time.
 * Card = 300 × 478 px. PRC cards: 78 px letter band on the left, body centred at x = 189.
 */
import { layoutElements } from '@/app/dashboard/card-templates/CardDesigner';

const uid = () => Math.random().toString(36).slice(2, 9);
const NAVY = '#1a237e';
const el = (o) => ({ id: uid(), ...o });

// ---------- Staff / Casino Staff (plum strip, logo, photo, details, HR sign + QR, faded logo) ----------
function houseDesign(type) {
  const base = layoutElements('strip', '#4d0a40');
  const watermark = el({ kind: 'image', asset: 'logo', x: -54, y: 205, w: 320, h: 250, fit: 'contain', radius: 0, opacity: 0.11 });
  const extra =
    type === 'staff'
      ? [el({ kind: 'shape', x: 286, y: 78, w: 14, h: 130, fill: '#e53935', radius: 0 })]
      : [el({ kind: 'text', x: 74, y: 371, w: 218, h: 19, text: 'KHT-006  Type: ...............', fontSize: 12.5, fontWeight: 600, color: NAVY, align: 'left' })];
  // watermark first so everything else draws on top of it
  return [watermark, ...base, ...extra];
}

// ---------- PRC cards: Vendor / Tenant / Contractor / Visitor ----------
const PRC = {
  vendor: { band: '#2e7d32', letters: '#ffffff', gold: false, wm: 'V', wmColor: '#2e7d3224', photo: '#2e7d32' },
  tenant: { band: NAVY, letters: '#ffffff', gold: true, wm: 'T', wmColor: '#1a237e1a', photo: NAVY },
  contractor: { band: '#ede300', letters: '#111111', gold: false, wm: 'C', wmColor: '#ede30038', photo: '#e4d800' },
  visitor: { band: '#e53935', letters: '#ffffff', gold: false, wm: 'G', wmColor: '#ff704338', photo: NAVY },
};

const row = (field, label, y) =>
  el({ kind: 'field', field, prefix: label, labelWidth: 52, sep: ': ', x: 92, y, w: 196, h: 20, fontSize: 14, fontWeight: 700, color: NAVY, vAlign: 'center' });

function prcDesign(type) {
  const c = PRC[type];
  const els = [
    el({ kind: 'strip', style: 'letters', letters: 'PRC', x: 0, y: 0, w: 78, h: 478, fill: c.band, gold: c.gold, textColor: c.letters, fontSize: 64, radius: 0 }),
    el({ kind: 'text', x: 78, y: type === 'visitor' ? 120 : 100, w: 222, h: 260, text: c.wm, fontSize: 260, fontWeight: 900, lineHeight: 1, color: c.wmColor, align: 'center', vAlign: 'top' }),
  ];

  if (type === 'visitor') {
    els.push(
      el({ kind: 'text', x: 84, y: 36, w: 210, h: 58, text: 'Visitor', fontSize: 46, fontWeight: 800, color: NAVY, align: 'center' }),
      el({ kind: 'qr', x: 137, y: 216, w: 104, h: 104 }),
      el({ kind: 'field', field: 'id_number', prefix: 'No : ', x: 84, y: 428, w: 210, h: 34, fontSize: 24, fontWeight: 800, color: NAVY, align: 'center' })
    );
    return els;
  }

  els.push(
    el({ kind: 'field', field: 'name', prefix: 'Name : ', x: 84, y: 20, w: 210, h: 22, fontSize: 15, fontWeight: 700, color: NAVY, align: 'center', upper: true }),
    el({ kind: 'photo', x: 130, y: 52, w: 118, h: 140, radius: 0, borderColor: c.photo, borderWidth: 3 })
  );

  let qrY = 290;
  if (type === 'vendor') {
    els.push(
      el({ kind: 'field', field: 'company', x: 84, y: 204, w: 210, h: 24, fontSize: 16, fontWeight: 800, color: NAVY, align: 'center', upper: true }),
      el({ kind: 'field', field: 'id_number', prefix: 'ID.No', sep: ' : ', x: 84, y: 232, w: 210, h: 20, fontSize: 14, fontWeight: 700, color: NAVY, align: 'center' })
    );
    qrY = 264;
  } else if (type === 'tenant') {
    els.push(row('position', 'Post.', 206), row('id_number', 'ID.No', 227), row('passport', 'PP.No', 248));
  } else {
    els.push(row('company', 'Com.', 206), row('position', 'Post.', 227), row('id_number', 'ID.No', 248));
  }

  els.push(
    el({ kind: 'qr', x: 137, y: qrY, w: 104, h: 104 }),
    // "Exp:" pill
    el({ kind: 'shape', x: 134, y: 446, w: 110, h: 20, fill: '#ffffff', radius: 99, borderColor: NAVY, borderWidth: 1 }),
    el({ kind: 'field', field: 'card_expiry', prefix: 'Exp: ', x: 134, y: 446, w: 110, h: 20, fontSize: 11, fontWeight: 700, color: NAVY, align: 'center' })
  );
  return els;
}

/** Starting design for editing a built-in card type. */
export function builtinDesign(type) {
  const elements = type === 'staff' || type === 'casino_staff' ? houseDesign(type) : PRC[type] ? prcDesign(type) : layoutElements('strip');
  return { bgColor: '#ffffff', bgAsset: null, bgFit: 'cover', bgOpacity: 1, elements };
}
