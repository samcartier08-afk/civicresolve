"use client";
import { useTranslation } from 'react-i18next';
import { useMyReports } from '../../lib/reports';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/States';

export function MyReportsPage() {
  const { t, i18n } = useTranslation('pages');
  const q = useMyReports();
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('myReports.title')}</h1>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState title={t('myReports.errorTitle')} hint={t('myReports.errorHint')} onRetry={() => void q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('myReports.emptyTitle')} hint={t('myReports.emptyHint')} action={<ButtonLink to="/report">{t('myReports.emptyAction')}</ButtonLink>} />
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={r.status} />
                  <span className="ml-auto text-sm text-[var(--ink-2)]">{date.format(new Date(r.createdAt))}</span>
                </div>
                <p className="mt-2 line-clamp-3">{r.description}</p>
                <p className="mt-1 text-sm text-[var(--ink-2)]">
                  {t('myReports.tracking', { id: r.trackingId })}
                  {r.incidentNumber && ` · ${t('myReports.incident', { n: r.incidentNumber })}`}
                </p>
              </li>
            ))}
          </ul>
          {q.hasNextPage && <Button intent="secondary" className="w-full" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t('myReports.loadMore')}</Button>}
        </>
      )}
    </div>
  );
}
