'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera, CameraOff, ScanLine, ShieldCheck, Radio, LogOut, LayoutDashboard, KeyRound, Sun, Moon,
  Volume2, VolumeX, RefreshCw, Lock, X, SwitchCamera, ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n, DICT } from '@/lib/i18n';
import { TZ } from '@/lib/format';
import Logo from '@/components/Logo';
import LangSwitch from '@/components/LangSwitch';
import CameraScanner from '@/components/CameraScanner';
import IdCard from '@/components/IdCard';

import { announce, preload, unlock, isLocked, onStateChange } from '@/lib/sound';

const RESULT_MS = { success: 3000, warn: 3000, error: 3800 };
const DEDUPE_MS = { camera: 4000, reader: 1200, manual: 800 };
const both = (k) => [DICT.th[k] ?? k, DICT.en[k] ?? k];

const toCard = (s) => ({
  id: s.id,
  id_number: s.idNumber,
  name: s.name,
  position: s.position,
  department: s.department,
  company: s.company,
  passport: s.passport,
  card_type: s.cardType,
  hire_date: s.hireDate,
  card_expiry: s.cardExpiry,
  has_photo: s.hasPhoto,
  photo_version: s.photoVersion,
});

function ResultIcon({ kind }) {
  return (
    <svg className="res-icon" viewBox="0 0 52 52">
      <circle className="ri-circle" cx="26" cy="26" r="24" />
      {kind === 'success' && <path className="ri-path" d="M15 27 l7 7 l15 -16" />}
      {kind === 'warn' && <path className="ri-path" d="M26 14 v13 l8 5" />}
      {kind === 'error' && <path className="ri-path" d="M17 17 l18 18 M35 17 l-18 18" />}
    </svg>
  );
}

/** Result panel docked beside the live camera — never covers the scanner, so the next card can be scanned right away */
function BigResult({ r, locale, onClose }) {
  if (!r) {
    const [readyTh, readyEn] = both('scan.ready');
    return (
      <div className="bigres bigres-idle">
        <div className="bigres-ready">
          <ScanLine size={64} />
          <div className="bigres-title">{readyTh}</div>
          <div className="bigres-title-en">{readyEn}</div>
        </div>
      </div>
    );
  }
  const [titleTh, titleEn] = r.kind === 'success' ? both('scan.success') : r.kind === 'warn' ? both('scan.warn') : both('scan.failed');
  const [msgTh, msgEn] = r.ok ? both(`scan.${r.action}`) : both(`err.${r.code}`);
  return (
    <div className={`bigres bigres-${r.kind}`} onClick={onClose}>
      <div className="bigres-glow" />
      <div className="bigres-inner">
        {r.staff && (
          <div className="bigres-card">
            <IdCard staff={toCard(r.staff)} displayOnly />
            {!r.ok && (
              <div className="bigres-stamp">
                <Lock size={22} /> {DICT.en[`err.${r.code}`] ? r.code.replace('_', ' ') : 'DENIED'}
              </div>
            )}
          </div>
        )}
        {/* beside the card: only the animated status badge (success), plus the reason for duplicate / error */}
        <div className="bigres-text bigres-only">
          <div className={`res-anim res-anim-${r.kind}`}>
            <i className="ra-wave w1" />
            <i className="ra-wave w2" />
            <i className="ra-wave w3" />
            {r.kind === 'success' && (
              <span className="ra-sparks">
                {Array.from({ length: 8 }).map((_, i) => <b key={i} style={{ '--a': `${i * 45}deg` }} />)}
              </span>
            )}
            <ResultIcon kind={r.kind} />
          </div>
          <div className="bigres-title">{titleTh}</div>
          <div className="bigres-title-en">{titleEn}</div>
          {r.kind !== 'success' && (
            <>
              <div className="bigres-msg">{msgTh}</div>
              <div className="bigres-msg-en">{msgEn}</div>
            </>
          )}
          {!r.staff && r.raw && <div className="bigres-raw mono">{r.raw}</div>}
        </div>
      </div>
      <div className="result-timer" style={{ animationDuration: `${RESULT_MS[r.kind]}ms` }} />
    </div>
  );
}

const store = {
  get: (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : v;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

export default function ScanPage() {
  const { t, locale, lang } = useI18n();
  const langRef = useRef(lang);
  langRef.current = lang;
  const [me, setMe] = useState(null);
  const [now, setNow] = useState(null);
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false); // scanning window
  const [camOn, setCamOn] = useState(false); // camera running inside the window
  const camPref = useRef(true); // user's ON/OFF choice (OFF when a Bluetooth / USB scanner device is used)
  const [camErr, setCamErr] = useState('');
  const [camKey, setCamKey] = useState(0);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [voice, setVoice] = useState(true);
  const [soundLocked, setSoundLocked] = useState(false);
  const [focused, setFocused] = useState(false);
  const [httpsUrl, setHttpsUrl] = useState('');

  const inputRef = useRef(null);
  const lastScan = useRef({ code: '', at: 0 });
  const clearTimer = useRef(null);
  const keyTimes = useRef([]);
  const touchRef = useRef(false);
  const voiceRef = useRef(true);
  voiceRef.current = voice;

  useEffect(() => {
    api('/auth/me').then(setMe).catch(() => {});
    // restore kiosk preferences: scanner window left open, chosen camera, voice
    setVoice(store.get('scan.voice', '1') === '1');
    setDeviceId(store.get('scan.camera', ''));
    camPref.current = store.get('scan.cam', '1') === '1';
    if (store.get('scan.open', '0') === '1') setOpen(true);
    if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setHttpsUrl(`https://${location.hostname}/scan`);
    }
  }, []);

  // sound: preload clips, unlock audio on the first tap / key (card reader counts), show a hint while locked
  useEffect(() => {
    preload();
    const update = () => setSoundLocked(isLocked());
    const off = onStateChange(update);
    const gesture = () => {
      unlock();
      setTimeout(update, 150);
    };
    window.addEventListener('pointerdown', gesture, true);
    window.addEventListener('keydown', gesture, true);
    unlock(); // works immediately if the browser already allows autoplay for this site
    const id = setTimeout(update, 600);
    return () => {
      off();
      clearTimeout(id);
      window.removeEventListener('pointerdown', gesture, true);
      window.removeEventListener('keydown', gesture, true);
    };
  }, []);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // keep the input focused so a USB card reader always types into it (also while the window is closed).
  // Phones / tablets (touch screen) are skipped: focusing would keep popping up the on-screen keyboard.
  useEffect(() => {
    touchRef.current = window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(pointer: fine)').matches;
    if (touchRef.current) return;
    const id = setInterval(() => {
      const a = document.activeElement;
      if (!a || a === document.body || !a.isConnected) inputRef.current?.focus();
    }, 400);
    return () => clearInterval(id);
  }, []);

  // the input element changes when the window opens / closes: refocus it, lock page scroll while open
  useEffect(() => {
    if (!touchRef.current) setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    // however the window was opened (button, card-reader tap, page reload) the camera starts with it,
    // unless the user switched the camera OFF (scanner device connected)
    setCamErr('');
    setCamOn(camPref.current);
    setCamKey((k) => k + 1);
    store.set('scan.open', '1');
    const esc = (e) => e.key === 'Escape' && closeScanner();
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function openScanner() {
    setOpen(true); // camera is started by the [open] effect above
  }

  function closeScanner() {
    setOpen(false);
    setCamOn(false);
    setCamErr('');
    setResult(null);
    clearTimeout(clearTimer.current);
    store.set('scan.open', '0');
  }

  const show = useCallback((r, raw) => {
    const kind = r.ok ? (r.action === 'duplicate' ? 'warn' : 'success') : 'error';
    announce(r.ok ? r.action : r.code, kind, { voice: voiceRef.current, lang: langRef.current });
    setResult({ ...r, raw, kind, key: Date.now() + Math.random() });
    setOpen(true); // a card-reader tap while the window is closed opens it to show the ID card
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setResult(null), RESULT_MS[kind]);
  }, []);

  const submit = useCallback(
    async (raw, method) => {
      const c = String(raw || '').trim();
      if (!c) return;
      const n = Date.now();
      if (lastScan.current.code === c && n - lastScan.current.at < (DEDUPE_MS[method] || 1000)) return;
      lastScan.current = { code: c, at: n };
      try {
        const r = await api('/scan', { method: 'POST', body: { code: c, method } });
        setCount((x) => x + 1);
        show(r, c);
      } catch (e) {
        show({ ok: false, code: e.code === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'NETWORK' }, c);
      }
    },
    [show]
  );

  // card reader = keystrokes < 35 ms apart; a person typing is slower
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const times = keyTimes.current;
      let method = 'manual';
      if (times.length >= 4) {
        const gaps = times.slice(1).map((v, i) => v - times[i]);
        if (gaps.reduce((a, b) => a + b, 0) / gaps.length < 35) method = 'reader';
      }
      keyTimes.current = [];
      const v = code;
      setCode('');
      submit(v, /^PRC1\./i.test(v.trim()) && method === 'reader' ? 'camera' : method);
    } else if (e.key.length === 1) {
      keyTimes.current.push(performance.now());
    }
  };

  // card reader on ANY device: if no text box has focus (phones / tablets never auto-focus, to avoid the
  // on-screen keyboard), catch the reader's fast keystrokes page-wide and submit on Enter.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    let buf = '';
    let last = 0;
    let gaps = [];
    const onKey = (e) => {
      const el = e.target;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = performance.now();
      if (e.key === 'Enter') {
        const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 999;
        const v = buf.trim();
        buf = '';
        gaps = [];
        if (v.length >= 4 && avg < 60) {
          e.preventDefault();
          submitRef.current(v, /^PRC1\./i.test(v) ? 'camera' : 'reader');
        }
        return;
      }
      if (e.key.length !== 1) return;
      if (n - last > 120) {
        buf = '';
        gaps = [];
      } else if (buf) {
        gaps.push(n - last);
      }
      last = n;
      buf += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onCamError(e) {
    if (e === 'ENDED') {
      // camera unplugged / sleep: reconnect automatically
      setCamErr(t('cam.ENDED'));
      setTimeout(() => {
        setCamErr('');
        setCamKey((k) => k + 1);
      }, 1500);
      return;
    }
    // keep the window open: the card reader and manual entry still work
    setCamErr(t(`cam.${e}`));
    setCamOn(false);
  }

  function retryCam() {
    camPref.current = true;
    store.set('scan.cam', '1');
    setCamErr('');
    setCamOn(true);
    setCamKey((k) => k + 1);
  }

  /** Camera ON/OFF: OFF frees the phone camera when a Bluetooth / USB scanner device does the scanning */
  function toggleCam() {
    if (camOn) {
      camPref.current = false;
      store.set('scan.cam', '0');
      setCamErr('');
      setCamOn(false);
    } else {
      retryCam();
    }
  }

  /** Friendly camera names: "camera2 1, facing back" -> "Back camera", USB webcams keep their own name. */
  function camName(label, i) {
    const l = String(label || '').toLowerCase();
    const side = /back|rear|environment/.test(l) ? 'back' : /front|user|face/.test(l) ? 'front' : null;
    if (!side) return label || `${t('scan.camera')} ${i + 1}`;
    const same = devices.filter((d) => (/back|rear|environment/.test(d.label.toLowerCase()) ? 'back' : /front|user|face/.test(d.label.toLowerCase()) ? 'front' : null) === side);
    const n = same.findIndex((d) => d.label === label);
    return t(side === 'back' ? 'scan.camBack' : 'scan.camFront') + (same.length > 1 ? ` ${n + 1}` : '');
  }

  function chooseCamera(id) {
    setDeviceId(id);
    store.set('scan.camera', id);
  }

  function toggleVoice() {
    setVoice((v) => {
      store.set('scan.voice', v ? '0' : '1');
      if (!v) announce('check_in', 'success', { lang: langRef.current }); // test sound when turning voice on
      return !v;
    });
  }

  function enableSound(e) {
    e.stopPropagation();
    unlock();
    setTimeout(() => setSoundLocked(isLocked()), 150);
    announce('check_in', 'success', { lang: langRef.current });
  }

  // check-in window 04:30–16:30, check-out after that (enforced by the server)
  const hm = now ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':').map(Number) : [8, 0];
  const mins = hm[0] * 60 + hm[1];
  const morning = mins >= 270 && mins <= 990;
  const canDash = me && me.role !== 'checker';

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }

  const codeInput = (hidden) => (
    <input
      ref={inputRef}
      className={hidden ? 'reader-input' : undefined}
      value={code}
      onChange={(e) => setCode(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={hidden ? undefined : t('scan.inputPh')}
      aria-label={t('scan.inputPh')}
      tabIndex={hidden ? -1 : 0}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="characters"
      enterKeyHint="go"
      spellCheck={false}
    />
  );

  return (
    <div className="kiosk" onClick={() => !touchRef.current && inputRef.current?.focus()}>
      <header className="kiosk-head">
        <div className="kiosk-brand">
          <Logo size={64} />
          <div>
            <div className="kb-title">Poipet Resort &amp; Casino</div>
            <div className="kb-sub">{t('app.module')}</div>
          </div>
        </div>
        <div className="kiosk-clock">
          <div className="kc-time">{now ? now.toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false }) : '--:--:--'}</div>
          <div className="kc-date">{now ? now.toLocaleDateString(locale, { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>
        </div>
        <div className="kiosk-actions">
          <span className="mode-pill">
            {morning ? <Sun size={14} /> : <Moon size={14} />} {morning ? t('scan.modeMorning') : t('scan.modeEvening')}
          </span>
          <button className="btn btn-ghost-gold icon-only" onClick={toggleVoice} title={voice ? t('scan.voiceOff') : t('scan.voiceOn')}>
            {voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <LangSwitch />
          {canDash && (
            <Link href="/dashboard/staff" className="btn btn-ghost-gold dash-link" title={t('nav.dashboard')}>
              <LayoutDashboard size={16} /> <span className="hide-m">{t('nav.dashboard')}</span>
            </Link>
          )}
          <button className="btn btn-ghost-gold icon-only" onClick={logout} title={t('nav.logout')}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ---------- start page: one button (camera + card reader) ---------- */}
      <main className="launch">
        <div className="launch-visual" aria-hidden>
          <div className="pulse p1" />
          <div className="pulse p2" />
          <div className="pulse p3" />
          <div className="launch-orb">
            <ScanLine size={64} />
          </div>
        </div>
        <h1 className="launch-title">{t('scan.ready')}</h1>
        <p className="launch-sub">{t('scan.launchSub')}</p>
        <button
          className="launch-btn"
          onClick={(e) => {
            e.stopPropagation();
            openScanner();
          }}
        >
          <Camera size={26} />
          <span>{t('scan.startScan')}</span>
        </button>
        <div className="launch-chips">
          <span className={`launch-chip ${focused || touchRef.current ? 'ok' : ''}`}>
            <Radio size={15} /> {t('scan.reader')} · {focused ? t('scan.readerReady') : t('scan.readerIdle')}
          </span>
          <span className="launch-chip ok">
            <ShieldCheck size={15} /> {t('scan.secure')}
          </span>
        </div>
        {!open && codeInput(true)}
      </main>

      {/* ---------- scanning window: stays open for the next card ---------- */}
      {open && (
        <div className="scanwin" role="dialog" aria-modal="true" aria-label={t('scan.holdQr')}>
          {/* ONE panel: live camera, or (no camera) the card-reader "ready" scanner.
              The ID card result appears on top of the same panel, then it returns to scanning. */}
          <div className={`stage scanwin-stage stage-${result ? result.kind : 'idle'}`}>
            <div className="stage-grid" aria-hidden />
            <button
              className="scanwin-close"
              onClick={(e) => {
                e.stopPropagation();
                closeScanner();
              }}
            >
              <X size={20} />
              <span>{t('scan.closeScanner')}</span>
            </button>
            {camOn ? (
              <>
                <CameraScanner
                  key={camKey}
                  deviceId={deviceId}
                  onCode={(txt) => submit(txt, 'camera')}
                  onError={onCamError}
                  onDevices={(list) => setDevices(list)}
                  onDeviceGone={() => chooseCamera('')}
                />
                <div className="stage-live">
                  <i /> LIVE
                </div>
              </>
            ) : (
              <div className="reader-idle">
                <div className="reader-anim" aria-hidden>
                  <div className="pulse p1" />
                  <div className="pulse p2" />
                  <div className="pulse p3" />
                  <div className="ring ring-a" />
                  <div className="ring ring-b" />
                  <div className="ghost-card">
                    <div className="gc-band" />
                    <div className="gc-photo" />
                    <div className="gc-lines"><i /><i /><i /></div>
                    <div className="gc-qr" />
                    <div className="laser" />
                  </div>
                </div>
                <div className="reader-text">
                  <b>{DICT.th['scan.ready']}</b>
                  <span>{DICT.en['scan.ready']}</span>
                </div>
                {camErr && (
                  <div className="cam-err" role="alert">
                    <CameraOff size={18} />
                    <span>{camErr}</span>
                  </div>
                )}
              </div>
            )}

            {/* compact camera status in the corner, so the centre stays clear for the ID card */}
            {!camOn && (
              <div className="stage-note" title={camErr || t('scan.camOffReader')}>
                <CameraOff size={16} />
                {!camErr && !httpsUrl && <span>{t('scan.camOffReader')}</span>}
                {httpsUrl && (
                  <a className="stage-note-btn" href={httpsUrl} onClick={(e) => e.stopPropagation()}>
                    <ShieldCheck size={14} /> {t('cam.openHttps')}
                  </a>
                )}
                {camErr && (
                  <button className="stage-note-btn" onClick={(e) => { e.stopPropagation(); retryCam(); }}>
                    <RefreshCw size={14} /> {t('cam.retry')}
                  </button>
                )}
              </div>
            )}
            {camOn && camErr && <div className="stage-toast">{camErr}</div>}

            {result && (
              <div className="stage-result">
                <BigResult
                  key={result.key}
                  r={result}
                  locale={locale}
                  onClose={() => {
                    clearTimeout(clearTimer.current);
                    setResult(null);
                  }}
                />
              </div>
            )}
          </div>

          <div className="scanwin-foot">
            <div className={`scan-input ${focused ? 'focused' : ''}`}>
              <KeyRound size={18} />
              {codeInput(false)}
            </div>
            <button className="btn btn-gold btn-lg" onClick={(e) => { e.stopPropagation(); const v = code; setCode(''); submit(v, 'manual'); }}>
              {t('scan.submit')}
            </button>
            {/* camera controls: inline on desktop, their own row of two equal halves on phones */}
            <div className={`cam-controls ${camOn && devices.length > 1 ? 'has-picker' : ''}`}>
              <button
                className={`cam-toggle ${camOn ? 'on' : ''}`}
                role="switch"
                aria-checked={camOn}
                title={t('scan.camToggleHint')}
                onClick={(e) => { e.stopPropagation(); toggleCam(); }}
              >
                {camOn ? <Camera size={17} /> : <CameraOff size={17} />}
                <span className="ct-label">{camOn ? t('scan.camToggleOn') : t('scan.camToggleOff')}</span>
                <i className="ct-track"><i className="ct-knob" /></i>
              </button>
              {camOn && devices.length > 1 && (
                <label className="cam-picker" onClick={(e) => e.stopPropagation()}>
                  <SwitchCamera size={17} aria-hidden />
                  <select className="scanwin-cam" value={deviceId} onChange={(e) => chooseCamera(e.target.value)} aria-label={t('scan.selectCam')}>
                    <option value="">{t('scan.camAuto')}</option>
                    {devices.map((d, i) => (
                      <option key={d.id} value={d.id}>{camName(d.label, i)}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="cp-chev" aria-hidden />
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      {soundLocked && voice && (
        <button className="sound-unlock" onClick={enableSound}>
          <Volume2 size={22} />
          <span>
            <b>แตะเพื่อเปิดเสียง</b>
            <small>Tap to enable sound</small>
          </span>
        </button>
      )}
    </div>
  );
}
