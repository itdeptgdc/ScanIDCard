'use client';
// Department filter dropdown — options come from the staff list ('' = all departments).
import { useEffect, useState } from 'react';
import Select from '@/components/Select';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export default function DepartmentSelect({ value, onChange, className = 'w-220' }) {
  const { t } = useI18n();
  const [depts, setDepts] = useState([]);

  useEffect(() => {
    api('/staff/departments').then(setDepts).catch(() => {});
  }, []);

  const options = [{ value: '', label: t('dept.all') }, ...depts.map((d) => ({ value: d, label: d }))];
  return <Select value={value} onChange={onChange} options={options} className={className} />;
}
