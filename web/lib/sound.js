'use client';
/**
 * Kiosk sound engine (Web Audio).
 * - Pre-recorded Thai + English clips (/public/sounds/{th,en}/<key>.wav, made by tools/make-voice.ps1),
 *   decoded once at start -> zero delay, and identical on every PC (no installed voice needed).
 * - Each clip is peak-normalised, then boosted ×2.2 through a limiter (compressor): loud but not distorted.
 * - Browsers keep audio muted until the first user gesture; unlock() is called on any tap / key
 *   (a USB card reader keystroke counts), and isLocked() lets the UI ask staff to tap once.
 */
export const VOICE_KEYS = ['check_in', 'check_out', 'duplicate', 'NOT_FOUND', 'INVALID_QR', 'CARD_MISMATCH', 'BLOCKED', 'LOCKED', 'EXPIRED', 'NETWORK', 'UNAUTHORIZED'];

const FALLBACK_EN = {
  check_in: 'Check in successful', check_out: 'Check out successful', duplicate: 'Already scanned',
  NOT_FOUND: 'Card not found', INVALID_QR: 'Invalid QR code', CARD_MISMATCH: 'Invalid card',
  BLOCKED: 'Card blocked', LOCKED: 'Card locked', EXPIRED: 'Card expired', NETWORK: 'Connection error',
  UNAUTHORIZED: 'Please log in again', OUTSIDE_HOURS: 'Outside scan hours',
};

let ctx = null;
let master = null;
let loading = null;
const buffers = {};
let playing = [];

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 4;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  master = ctx.createGain();
  master.gain.value = 2.2;
  master.connect(limiter).connect(ctx.destination);
  return ctx;
}

function normalize(buf) {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = d[i] < 0 ? -d[i] : d[i];
      if (a > peak) peak = a;
    }
  }
  if (peak > 0 && peak < 0.97) {
    const g = 0.97 / peak;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= g;
    }
  }
}

/** Download + decode all clips (decoding works before the audio is unlocked). */
export function preload() {
  if (loading) return loading;
  if (!ensureCtx()) return Promise.resolve();
  loading = Promise.all(
    ['th', 'en'].flatMap((lang) =>
      VOICE_KEYS.map(async (k) => {
        try {
          const r = await fetch(`/sounds/${lang}/${k}.wav`);
          if (!r.ok) return;
          const b = await ctx.decodeAudioData(await r.arrayBuffer());
          normalize(b);
          buffers[`${lang}/${k}`] = b;
        } catch {}
      })
    )
  );
  return loading;
}

/** Call from a user gesture (click / tap / key). */
export function unlock() {
  if (!ensureCtx() || ctx.state === 'running') return;
  ctx.resume().catch(() => {});
  try {
    // tiny silent buffer: required by some browsers (Safari) to really unlock
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
  } catch {}
  try {
    window.speechSynthesis?.resume();
  } catch {}
}

export const isLocked = () => !ctx || ctx.state !== 'running';

export function onStateChange(fn) {
  if (!ensureCtx()) return () => {};
  const h = () => fn(ctx.state);
  ctx.addEventListener('statechange', h);
  return () => ctx.removeEventListener('statechange', h);
}

function stopAll() {
  playing.forEach((s) => {
    try {
      s.stop();
    } catch {}
  });
  playing = [];
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

function tone(freq, start, dur, type, gain) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + dur + 0.02);
  playing.push(o);
}

/** Beep immediately, then the announcement in the selected language ('th' | 'en'). */
export function announce(key, kind, { voice = true, lang = 'th' } = {}) {
  if (!ensureCtx()) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  stopAll();
  const t0 = ctx.currentTime + 0.02;
  if (kind === 'success') {
    tone(880, t0, 0.12, 'sine', 0.35);
    tone(1320, t0 + 0.1, 0.16, 'sine', 0.35);
  } else if (kind === 'warn') {
    tone(660, t0, 0.12, 'sine', 0.35);
    tone(660, t0 + 0.16, 0.12, 'sine', 0.35);
  } else {
    tone(260, t0, 0.18, 'square', 0.18);
    tone(180, t0 + 0.2, 0.25, 'square', 0.18);
  }
  if (!voice) return;

  let t = t0 + (kind === 'error' ? 0.5 : 0.32);
  let played = false;
  // selected language first; the other language only if that clip is missing
  const order = lang === 'en' ? ['en', 'th'] : ['th', 'en'];
  for (const l of order) {
    const b = buffers[`${l}/${key}`];
    if (!b) continue;
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(master);
    s.start(t);
    playing.push(s);
    played = true;
    break;
  }
  if (!played) speakFallback(key);
}

/** Only used if the clip files are missing: browser speech (English, max volume). */
function speakFallback(key) {
  const ss = window.speechSynthesis;
  const text = FALLBACK_EN[key];
  if (!ss || !text) return;
  setTimeout(() => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.volume = 1;
      u.rate = 1.05;
      window.__scanUtterance = u; // keep a reference (Chrome may garbage-collect it mid-speech)
      ss.speak(u);
    } catch {}
  }, 60);
}
