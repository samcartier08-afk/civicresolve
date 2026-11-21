"use client";
import { AdminOverview } from '../admin/AdminOverview';
import { useAdminOverview } from '../../lib/api';

export function AdminOverviewPage() {
  const q = useAdminOverview();
  return <AdminOverview kpis={q.data?.kpis} workload={q.data?.workload} loading={q.isPending} error={q.isError} onRetry={() => void q.refetch()} />;
}
