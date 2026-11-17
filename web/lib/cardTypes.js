'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

/** Built-in card designs (hard-coded artwork in components/IdCard.js). */
export const CARD_TYPES = [
  { value: 'staff', color: '#d32f2f' },
  { value: 'casino_staff', color: '#4d0a40' },
  { value: 'vendor', color: '#2e7d32' },
  { value: 'tenant', color: '#1a237e' },
  { value: 'visitor', color: '#ef6c00' },
  { value: 'contractor', color: '#d4c400' },
];
export const isBuiltin = (v) => CARD_TYPES.some((c) => c.value === v);

// Text printed vertically on the house (Staff / Casino Staff) cards. Adjust spelling here if needed.
export const KHMER_BRAND = 'ប៉ោយប៉ែត រីសត & កាស៊ីណូ';
export const EN_BRAND = 'Poipet Resort & Casino';

// ---------- custom templates (designed in Dashboard → Card templates), shared app-wide ----------
let templates = null;
let pending = null;
const subs = new Set();

/** (Re)load templates from the API and notify every component using useCardTypes(). */
export function loadTemplates() {
  pending = api('/card-templates', { noRedirect: true })
    .then((r) => {
      templates = r.rows || [];
      subs.forEach((fn) => fn(templates));
      return templates;
    })
    .catch(() => templates || [])
    .finally(() => {
      pending = null;
    });
  return pending;
}

/**
 * All card types: built-ins + custom templates.
 * types: [{ value, label, color, custom, template }]  ·  find(value)  ·  label(value)  ·  color(value)
 */
export function useCardTypes(t) {
  const [list, setList] = useState(templates || []);
  useEffect(() => {
    subs.add(setList);
    if (templates) setList(templates);
    else if (!pending) loadTemplates();
    return () => subs.delete(setList);
  }, []);

  const types = [
    ...CARD_TYPES.map((c) => ({ value: c.value, label: t ? t(`type.${c.value}`) : c.value, color: c.color, custom: false })),
    ...list.map((tp) => ({ value: tp.key, label: tp.name, color: tp.color, custom: true, template: tp })),
  ];
  const find = (v) => types.find((x) => x.value === v);
  return {
    templates: list,
    loaded: templates !== null,
    types,
    find,
    template: (v) => list.find((tp) => tp.key === v) || null,
    label: (v) => find(v)?.label || v,
    color: (v) => find(v)?.color || '#888',
  };
}
