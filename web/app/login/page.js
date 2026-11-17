'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { api, errText } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { KHMER_BRAND } from '@/lib/cardTypes';
import Logo from '@/components/Logo';
import LangSwitch from '@/components/LangSwitch';

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await api('/auth/login', { method: 'POST', body: { username, password }, noRedirect: true });
      router.replace(u.role === 'checker' ? '/scan' : '/dashboard/staff');
    } catch (err) {
      setError(errText(err, t));
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-lang">
        <LangSwitch />
      </div>
      <div className="login-card">
        <div className="login-hero">
          <div className="hero-particles" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => <span key={i} style={{ '--i': i }} />)}
          </div>
          <div className="hero-rail" aria-hidden>
            <span className="hero-rail-text">{KHMER_BRAND}</span>
          </div>
          <div className="hero-inner">
            <div className="hero-logo">
              <Logo size={168} />
              <div className="hero-logo-glow" />
            </div>
            <div className="hero-divider" />
            <div className="hero-brand">POIPET RESORT &amp; CASINO</div>
            <h1 className="hero-title">{t('login.heroTitle')}</h1>
            <p className="hero-sub">{t('login.heroSub')}</p>
            <div className="hero-secure">
              <ShieldCheck size={16} /> {t('login.secure')}
            </div>
          </div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <h2>{t('login.welcome')}</h2>
          <p className="muted">{t('login.sub')}</p>

          <label className="field">
            <span>{t('login.username')}</span>
            <div className="input-icon">
              <User size={17} />
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </div>
          </label>

          <label className="field">
            <span>{t('login.password')}</span>
            <div className="input-icon">
              <Lock size={17} />
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label="toggle password">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary btn-block btn-lg login-btn" disabled={busy}>
            {busy ? (
              <>
                <span className="login-spinner" aria-hidden />
                <span>{t('login.loading')}</span>
              </>
            ) : (
              <>
                <span>{t('login.submit')}</span>
                <span className="login-arrow" aria-hidden>
                  <ArrowRight size={17} strokeWidth={2.6} />
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
