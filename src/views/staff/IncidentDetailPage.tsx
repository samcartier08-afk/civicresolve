"use client";
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIncident } from '../../lib/api';
import { useAuth } from '../../auth/AuthProvider';
import { PriorityTag, StatusPill } from '../../components/ui/StatusPill';
import { ErrorState, Skeleton } from '../../components/ui/States';

/** Read-only summary. Assign / status / resolution actions are not built yet. */
export function IncidentDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation('portal');
  const { t: tq } = useTranslation();
  const { me } = useAuth();
  const q = useIncident(id);
  const back = me?.role === 'admin' ? '/admin/incidents' : '/authority';
  if (q.isPending) return <Skeleton className="h-40" />;
  if (q.isError) return <ErrorState title={t('detailErrorTitle')} hint={t('detailErrorHint')} onRetry={() => void q.refetch()} />;
  const r = q.data;
  return (
    <article className="space-y-4">
      <Link to={back} className="inline-flex min-h-11 items-center font-medium text-[var(--ai)] underline">{t('backToList')}</Link>
      <div className="flex flex-wrap items-center gap-2"><PriorityTag priority={r.priority} /><StatusPill status={r.status} /><span className="text-sm text-[var(--ink-2)]">{r.number}</span></div>
      <h1 className="text-2xl font-semibold">{r.title}</h1>
      <p className="text-[var(--ink-2)]">{r.department} · {tq('queue.reports', { count: r.reportCount })}</p>
    </article>
  );
}
