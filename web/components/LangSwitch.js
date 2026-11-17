'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useI18n, LANGS } from '@/lib/i18n';

// Inline SVG flags (Windows does not render flag emoji)
const Flags = {
  th: (
    <svg viewBox="0 0 30 20" width="22" height="15" aria-hidden>
      <rect width="30" height="20" fill="#A51931" />
      <rect y="3.33" width="30" height="13.34" fill="#F4F5F8" />
      <rect y="6.67" width="30" height="6.66" fill="#2D2A4A" />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 60 30" width="22" height="15" aria-hidden>
      <clipPath id="uk-s"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
      <clipPath id="uk-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <g clipPath="url(#uk-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-t)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  ),
};

export default function LangSwitch({ dark = false }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className={`lang ${dark ? 'lang-dark' : ''}`} ref={ref}>
      <button type="button" className="lang-btn" onClick={() => setOpen((o) => !o)}>
        <span className="flag">{Flags[lang]}</span>
        <span className="lang-name">{t(`lang.${lang}`)}</span>
        <span className="lang-code">{lang.toUpperCase()}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <ul className="lang-menu">
          {LANGS.map((l) => (
            <li key={l} className={l === lang ? 'active' : ''} onClick={() => { setLang(l); setOpen(false); }}>
              <span className="flag">{Flags[l]}</span>
              {t(`lang.${l}`)}
              {l === lang && <Check size={14} className="ml-auto" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
