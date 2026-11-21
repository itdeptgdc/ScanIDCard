// Minimal service worker — makes the site installable as an app.
// It never caches API data or pages: everything always comes live from the server,
// so attendance / scan results are never stale. Only if the network is down when
// opening a page does it show a small "offline" message.
const OFFLINE_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scan ID — offline</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#3a0530;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
button{margin-top:18px;padding:12px 26px;border:0;border-radius:12px;background:#d4a64a;color:#2b0423;font-weight:700;font-size:15px}</style></head>
<body><div><h2>ไม่มีการเชื่อมต่อ / No connection</h2><p>กรุณาตรวจสอบเครือข่ายแล้วลองอีกครั้ง<br>Please check the network and try again.</p>
<button onclick="location.reload()">ลองใหม่ / Retry</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return; // let the browser handle everything else normally
  e.respondWith(
    fetch(e.request).catch(
      () => new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    )
  );
});
