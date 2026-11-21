"use client";
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthProvider';
import { ButtonLink } from '../../components/ui/ButtonLink';

export function HomePage() {
  const { t } = useTranslation('pages');
  const { user } = useAuth();
  return (
    <div className="space-y-8 pt-4">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">{t('home.title')}</h1>
        <p className="text-lg text-[var(--ink-2)]">{t('home.body')}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink to="/report">{t('home.cta')}</ButtonLink>
          {!user && <ButtonLink to="/login" intent="secondary">{t('home.signIn')}</ButtonLink>}
        </div>
      </header>
      <section aria-labelledby="how">
        <h2 id="how" className="mb-3 text-lg font-semibold">{t('home.how')}</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t('home.how1')}</li><li>{t('home.how2')}</li><li>{t('home.how3')}</li>
        </ol>
      </section>
    </div>
  );
}
