"use client";
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { LANGS } from '../../i18n';

export function ProfilePage() {
  const { t, i18n } = useTranslation('pages');
  const { user, me, signOut } = useAuth();

  const setLang = (code: string) => {
    void i18n.changeLanguage(code);
    try { localStorage.setItem('lang', code); } catch { /* storage blocked */ }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
      <dl className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4">
        <div>
          <dt className="text-sm text-[var(--ink-2)]">{t('profile.name')}</dt>
          <dd>{me?.name || user?.displayName || '—'}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--ink-2)]">{t('profile.email')}</dt>
          <dd>{user?.email || '—'}</dd>
        </div>
        {me && (
          <div>
            <dt className="text-sm text-[var(--ink-2)]">{t('profile.role')}</dt>
            <dd>{t(`profile.role_${me.role}`)}</dd>
          </div>
        )}
      </dl>

      <div>
        <label htmlFor="lang" className="mb-1 block font-medium">{t('profile.language')}</label>
        <select
          id="lang"
          value={i18n.language}
          onChange={(e) => setLang(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3"
        >
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>

      <Button intent="secondary" onClick={() => void signOut()}>{t('profile.signOut')}</Button>
    </div>
  );
}
