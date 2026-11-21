"use client";
import type { ReactNode } from 'react';
import { Inbox, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn('animate-pulse rounded-xl bg-[#e9ebe7] motion-reduce:animate-none', className)} />
);

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('state.loading')} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-[88px]" />)}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--line)] px-6 py-12 text-center">
      <Inbox aria-hidden className="size-8 text-[var(--ink-2)]" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-[var(--ink-2)]">{hint}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, hint, onRetry }: { title: string; hint: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--crit-bg)] px-6 py-10 text-center">
      <WifiOff aria-hidden className="size-8 text-[var(--crit)]" />
      <h2 className="text-lg font-semibold text-[var(--crit)]">{title}</h2>
      <p className="max-w-sm text-[var(--ink)]">{hint}</p>
      {onRetry && <Button intent="secondary" onClick={onRetry} className="mt-2">{t('state.retry')}</Button>}
    </div>
  );
}
