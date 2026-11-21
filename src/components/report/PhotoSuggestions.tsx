"use client";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';

/** Ready-made descriptions, shown after a photo is added. Tapping one fills (or extends) the description. */
export function PhotoSuggestions({ description, setDescription }: { description: string; setDescription: (t: string) => void }) {
  const { t } = useTranslation('suggest');
  const [all, setAll] = useState(false);
  const [added, setAdded] = useState(false);
  const raw = t('items', { returnObjects: true });
  const items = Array.isArray(raw) ? (raw as string[]) : [];
  if (!items.length) return null;

  const pick = (text: string) => {
    if (description.includes(text)) return;
    setDescription(description.trim() ? `${description.trim()} ${text}` : text);
    setAdded(true);
  };

  return (
    <fieldset className="mt-4 space-y-2">
      <legend className="font-medium">{t('title')}</legend>
      <p className="text-sm text-[var(--ink-2)]">{t('hint')}</p>
      <ul className="space-y-2">
        {(all ? items : items.slice(0, 5)).map((s) => (
          <li key={s}>
            <button type="button" onClick={() => pick(s)} className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-left [@media(hover:hover)]:hover:bg-[#f1f2f0]">
              {s}
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" intent="ghost" onClick={() => setAll((v) => !v)}>{t(all ? 'less' : 'more')}</Button>
      <span role="status" className="sr-only">{added ? t('added') : ''}</span>
    </fieldset>
  );
}
