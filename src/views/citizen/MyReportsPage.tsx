"use client";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { useMyReports } from '../../lib/reports';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/States';

export function MyReportsPage() {
  const { t, i18n } = useTranslation('pages');
  const qc = useQueryClient();
  const q = useMyReports();
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  const handleCitizenVerify = async (
    incidentId: string,
    citizenAction: 'VERIFY_RESOLUTION' | 'DISPUTE_REOPEN'
  ) => {
    setBusyId(incidentId);
    try {
      const res = await fetch(`/api/issues/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citizenAction }),
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success(
        citizenAction === 'VERIFY_RESOLUTION'
          ? 'Thank you — confirmed as fixed.'
          : 'Reopened and sent back to the department.'
      );
      void qc.invalidateQueries({ queryKey: ['my-reports'] });
    } catch {
      toast.error('Could not update verification status. Try again.');
    } finally {
      setBusyId(null);
    }
  };

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
            {rows.map((r) => {
              const targetId = r.incidentNumber || r.trackingId;
              return (
                <li key={r.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={r.status} />
                    <span className="ml-auto text-sm text-[var(--ink-2)]">{date.format(new Date(r.createdAt))}</span>
                  </div>
                  <p className="line-clamp-3">{r.description}</p>
                  <p className="text-sm text-[var(--ink-2)]">
                    {t('myReports.tracking', { id: r.trackingId })}
                    {r.incidentNumber && ` · ${t('myReports.incident', { n: r.incidentNumber })}`}
                  </p>
                  {r.status === 'resolved' && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        type="button"
                        loading={busyId === targetId}
                        onClick={() => void handleCitizenVerify(targetId, 'VERIFY_RESOLUTION')}
                      >
                        <CheckCircle2 aria-hidden className="size-4" />
                        Confirm it&apos;s fixed
                      </Button>
                      <Button
                        type="button"
                        intent="secondary"
                        disabled={busyId === targetId}
                        onClick={() => void handleCitizenVerify(targetId, 'DISPUTE_REOPEN')}
                      >
                        <RotateCcw aria-hidden className="size-4" />
                        It&apos;s still broken
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {q.hasNextPage && <Button intent="secondary" className="w-full" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t('myReports.loadMore')}</Button>}
        </>
      )}
    </div>
  );
}
