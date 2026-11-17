'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    api('/auth/me', { noRedirect: true })
      .then((u) => router.replace(u.role === 'checker' ? '/scan' : '/dashboard/staff'))
      .catch(() => router.replace('/login'));
  }, [router]);
  return (
    <div className="page-loader">
      <div className="spinner" />
    </div>
  );
}
