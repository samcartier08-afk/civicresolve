"use client";
import { NavLink, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

export interface StaffNavItem { to: string; label: string; end?: boolean }

/** One shell for the department (authority) and admin portals. */
export function StaffShell({ title, nav }: { title: string; nav: StaffNavItem[] }) {
  const { t } = useTranslation();
  const { t: tp } = useTranslation('portal');
  const { me, signOut } = useAuth();
  return (
    <>
      <a href="#main" className="sr-only rounded-lg bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">{t('nav.skip')}</a>
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <p className="font-semibold">CivicResolve <span className="font-normal text-[var(--ink-2)]">{title}</span></p>
          <nav aria-label={t('nav.label')} className="flex-1">
            <ul className="flex flex-wrap gap-1">
              {nav.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.end} className={({ isActive }) => cn('inline-flex min-h-11 items-center rounded-xl px-3', isActive ? 'bg-[var(--ai-bg)] font-semibold text-[var(--ai)]' : 'text-[var(--ink-2)]')}>
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <span className="text-sm text-[var(--ink-2)]">{me?.name}</span>
          <Button intent="secondary" onClick={() => void signOut()}>{tp('signOut')}</Button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none"><Outlet /></main>
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
