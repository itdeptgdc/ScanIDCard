'use client';
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/Toast';

export default function Providers({ children }) {
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}
