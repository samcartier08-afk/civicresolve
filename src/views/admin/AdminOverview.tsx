"use client";
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { KpiCard } from '../../components/admin/KpiCard';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import type { DeptWorkload } from '../../components/admin/WorkloadChart';

const WorkloadChart = lazy(() => import('../../components/admin/WorkloadChart')); // charts load on demand

export interface Kpis { reports: number; unique: number; open: number; critical: number; inProgress: number; resolved: number }
interface Props { kpis?: Kpis; workload?: DeptWorkload[]; loading?: boolean; error?: boolean; onRetry?: () => void }

/** Pure presentation: feed it the numbers from your existing SQL-backed endpoints. */
export function AdminOverview({ kpis, workload = [], loading, error, onRetry }: Props) {
  const { t } = useTranslation();
  if (error) return <ErrorState title={t('admin.errorTitle')} hint={t('admin.errorHint')} onRetry={onRetry} />;
  if (loading || !kpis) return <div role="status" aria-label={t('state.loading')} className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t('admin.overview')}</h1>
      <section aria-label={t('admin.overview')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label={t('admin.reports')} value={kpis.reports} />
        <KpiCard label={t('admin.unique')} value={kpis.unique} hint={t('admin.uniqueHint')} />
        <KpiCard label={t('admin.open')} value={kpis.open} tone="warn" />
        <KpiCard label={t('admin.critical')} value={kpis.critical} tone="crit" />
        <KpiCard label={t('admin.inProgress')} value={kpis.inProgress} tone="warn" />
        <KpiCard label={t('admin.resolved')} value={kpis.resolved} tone="ok" />
      </section>
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">{t('admin.workload')}</h2>
        {workload.length === 0 ? (
          <EmptyState title={t('admin.emptyTitle')} hint={t('admin.emptyHint')} />
        ) : (
          <Suspense fallback={<Skeleton className="h-80" />}><WorkloadChart data={workload} /></Suspense>
        )}
      </section>
    </div>
  );
}
