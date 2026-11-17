'use client';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function Pagination({ page, size, total, onPage }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(page * size, total);
  const nums = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p);

  return (
    <div className="pager">
      <span className="muted small">{t('common.showing', { from: from.toLocaleString(), to: to.toLocaleString(), total: total.toLocaleString() })}</span>
      <div className="pager-btns">
        <button disabled={page <= 1} onClick={() => onPage(1)} aria-label="first"><ChevronsLeft size={16} /></button>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="prev"><ChevronLeft size={16} /></button>
        {nums.map((p) => (
          <button key={p} className={p === page ? 'active' : ''} onClick={() => onPage(p)}>{p}</button>
        ))}
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="next"><ChevronRight size={16} /></button>
        <button disabled={page >= pages} onClick={() => onPage(pages)} aria-label="last"><ChevronsRight size={16} /></button>
      </div>
    </div>
  );
}
