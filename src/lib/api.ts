import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auth } from './firebase';
import type { IncidentRow } from '../components/authority/IncidentQueue';
import type { DeptWorkload } from '../components/admin/WorkloadChart';
import type { Kpis } from '../views/admin/AdminOverview';
import type { PriorityKey, StatusKey } from '../components/ui/StatusPill';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface IncidentDetailRow extends IncidentRow {
  description?: string;
  location?: string;
  resolutionNote?: string;
  resolutionPhotoUrl?: string;
}

export function getDemoSessionHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('civicresolve_demo_user');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { uid?: string; role?: string; name?: string };
    const headers: Record<string, string> = {};
    if (parsed.uid) headers['x-demo-uid'] = parsed.uid;
    if (parsed.role) headers['x-demo-role'] = parsed.role;
    if (parsed.name) headers['x-demo-name'] = parsed.name;
    return headers;
  } catch {
    return {};
  }
}

/** Authenticated fetch: attaches Firebase ID token (or local session headers when Firebase config is absent). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  const demoHeaders = token ? {} : getDemoSessionHeaders();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : demoHeaders),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

interface Page { items: IncidentRow[]; nextCursor: string | null }

export const useIncidents = () =>
  useInfiniteQuery({
    queryKey: ['incidents'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<Page>(`/api/incidents${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => last.nextCursor,
  });

export const useIncident = (id: string) =>
  useQuery({
    queryKey: ['incident', id],
    queryFn: () => api<IncidentDetailRow>(`/api/incidents/${id}`),
  });

export interface IncidentUpdateInput {
  id: string;
  status?: StatusKey;
  priority?: PriorityKey;
  department?: string;
  publicComment?: string;
  resolutionPhotoUrl?: string;
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: IncidentUpdateInput) =>
      api<IncidentDetailRow>(`/api/incidents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['incident', updated.id] });
      void qc.invalidateQueries({ queryKey: ['incidents'] });
      void qc.invalidateQueries({ queryKey: ['admin-overview'] });
      void qc.invalidateQueries({ queryKey: ['my-reports'] });
    },
  });
}

export const useAdminOverview = () =>
  useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api<{ kpis: Kpis; workload: DeptWorkload[] }>('/api/admin/overview'),
  });
