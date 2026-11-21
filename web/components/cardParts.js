'use client';
/** Pieces shared by the built-in card designs (IdCard) and custom templates (TemplateCard). */
import { useLayoutEffect, useRef } from 'react';

/**
 * One-line text that shrinks its font until the whole value fits — never cut off with "…".
 * Card scaling uses CSS transform, which doesn't affect these layout measurements.
 * If even the smallest size (min × normal size) is too wide, it wraps onto a second line.
 */
export function FitText({ children, min = 0.5, className = '', style }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const fit = () => {
      if (!alive || !el.isConnected) return;
      el.style.fontSize = '';
      el.style.whiteSpace = 'nowrap';
      const base = parseFloat(getComputedStyle(el).fontSize) || 12;
      let size = base;
      while (el.scrollWidth > el.clientWidth + 0.5 && size > base * min) {
        size = Math.max(base * min, size - 0.25);
        el.style.fontSize = `${size}px`;
      }
      if (el.scrollWidth > el.clientWidth + 0.5) {
        el.style.whiteSpace = 'normal';
        el.style.fontSize = `${base * 0.7}px`;
      }
    };
    fit();
    document.fonts?.ready?.then(fit); // re-measure once web fonts have loaded
    return () => {
      alive = false;
    };
  }, [children, min]);
  return (
    <span ref={ref} className={`fit-text ${className}`} style={style}>
      {children}
    </span>
  );
}

export function Photo({ staff, className = 'idc-photo', style }) {
  return (
    <div className={className} style={style}>
      {staff.has_photo ? (
        <img src={staff.photo_url || `/api/staff/${staff.id}/photo?v=${staff.photo_version}`} alt="" />
      ) : (
        <svg viewBox="0 0 100 120" className="idc-avatar" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <rect width="100" height="120" fill="#ece3ea" />
          <circle cx="50" cy="45" r="20" fill="#bba2b6" />
          <path d="M14 120c2-26 18-40 36-40s34 14 36 40z" fill="#bba2b6" />
        </svg>
      )}
    </div>
  );
}

export const Row = ({ k, v, className = '' }) => (
  <div className={`idc-row ${className}`}>
    <span className="k">{k}</span>
    <span className="sep">:</span>
    <FitText className="v">{v || "—"}</FitText>
  </div>
);

/**
 * Decorative QR look-alike (NOT scannable) for on-screen display at the kiosk, so a photo of
 * the screen can never be used as a valid card QR.
 */
export function DecorQr({ seed = '' }) {
  const n = 21;
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const cells = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (!finder(x, y) && !(x === 7 || y === 7 || x === n - 8 || y === n - 8) && rnd() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  const F = ({ x, y }) => (
    <g>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width="100%" height="100%" shapeRendering="crispEdges" aria-hidden>
      <rect width={n} height={n} fill="#fff" />
      <g fill="#111">
        <F x={0} y={0} />
        <F x={n - 7} y={0} />
        <F x={0} y={n - 7} />
        {cells}
      </g>
    </svg>
  );
}
