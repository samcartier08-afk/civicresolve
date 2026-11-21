"use client";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IncidentQueue } from '../../components/authority/IncidentQueue';
import { useIncidents } from '../../lib/api';
import { useAuth } from '../../auth/AuthProvider';

/** Shared by the department portal (own department) and admin portal (all). The backend decides the scope from the token. */
export function IncidentsPage() {
  const { t } = useTranslation('portal');
  const nav = useNavigate();
  const { me } = useAuth();
  const q = useIncidents();
  const base = me?.role === 'admin' ? '/admin/incidents' : '/authority';
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{me?.role === 'admin' ? t('allIncidents') : t('queue')}</h1>
      <IncidentQueue
        incidents={q.data?.pages.flatMap((p) => p.items) ?? []}
        loading={q.isPending}
        error={q.isError}
        onRetry={() => void q.refetch()}
        onOpen={(id) => nav(`${base}/${id}`)}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); }}
      />
    </div>
  );
}
