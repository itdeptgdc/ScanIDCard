'use client';
import { useState } from 'react';
import { Plus, Pencil, Copy, Trash2, Users, LayoutTemplate, Lock, RotateCcw } from 'lucide-react';
import { builtinDesign } from '@/lib/builtinDesigns';
import { api, errText } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { CARD_TYPES, useCardTypes, loadTemplates } from '@/lib/cardTypes';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import IdCard from '@/components/IdCard';
import TemplateCard from '@/components/TemplateCard';
import CardDesigner, { SAMPLE_STAFF, starterDesign } from './CardDesigner';

export default function CardTemplatesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const ct = useCardTypes(t);
  const [edit, setEdit] = useState(null); // template being designed ({} = new)
  const [del, setDel] = useState(null);
  const [restore, setRestore] = useState(null); // { type, name } of an edited built-in to reset
  const [busy, setBusy] = useState(false);

  async function duplicate(tp) {
    try {
      await api('/card-templates', { method: 'POST', body: { name: `${tp.name} (copy)`.slice(0, 60), color: tp.color, design: tp.design } });
      await loadTemplates();
      toast(t('common.saved'));
    } catch (e) {
      toast(errText(e, t), 'error');
    }
  }

  async function confirmRestore() {
    setBusy(true);
    try {
      await api(`/card-templates/builtin/${restore.type}`, { method: 'DELETE' });
      await loadTemplates();
      toast(t('common.saved'));
      setRestore(null);
    } catch (e) {
      toast(errText(e, t), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api(`/card-templates/${del.id}`, { method: 'DELETE' });
      await loadTemplates();
      toast(t('common.deleted'));
      setDel(null);
    } catch (e) {
      toast(e.code === 'TEMPLATE_IN_USE' ? t('err.TEMPLATE_IN_USE', { n: del.staff_count }) : errText(e, t), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">{t('tpl.eyebrow')}</div>
            <h2 className="panel-title">{t('tpl.title')}</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>{t('tpl.sub')}</p>
          </div>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setEdit({ name: '', color: '#7b1fa2', design: starterDesign('#4d0a40') })}>
              <Plus size={16} /> {t('tpl.new')}
            </button>
          </div>
        </div>

        <div className="tpl-grid">
          {ct.templates.map((tp) => (
            <div className="tpl-tile" key={tp.id}>
              <div className="tpl-prev" onClick={() => setEdit(tp)} title={t('tpl.edit')}>
                <div className="tpl-prev-in">
                  <TemplateCard template={tp} staff={SAMPLE_STAFF} displayOnly />
                </div>
              </div>
              <div className="tpl-info">
                <div className="tpl-name">
                  <span className="dot" style={{ background: tp.color }} />
                  <b>{tp.name}</b>
                </div>
                <span className="muted small"><Users size={13} /> {t('tpl.usedBy', { n: tp.staff_count })}</span>
              </div>
              <div className="tpl-actions">
                <button className="btn btn-soft btn-sm" onClick={() => setEdit(tp)}><Pencil size={14} /> {t('tpl.edit')}</button>
                <button className="icon-btn" onClick={() => duplicate(tp)} title={t('tpl.duplicate')}><Copy size={15} /></button>
                <button className="icon-btn danger" onClick={() => setDel(tp)} title={t('common.delete')}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}

          <button className="tpl-tile tpl-new" onClick={() => setEdit({ name: '', color: '#7b1fa2', design: starterDesign('#4d0a40') })}>
            <span className="tpl-new-icon"><Plus size={28} /></span>
            <b>{t('tpl.new')}</b>
            <span className="muted small">{t('tpl.newSub')}</span>
          </button>
        </div>
        {ct.loaded && !ct.templates.length && (
          <p className="muted small center" style={{ marginTop: 6 }}>
            <LayoutTemplate size={14} /> {t('tpl.empty')}
          </p>
        )}
      </div>

      {/* built-in designs: editable; an edited one can be restored to the original artwork */}
      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div>
            <div className="eyebrow">{t('tpl.builtinEyebrow')}</div>
            <h2 className="panel-title">{t('tpl.builtin')}</h2>
          </div>
        </div>
        <div className="tpl-grid">
          {CARD_TYPES.map((c) => {
            const ov = ct.override(c.value);
            const name = t(`type.${c.value}`);
            const editBuiltin = () => setEdit({ builtin: c.value, name, color: c.color, design: ov?.design || builtinDesign(c.value) });
            return (
              <div className="tpl-tile" key={c.value}>
                <div className="tpl-prev" onClick={editBuiltin} title={t('tpl.edit')}>
                  <div className="tpl-prev-in">
                    <IdCard staff={{ ...SAMPLE_STAFF, card_type: c.value }} displayOnly />
                  </div>
                </div>
                <div className="tpl-info">
                  <div className="tpl-name">
                    <span className="dot" style={{ background: c.color }} />
                    <b>{name}</b>
                  </div>
                  <span className="muted small">
                    {ov ? <><Pencil size={12} /> {t('tpl.customized')}</> : <><Lock size={12} /> {t('tpl.builtinNote')}</>}
                  </span>
                </div>
                <div className="tpl-actions">
                  <button className="btn btn-soft btn-sm" onClick={editBuiltin}><Pencil size={14} /> {t('tpl.edit')}</button>
                  {ov && (
                    <button className="icon-btn" onClick={() => setRestore({ type: c.value, name })} title={t('tpl.restore')}>
                      <RotateCcw size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {edit && (
        <CardDesigner
          initial={edit}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            await loadTemplates();
            toast(t('common.saved'));
            setEdit(null);
          }}
        />
      )}

      <ConfirmModal
        open={!!restore}
        title={t('tpl.restoreTitle')}
        message={restore ? t('tpl.restoreMsg', { name: restore.name }) : ''}
        confirmLabel={t('tpl.restore')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmRestore}
        onClose={() => setRestore(null)}
        busy={busy}
      />

      <ConfirmModal
        open={!!del}
        title={t('tpl.deleteTitle')}
        message={del ? (del.staff_count ? t('err.TEMPLATE_IN_USE', { n: del.staff_count }) : t('tpl.deleteMsg', { name: del.name })) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onClose={() => setDel(null)}
        busy={busy || !!del?.staff_count}
      />
    </>
  );
}
