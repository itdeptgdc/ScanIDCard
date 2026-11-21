// Web app manifest — lets Chrome / Edge / Android offer "Install app" and iOS "Add to Home Screen".
// The installed app opens full screen in its own window, like a native app.
// Chrome needs square PNG icons with real sizes (at least 192 and 512) to allow installing.
export default function manifest() {
  return {
    id: '/',
    name: 'Poipet Staff Attendance',
    short_name: 'Scan ID',
    description: 'Poipet Resort & Casino — staff ID scanning and attendance',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#3a0530',
    theme_color: '#3a0530',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
