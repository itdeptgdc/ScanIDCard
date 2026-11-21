'use client';
// "Install app" support (PWA).
// Chrome / Edge fire `beforeinstallprompt` once, very early — often before any React component
// mounts — so we catch it at module load and keep it here for the Install buttons to use later.
import { useEffect, useState } from 'react';

let deferred = null; // the saved beforeinstallprompt event
let installed = false;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

const DISMISS_KEY = 'installBannerDismissed';
const DISMISS_DAYS = 14;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // stop Chrome's own mini-bar; we show our own banner instead
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true // iOS Safari
  );
}

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * canPrompt  – the browser offered a one-tap install (Chrome / Edge / Samsung Internet)
 * installed  – already running as the installed app (hide all install UI)
 * platform   – 'ios' | 'android' | 'desktop' (for the manual steps)
 */
export function useInstall() {
  const [state, setState] = useState({ ready: false, canPrompt: false, installed: false, platform: 'desktop' });

  useEffect(() => {
    const update = () =>
      setState({ ready: true, canPrompt: !!deferred, installed: installed || isStandalone(), platform: detectPlatform() });
    update();
    subs.add(update);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    mq?.addEventListener?.('change', update);
    return () => {
      subs.delete(update);
      mq?.removeEventListener?.('change', update);
    };
  }, []);

  /** Shows the browser's install dialog. Returns 'accepted' | 'dismissed' | 'unavailable'. */
  const promptInstall = async () => {
    if (!deferred) return 'unavailable';
    const e = deferred;
    deferred = null; // the event can be used only once
    emit();
    e.prompt();
    const { outcome } = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
    return outcome;
  };

  return { ...state, promptInstall };
}

export function bannerDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

export function dismissBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}
