"use client";
import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, Home, MapPin, Plus, User, type LucideIcon } from 'lucide-react';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

const ITEMS: { to: string; key: string; Icon: LucideIcon; end?: boolean; primary?: boolean }[] = [
  { to: '/', key: 'home', Icon: Home, end: true },
  { to: '/nearby', key: 'nearby', Icon: MapPin },
  { to: '/report', key: 'report', Icon: Plus, primary: true },
  { to: '/my-reports', key: 'myReports', Icon: ClipboardList },
  { to: '/profile', key: 'profile', Icon: User },
];

export function CitizenShell() {
  const { t } = useTranslation();
  return (
    <>
      <a href="#main" className="sr-only rounded-lg bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        {t('nav.skip')}
      </a>
      <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 pb-28 pt-6 outline-none">
        <Outlet />
      </main>
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 border-t border-[var(--line)] bg-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-xl items-end justify-around px-2">
          {ITEMS.map(({ to, key, Icon, end, primary }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-xs',
                    isActive ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-2)]',
                  )
                }
              >
                {primary ? (
                  <span className="grid size-11 place-items-center rounded-full bg-[var(--ink)] text-white">
                    <Icon aria-hidden className="size-6" />
                  </span>
                ) : (
                  <Icon aria-hidden className="size-6" />
                )}
                {t(`nav.${key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
