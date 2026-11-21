"use client";
import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../components/ui/ButtonLink';

export function NotFoundPage() {
  const { t } = useTranslation('pages');
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
      <p className="text-[var(--ink-2)]">{t('notFound.hint')}</p>
      <div><ButtonLink to="/">{t('notFound.home')}</ButtonLink></div>
    </main>
  );
}
