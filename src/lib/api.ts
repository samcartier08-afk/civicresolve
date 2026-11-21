import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { auth } from './firebase';
import type { IncidentRow } from '../components/authority/IncidentQueue';
import type { DeptWorkload } from '../components/admin/WorkloadChart';
import type { Kpis } from '../views/admin/AdminOverview';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Authenticated fetch: attaches the Firebase ID token. The backend is the source of truth for roles. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

// ASSUMED endpoints: adjust the paths and shapes here if your backend differs.
interface Page { items: IncidentRow[]; nextCursor: string | null }

export const useIncidents = () =>
  useInfiniteQuery({
    queryKey: ['incidents'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api<Page>(`/api/incidents${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => last.nextCursor,
  });

export const useIncident = (id: string) => useQuery({ queryKey: ['incident', id], queryFn: () => api<IncidentRow>(`/api/incidents/${id}`) });

export const useAdminOverview = () =>
  useQuery({ queryKey: ['admin-overview'], queryFn: () => api<{ kpis: Kpis; workload: DeptWorkload[] }>('/api/admin/overview') });
