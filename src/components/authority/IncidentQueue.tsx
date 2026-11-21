"use client";
import { useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Command } from 'cmdk';
import { MapPin, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PriorityTag, StatusPill, type PriorityKey, type StatusKey } from '../ui/StatusPill';
import { EmptyState, ErrorState, ListSkeleton } from '../ui/States';
import { useUi } from '../../store/ui';

export interface IncidentRow {
  id: string;
  number: string;
  title: string;
  status: StatusKey;
  priority: PriorityKey;
  department: string;
  reportCount: number;
  ageHours: number;
  ward?: string;
}
interface Props {
  incidents: IncidentRow[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onOpen: (id: string) => void;
  onEndReached?: () => void;
}

export function IncidentQueue({ incidents, loading, error, onRetry, onOpen, onEndReached }: Props) {
  const { t, i18n } = useTranslation();
  const { paletteOpen, setPalette } = useUi();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setPalette(!useUi.getState().paletteOpen); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [setPalette]);

  const age = (h: number) => {
    const safeH = Number.isFinite(h) ? Math.max(0, Math.round(h)) : 0;
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    return safeH < 24 ? rtf.format(-safeH, 'hour') : rtf.format(-Math.round(safeH / 24), 'day');
  };

  if (loading) return <ListSkeleton />;
  if (error) return <ErrorState title={t('queue.errorTitle')} hint={t('queue.errorHint')} onRetry={onRetry} />;
  if (!incidents.length) return <EmptyState title={t('queue.emptyTitle')} hint={t('queue.emptyHint')} />;

  return (
    <>
      <Virtuoso
        style={{ height: 'calc(100dvh - 12rem)' }}
        data={incidents}
        endReached={onEndReached}
        computeItemKey={(_, r) => r.id}
        itemContent={(_, r) => (
          <div className="pb-3">
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              className="w-full rounded-2xl border border-[var(--line)] bg-white p-4 text-left [@media(hover:hover)]:hover:border-[#c9cdd3]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <PriorityTag priority={r.priority} />
                <StatusPill status={r.status} />
                <span className="ml-auto text-sm text-[var(--ink-2)]">{r.number}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold">{r.title}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--ink-2)]">
                <span>{r.department}</span>
                {r.ward && <span className="inline-flex items-center gap-1"><MapPin aria-hidden className="size-3.5" />{r.ward}</span>}
                <span className="inline-flex items-center gap-1"><Users aria-hidden className="size-3.5" />{t('queue.reports', { count: r.reportCount })}</span>
                <span>{age(r.ageHours)}</span>
              </p>
            </button>
          </div>
        )}
      />

      <Command.Dialog open={paletteOpen} onOpenChange={setPalette} label={t('queue.search')} className="fixed left-1/2 top-24 z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl">
        <Command.Input placeholder={t('queue.searchHint')} className="w-full border-b border-[var(--line)] px-4 py-3 outline-none" />
        <Command.List className="max-h-80 overflow-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-[var(--ink-2)]">{t('queue.emptyTitle')}</Command.Empty>
          {incidents.map((r) => (
            <Command.Item
              key={r.id}
              value={`${r.number} ${r.title} ${r.department}`}
              onSelect={() => { setPalette(false); onOpen(r.id); }}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 aria-selected:bg-[var(--ai-bg)]"
            >
              <span className="truncate">{r.title}</span>
              <span className="shrink-0 text-sm text-[var(--ink-2)]">{r.number}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
