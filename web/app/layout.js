import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Poipet Staff Attendance',
  description: 'Poipet Resort & Casino — secure staff ID scanning and attendance',
  applicationName: 'Poipet Scan ID',
  appleWebApp: { capable: true, title: 'Scan ID', statusBarStyle: 'black-translucent' },
  icons: { icon: '/favicon.png', apple: '/logo.png' },
  formatDetection: { telephone: false },
};

// viewport-fit=cover lets the app draw under the notch / home bar (we pad with safe-area insets)
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#3a0530' };

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Kantumruy+Pro:wght@500;700&family=Noto+Sans+Thai:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
