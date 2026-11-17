// Web app manifest — "Add to Home Screen" on Android / iOS opens full-screen like a native app.
export default function manifest() {
  return {
    name: 'Poipet Staff Attendance',
    short_name: 'Scan ID',
    description: 'Poipet Resort & Casino — staff ID scanning and attendance',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#3a0530',
    theme_color: '#3a0530',
    icons: [
      { src: '/logo.png', sizes: 'any', type: 'image/png', purpose: 'any' },
      { src: '/favicon.png', sizes: 'any', type: 'image/png' },
    ],
  };
}
