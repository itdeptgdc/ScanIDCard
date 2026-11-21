'use client';
import { useEffect } from 'react';
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/Toast';
import { registerServiceWorker } from '@/lib/pwa'; // importing also starts listening for the install prompt

export default function Providers({ children }) {
  useEffect(() => registerServiceWorker(), []);
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}
