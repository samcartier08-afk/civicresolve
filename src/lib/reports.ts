import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { auth } from './firebase';
import { api, getDemoSessionHeaders } from './api';
import type { StatusKey, PriorityKey } from '../components/ui/StatusPill';
import type { ReportInput } from '../views/citizen/ReportWizard';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface ReportRow {
  id: string;
  trackingId: string;
  description: string;
  status: StatusKey;
  createdAt: string;
  incidentNumber: string | null;
}
export interface NearbyRow {
  id: string;
  number: string;
  title: string;
  status: StatusKey;
  priority: PriorityKey;
  reportCount: number;
  distanceM: number;
}
interface Page { items: ReportRow[]; nextCursor: string | null }

/** Only the signed-in citizen's own reports, straight from the backend. No placeholder data. */
export const useMyReports = () =>
  useInfiniteQuery({
    queryKey: ['my-reports'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<Page>(`/api/reports/mine${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => last.nextCursor,
  });

export const useNearby = (pos: { lat: number; lng: number } | null) =>
  useQuery({
    queryKey: ['nearby', pos?.lat.toFixed(3), pos?.lng.toFixed(3)],
    enabled: pos !== null,
    queryFn: () =>
      api<NearbyRow[]>(`/api/incidents/nearby?lat=${pos?.lat}&lng=${pos?.lng}&radius=1000`),
  });

/** multipart/form-data so photos upload with the report. The idempotency key makes retries safe. */
export async function createReport(data: ReportInput, key: string): Promise<{ trackingId: string }> {
  const body = new FormData();
  body.set('description', data.description);
  if (data.lat !== null && data.lng !== null) {
    body.set('lat', String(data.lat));
    body.set('lng', String(data.lng));
  }
  if (data.landmark) body.set('landmark', data.landmark);
  body.set('anonymous', String(data.anonymous));
  data.images.forEach((f) => body.append('images', f));
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  const demoHeaders = token ? {} : getDemoSessionHeaders();
  const res = await fetch(`${BASE}/api/reports`, {
    method: 'POST',
    body,
    headers: {
      'Idempotency-Key': key,
      ...(token ? { Authorization: `Bearer ${token}` } : demoHeaders),
    },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<{ trackingId: string }>;
}
