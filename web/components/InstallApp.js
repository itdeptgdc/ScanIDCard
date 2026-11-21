'use client';
// "Install app" UI: a dismissible banner, a small top-bar button and a "Download app" dialog
// with step-by-step instructions for each platform.
import { useEffect, useState } from 'react';
import { Download, X, MoreVertical, Share, PlusSquare, MonitorDown, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/Modal';
import { useI18n } from '@/lib/i18n';
import { useInstall, bannerDismissed, dismissBanner } from '@/lib/pwa';
import { useToast } from '@/components/Toast';

const APP_NAME = 'Scan ID';

/** Install flow shared by banner + button: one-tap prompt when the browser offers it, otherwise the guide. */
function useInstallAction() {
  const inst = useInstall();
  const toast = useToast();
  const { t } = useI18n();
  const [guide, setGuide] = useState(false);

  const install = async () => {
    if (!inst.canPrompt) return setGuide(true);
    const r = await inst.promptInstall();
    if (r === 'accepted') toast?.(t('install.done'));
  };
  return { inst, install, guide, setGuide };
}

/* ---------------- banner ("Get the Scan ID app") ---------------- */
export function InstallBanner() {
  const { t } = useI18n();
  const { inst, install, guide, setGuide } = useInstallAction();
  const [hidden, setHidden] = useState(true);

  useEffect(() => setHidden(bannerDismissed()), []);

  // Shown until installed or dismissed. Without a one-tap prompt (e.g. untrusted https certificate)
  // the Install button opens the step-by-step guide instead.
  const show = inst.ready && !inst.installed && !hidden;

  return (
    <>
      {show && (
        <div className="install-banner" role="region" aria-label={t('install.bannerTitle', { app: APP_NAME })}>
          <img src="/icons/icon-192.png" alt="" className="install-banner-icon" />
          <div className="install-banner-text">
            <div className="install-banner-title">{t('install.bannerTitle', { app: APP_NAME })}</div>
            <div className="install-banner-sub">{t('install.bannerSub')}</div>
          </div>
          <button className="install-banner-btn" onClick={install}>{t('install.install')}</button>
          <button
            className="install-banner-x"
            aria-label={t('common.close')}
            onClick={() => {
              dismissBanner();
              setHidden(true);
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <InstallDialog open={guide} onClose={() => setGuide(false)} inst={inst} onInstall={install} />
    </>
  );
}

/* ---------------- top-bar button ---------------- */
export function InstallButton({ className = 'icon-btn', label = false }) {
  const { t } = useI18n();
  const { inst, install, guide, setGuide } = useInstallAction();
  if (!inst.ready || inst.installed) return null;
  return (
    <>
      <button className={`${className} install-btn`} onClick={() => setGuide(true)} aria-label={t('install.title')} title={t('install.title')}>
        <Download size={label ? 16 : 17} />
        {label && <span className="hide-sm">{t('install.title')}</span>}
      </button>
      <InstallDialog open={guide} onClose={() => setGuide(false)} inst={inst} onInstall={install} />
    </>
  );
}

/* ---------------- "Download app" dialog ---------------- */
function InstallDialog({ open, onClose, inst, onInstall }) {
  const { t } = useI18n();

  const steps =
    inst.platform === 'ios'
      ? [
          [t('install.ios1'), <Share key="i" size={15} />],
          [t('install.ios2'), <PlusSquare key="i" size={15} />],
          [t('install.ios3')],
        ]
      : inst.platform === 'android'
      ? [
          [t('install.and1'), <MoreVertical key="i" size={15} />],
          [t('install.and2')],
          [t('install.and3')],
        ]
      : [
          [t('install.pc1'), <MonitorDown key="i" size={15} />],
          [t('install.pc2'), <MoreVertical key="i" size={15} />],
          [t('install.pc3')],
        ];

  return (
    <Modal open={open} onClose={onClose} width={440} className="install-modal">
      <button className="install-modal-x" onClick={onClose} aria-label={t('common.close')}>
        <X size={20} />
      </button>
      <h3 className="modal-title">{t('install.title')}</h3>
      <p className="muted install-modal-sub">{t('install.sub')}</p>

      <div className="install-app-card">
        <img src="/icons/icon-192.png" alt="" />
        <div>
          <div className="install-app-name">{APP_NAME}</div>
          <div className="install-app-org">Poipet Resort &amp; Casino</div>
        </div>
      </div>

      {inst.installed ? (
        <p className="install-ok"><CheckCircle2 size={18} /> {t('install.already')}</p>
      ) : inst.canPrompt ? (
        <p className="muted install-hint">{t('install.oneTap')}</p>
      ) : (
        <ol className="install-steps">
          {steps.map(([text, icon], i) => (
            <li key={i}>
              <span className="install-step-n">{i + 1}</span>
              <span>
                {text} {icon && <span className="install-step-icon">{icon}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="modal-actions install-modal-actions">
        <button className="btn btn-soft" onClick={onClose}>{t('common.close')}</button>
        {inst.canPrompt && !inst.installed && (
          <button
            className="btn btn-primary"
            onClick={async () => {
              await onInstall();
              onClose();
            }}
          >
            <Download size={17} /> {t('install.install')}
          </button>
        )}
      </div>
    </Modal>
  );
}
