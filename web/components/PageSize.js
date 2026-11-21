'use client';
// "Show [10 ▾] rows" — rows-per-page picker for paginated tables.
import Select from '@/components/Select';
import { useI18n } from '@/lib/i18n';

export const PAGE_ALL = 5000; // "All" — must not exceed the API's max page size
export const PAGE_SIZES = [10, 25, 50, 100, PAGE_ALL];

export default function PageSize({ value, onChange }) {
  const { t } = useI18n();
  const options = PAGE_SIZES.map((n) => ({ value: n, label: n === PAGE_ALL ? t('common.all') : String(n) }));
  return (
    <div className="page-size">
      <span>{t('common.show')}</span>
      <Select value={value} onChange={onChange} options={options} className="page-size-select" />
      <span>{t('common.rows')}</span>
    </div>
  );
}
