'use client';
import { CheckCircle2, Lock, Ban } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useCardTypes } from '@/lib/cardTypes';

export function TypeBadge({ type }) {
  const { t } = useI18n();
  const ct = useCardTypes(t);
  return (
    <span className="badge badge-type">
      <span className="dot" style={{ background: ct.color(type) }} />
      {ct.label(type)}
    </span>
  );
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  const Icon = status === 'active' ? CheckCircle2 : status === 'locked' ? Lock : Ban;
  return (
    <span className={`badge badge-${status}`}>
      <Icon size={13} />
      {t(`status.${status}`)}
    </span>
  );
}

export function RoleBadge({ role }) {
  const { t } = useI18n();
  return <span className={`badge role-${role}`}>{t(`role.${role}`)}</span>;
}
