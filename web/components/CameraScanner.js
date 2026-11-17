'use client';
import { useEffect, useRef } from 'react';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** getUserMedia for every browser: modern API, or the old prefixed one (old Android browsers / WebViews). */
function getMedia(constraints) {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (md?.getUserMedia) return md.getUserMedia(constraints);
  const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if (!legacy) return Promise.reject(Object.assign(new Error('unsupported'), { name: 'NotSupportedError' }));
  return new Promise((res, rej) => legacy.call(navigator, constraints, res, rej));
}

/** In-app browsers (LINE, Facebook, Instagram, Telegram, Android WebView) often block the camera. */
export const isInAppBrowser = () =>
  typeof navigator !== 'undefined' && /\bLine\/|FBAN|FBAV|Instagram|Telegram|MicroMessenger|; wv\)/i.test(navigator.userAgent);

/**
 * In-page QR camera scanner (no popup window).
 * - Native BarcodeDetector when available (Chrome/Edge: hardware-fast), otherwise jsQR.
 * - Tries the chosen camera, then the back camera, then any camera, from detailed to minimal constraints
 *   (older phones reject some constraints), and retries while the camera is still being released.
 * - Reports: INSECURE (needs https), DENIED, NO_CAMERA, BUSY (used by another app), ENDED (unplugged), INAPP.
 */
export default function CameraScanner({ deviceId, onCode, onError, onDevices, onStarted, onDeviceGone }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cb = useRef({});
  cb.current = { onCode, onError, onDevices, onStarted, onDeviceGone };

  useEffect(() => {
    let stream;
    let stopped = false;
    let timer;
    let detector = null;
    let jsQR = null;

    const fail = (code) => !stopped && cb.current.onError?.(code);

    const DENY = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'];
    const BUSY = ['NotReadableError', 'TrackStartError', 'AbortError'];

    async function openOnce() {
      const attempts = [];
      if (deviceId) {
        attempts.push({ deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } });
        attempts.push({ deviceId: { exact: deviceId } });
      }
      attempts.push({ facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } });
      attempts.push({ facingMode: 'environment' });
      attempts.push(true); // minimal: any camera, browser defaults
      let lastErr;
      for (let i = 0; i < attempts.length; i++) {
        if (stopped) throw Object.assign(new Error('stopped'), { name: 'Stopped' });
        try {
          return await getMedia({ video: attempts[i], audio: false });
        } catch (e) {
          lastErr = e;
          if (DENY.includes(e?.name)) throw e;
          // the saved camera no longer exists (unplugged / different phone): forget it
          if (deviceId && i < 2 && (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError')) cb.current.onDeviceGone?.();
        }
      }
      throw lastErr;
    }

    async function open() {
      // right after switching OFF -> ON (or leaving another app) many phones need a moment to release the camera
      const waits = [0, 400, 900, 1600];
      let lastErr;
      for (const w of waits) {
        if (w) await sleep(w);
        if (stopped) throw Object.assign(new Error('stopped'), { name: 'Stopped' });
        try {
          return await openOnce();
        } catch (e) {
          lastErr = e;
          if (!BUSY.includes(e?.name)) throw e;
        }
      }
      throw lastErr;
    }

    (async () => {
      const hasApi = navigator.mediaDevices?.getUserMedia || navigator.getUserMedia || navigator.webkitGetUserMedia;
      if (window.isSecureContext === false) return fail('INSECURE');
      if (!hasApi) return fail(isInAppBrowser() ? 'INAPP' : 'INSECURE');
      try {
        stream = await open();
      } catch (e) {
        const n = e?.name;
        if (n === 'Stopped') return;
        if (DENY.includes(n)) return fail(isInAppBrowser() ? 'INAPP' : 'DENIED');
        if (BUSY.includes(n)) return fail('BUSY');
        if (n === 'NotSupportedError' || n === 'TypeError') return fail(isInAppBrowser() ? 'INAPP' : 'INSECURE');
        return fail('NO_CAMERA');
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = stream.getVideoTracks()[0];
      track.addEventListener('ended', () => fail('ENDED'));

      try {
        const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        cb.current.onDevices?.(devs.map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` })), track.getSettings().deviceId);
      } catch {}

      const v = videoRef.current;
      if (!v) return;
      v.setAttribute('playsinline', ''); // iOS Safari: play inline, not full screen
      v.muted = true;
      if ('srcObject' in v) v.srcObject = stream;
      else v.src = URL.createObjectURL(stream); // very old browsers
      await v.play().catch(() => {});
      cb.current.onStarted?.();

      if ('BarcodeDetector' in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch {}
      }
      if (!detector) jsQR = (await import('jsqr')).default;

      const tick = async () => {
        if (stopped) return;
        try {
          if (v.readyState >= 2 && v.videoWidth) {
            let text = null;
            if (detector) {
              try {
                const r = await detector.detect(v);
                if (r[0]) text = r[0].rawValue;
              } catch {
                // some phones expose BarcodeDetector but it fails: switch to jsQR
                detector = null;
                jsQR = (await import('jsqr')).default;
              }
            } else {
              const c = canvasRef.current;
              const w = 640;
              const h = Math.round((v.videoHeight / v.videoWidth) * w);
              c.width = w;
              c.height = h;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(v, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const r = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
              if (r) text = r.data;
            }
            if (text) cb.current.onCode?.(text);
          }
        } catch {}
        timer = setTimeout(tick, 90);
      };
      tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop()); // releases the camera immediately (OFF)
      const v = videoRef.current;
      if (v) {
        try { v.pause(); } catch {}
        if ('srcObject' in v) v.srcObject = null;
      }
    };
  }, [deviceId]);

  return (
    <div className="cam">
      <video ref={videoRef} muted playsInline autoPlay />
      <canvas ref={canvasRef} hidden />
      <div className="cam-frame">
        <i /><i /><i /><i />
      </div>
      <div className="laser" />
    </div>
  );
}
