"use client";
import { useState } from 'react';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNearby } from '../../lib/reports';
import { PriorityTag, StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/States';

export function NearbyPage() {
  const { t, i18n } = useTranslation('pages');
  const { t: tc } = useTranslation();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const q = useNearby(pos);

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error(t('nearby.geoError'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => { setLocating(false); toast.error(t('nearby.geoError')); },
      { timeout: 10_000 },
    );
  };
  const dist = (m: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'unit', unit: m < 1000 ? 'meter' : 'kilometer', maximumFractionDigits: m < 1000 ? 0 : 1 }).format(m < 1000 ? m : m / 1000);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('nearby.title')}</h1>
      {!pos ? (
        <section className="space-y-3">
          <p>{t('nearby.intro')}</p>
          <Button onClick={locate} loading={locating}><MapPin aria-hidden className="size-4" />{locating ? t('nearby.locating') : t('nearby.button')}</Button>
          <p className="text-sm text-[var(--ink-2)]">{t('nearby.consent')}</p>
        </section>
      ) : q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState title={t('nearby.errorTitle')} hint={t('nearby.errorHint')} onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState title={t('nearby.emptyTitle')} hint={t('nearby.emptyHint')} />
      ) : (
        <ul className="space-y-3">
          {q.data.map((r) => (
            <li key={r.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2"><PriorityTag priority={r.priority} /><StatusPill status={r.status} /></div>
              <h2 className="mt-2 text-base font-semibold">{r.title}</h2>
              <p className="text-sm text-[var(--ink-2)]">{t('nearby.away', { distance: dist(r.distanceM) })} · {tc('queue.reports', { count: r.reportCount })}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
