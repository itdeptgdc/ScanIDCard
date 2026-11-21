'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { cardDate } from '@/lib/format';
import { KHMER_BRAND, EN_BRAND, useCardTypes } from '@/lib/cardTypes';
import { LOGO_SRC } from './Logo';
import { Photo, Row, DecorQr } from './cardParts';
import TemplateCard from './TemplateCard';

const WATERMARK = { vendor: 'V', tenant: 'T', visitor: 'G', contractor: 'C' };

/**
 * Card artwork matching the printed templates. Size: CR80 portrait (54 × 86 mm).
 * displayOnly: kiosk view — no real QR is fetched (decorative pattern instead).
 */
export default function IdCard({ staff, displayOnly = false }) {
  const [qr, setQr] = useState(null);
  const ct = useCardTypes();

  useEffect(() => {
    if (displayOnly || !staff.id) return undefined;
    let alive = true;
    api(`/staff/${staff.id}/qr`)
      .then(({ payload }) => QRCode.toDataURL(payload, { margin: 1, width: 240, errorCorrectionLevel: 'M' }))
      .then((url) => alive && setQr(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [staff.id, staff.id_number, staff.card_number, displayOnly]);

  const type = staff.card_type;

  // custom template designed in the dashboard
  if (String(type).startsWith('tpl_')) {
    const tpl = ct.template(type);
    return tpl ? <TemplateCard template={tpl} staff={staff} qr={qr} displayOnly={displayOnly} /> : <div className="idcard idc-custom" />;
  }

  // built-in type whose design was edited in Card templates
  const override = ct.override(type);
  if (override) return <TemplateCard template={override} staff={staff} qr={qr} displayOnly={displayOnly} />;

  const qrBox = (
    <div className="idc-qr">
      {displayOnly ? <DecorQr seed={staff.id_number} /> : qr ? <img src={qr} alt="QR" /> : <div className="idc-qr-ph" />}
    </div>
  );

  if (type === 'staff' || type === 'casino_staff') {
    return (
      <div className={`idcard idc-house idc-${type}`}>
        <div className="idc-hband">
          <div className="idc-vtext">
            <span className="km">{KHMER_BRAND}</span>
            <span className="en">{EN_BRAND}</span>
          </div>
        </div>
        <div className="idc-hbody">
          <img className="idc-wm-logo" src={LOGO_SRC} alt="" aria-hidden />
          <img className="idc-logo" src={LOGO_SRC} alt="" />
          <Photo staff={staff} />
          <div className="idc-table">
            <Row k="Name" v={staff.name} />
            <Row k="Post." v={staff.position} />
            <Row k="Dept." v={staff.department} className="dept" />
            <Row k="ID.No" v={staff.id_number} />
            <Row k="H.date" v={staff.hire_date ? cardDate(staff.hire_date) : ''} />
            {type === 'casino_staff' && <Row k="KHT-006" v="Type: ..............." className="kht" />}
          </div>
          <div className="idc-foot">
            <div className="idc-sign">HR.Manager</div>
            {qrBox}
          </div>
        </div>
        {type === 'staff' && <div className="idc-strip" />}
      </div>
    );
  }

  return (
    <div className={`idcard idc-prc idc-${type}`}>
      <div className="idc-band">
        <span>P</span>
        <span>R</span>
        <span>C</span>
      </div>
      <div className="idc-body">
        <div className="idc-wm" aria-hidden>{WATERMARK[type]}</div>
        {type === 'visitor' ? (
          <div className="idc-visitor-title">Visitor</div>
        ) : (
          <div className="idc-name">
            Name : <b>{staff.name || '—'}</b>
          </div>
        )}
        {type !== 'visitor' && <Photo staff={staff} />}
        {/* Vendor template: company name (no label) + ID.No */}
        {type === 'vendor' && <div className="idc-company">{staff.company || staff.position || '—'}</div>}
        {type !== 'visitor' && (
          <div className="idc-fields">
            {type === 'contractor' && <Row k="Com." v={staff.company} />}
            {(type === 'tenant' || type === 'contractor') && <Row k="Post." v={staff.position} />}
            <Row k="ID.No" v={staff.id_number} />
            {type === 'tenant' && <Row k="PP.No" v={staff.passport} />}
          </div>
        )}
        {qrBox}
        {type === 'visitor' ? (
          <div className="idc-visitor-no">No : {staff.id_number}</div>
        ) : (
          <div className="idc-exp">Exp: {staff.card_expiry ? cardDate(staff.card_expiry) : '—'}</div>
        )}
      </div>
    </div>
  );
}
