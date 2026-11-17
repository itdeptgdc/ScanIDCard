'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/** Custom dropdown with colour dots. options: [{ value, label, color? }] — color 'rainbow' = mixed dot. */
export default function Select({ value, onChange, options, placeholder = '', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const cur = options.find((o) => o.value === value);
  const dot = (c) => (c ? <span className={`dot ${c === 'rainbow' ? 'dot-rainbow' : ''}`} style={c !== 'rainbow' ? { background: c } : undefined} /> : null);

  return (
    <div className={`select ${open ? 'open' : ''} ${className}`} ref={ref}>
      <button type="button" className="select-btn" onClick={() => setOpen((o) => !o)}>
        {dot(cur?.color)}
        <span className="select-label">{cur ? cur.label : placeholder}</span>
        <ChevronDown size={16} className="chev" />
      </button>
      {open && (
        <ul className="select-menu">
          {options.map((o) => (
            <li key={o.value} className={o.value === value ? 'active' : ''} onClick={() => { onChange(o.value); setOpen(false); }}>
              {dot(o.color)}
              <span>{o.label}</span>
              {o.value === value && <Check size={15} className="ml-auto" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
