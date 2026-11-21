'use client';
import { createContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, ClipboardList, UserCog, ScanLine, LogOut, ChevronLeft, ShieldAlert, LayoutTemplate } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import Logo from '@/components/Logo';
import LangSwitch from '@/components/LangSwitch';
import { RoleBadge } from '@/components/Badges';
import { InstallBanner, InstallButton } from '@/components/InstallApp';

const MeCtx = createContext(null);

const NAV = [
  { href: '/dashboard/staff', icon: Users, key: 'nav.staff', roles: ['admin', 'hr'] },
  { href: '/dashboard/attendance', icon: ClipboardList, key: 'nav.attendance', roles: ['admin', 'hr'] },
  { href: '/dashboard/card-templates', icon: LayoutTemplate, key: 'nav.templates', roles: ['admin', 'hr'] },
  { href: '/dashboard/users', icon: UserCog, key: 'nav.users', roles: ['admin'], mobileTop: true }, // mobile: top bar, not the tab bar
  { href: '/dashboard/logs', icon: ShieldAlert, key: 'nav.logs', roles: ['admin'] },
  { href: '/scan', icon: ScanLine, key: 'nav.scan', roles: ['admin', 'hr', 'checker'] },
];

export default function DashboardLayout({ children }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    api('/auth/me')
      .then((u) => (u.role === 'checker' ? router.replace('/scan') : setMe(u)))
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebar') === '1');
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar', c ? '0' : '1');
      } catch {}
      return !c;
    });
  };

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }

  if (!me)
    return (
      <div className="page-loader">
        <div className="spinner" />
      </div>
    );

  return (
    <MeCtx.Provider value={me}>
      <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
        <aside className="sidebar">
          <div className="sb-brand">
            <Logo size={52} />
            <div className="sb-brand-text">
              <div className="sb-title">POIPET</div>
              <div className="sb-sub">Resort &amp; Casino</div>
            </div>
            <button className="sb-toggle" onClick={toggle} aria-label="toggle sidebar">
              <ChevronLeft size={16} />
            </button>
          </div>
          <div className="sb-divider" />
          <nav className="sb-nav">
            {NAV.filter((n) => n.roles.includes(me.role)).map((n) => {
              const Icon = n.icon;
              const active = pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={`sb-link ${active ? 'active' : ''}`} title={t(n.key)}>
                  <Icon size={19} className={n.href === '/scan' ? 'scan-anim' : undefined} />
                  <span>{t(n.key)}</span>
                </Link>
              );
            })}
          </nav>
          <button className="sb-logout" onClick={logout}>
            <LogOut size={18} />
            <span>{t('nav.logout')}</span>
          </button>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <div className="eyebrow">{t('app.eyebrow')}</div>
              <div className="topbar-title">Poipet Resort &amp; Casino</div>
            </div>
            <div className="topbar-right">
              <InstallButton />
              <LangSwitch />
              {me.role === 'admin' && (
                <Link
                  href="/dashboard/users"
                  className={`icon-btn topbar-users ${pathname.startsWith('/dashboard/users') ? 'active' : ''}`}
                  aria-label={t('nav.users')}
                  title={t('nav.users')}
                >
                  <UserCog size={18} />
                </Link>
              )}
              <div className="user-chip">
                <span className="avatar">{(me.name || me.username).charAt(0).toUpperCase()}</span>
                <span className="user-name">{me.name}</span>
                <RoleBadge role={me.role} />
              </div>
              <button className="icon-btn topbar-logout" onClick={logout} aria-label={t('nav.logout')}>
                <LogOut size={18} />
              </button>
            </div>
          </header>
          <div className="content">
            <InstallBanner />
            {children}
          </div>
        </main>

        {/* mobile: native-style bottom tab bar (replaces the sidebar) */}
        <nav className="tabbar">
          {(() => {
            // scan button sits in the middle of the bar
            const items = NAV.filter((n) => n.roles.includes(me.role) && !n.mobileTop);
            const scan = items.find((n) => n.href === '/scan');
            const rest = items.filter((n) => n !== scan);
            if (scan) rest.splice(Math.floor(rest.length / 2), 0, scan);
            return rest;
          })().map((n) => {
            const Icon = n.icon;
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`tab ${active ? 'active' : ''} ${n.href === '/scan' ? 'tab-scan' : ''}`}>
                <span className="tab-icon"><Icon size={21} className={n.href === '/scan' ? 'scan-anim' : undefined} /></span>
                <span className="tab-label">{t(n.key)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </MeCtx.Provider>
  );
}
