"use client";
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { useIncident, useUpdateIncident } from '../../lib/api';
import { useAuth } from '../../auth/AuthProvider';
import { PriorityTag, StatusPill, type PriorityKey, type StatusKey } from '../../components/ui/StatusPill';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { Button } from '../../components/ui/Button';
import { MUNICIPAL_DEPARTMENTS } from '../../lib/civic-schemas';

const STATUS_OPTIONS: StatusKey[] = [
  'reported', 'ai_analyzed', 'under_review', 'awaiting_info',
  'assigned', 'accepted', 'in_progress', 'escalated',
  'reopened', 'rejected', 'resolved', 'closed',
];

const PRIORITY_OPTIONS: PriorityKey[] = ['critical', 'high', 'medium', 'low'];

export function IncidentDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation('portal');
  const { t: tq } = useTranslation();
  const { me } = useAuth();
  const q = useIncident(id);
  const update = useUpdateIncident();

  const [draftStatus, setDraftStatus] = useState<StatusKey | null>(null);
  const [draftPriority, setDraftPriority] = useState<PriorityKey | null>(null);
  const [draftDept, setDraftDept] = useState<string | null>(null);
  const [publicComment, setPublicComment] = useState('');
  const [draftPhotoUrl, setDraftPhotoUrl] = useState<string | null>(null);

  const back = me?.role === 'admin' ? '/admin/incidents' : '/authority';
  if (q.isPending) return <Skeleton className="h-40" />;
  if (q.isError) return <ErrorState title={t('detailErrorTitle')} hint={t('detailErrorHint')} onRetry={() => void q.refetch()} />;

  const r = q.data;
  const status = draftStatus ?? r.status;
  const priority = draftPriority ?? r.priority;
  const department = draftDept ?? r.department;
  const resolutionPhotoUrl = draftPhotoUrl ?? r.resolutionPhotoUrl;

  const handlePhotoSelect = (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error(tq('errors.photoType'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tq('errors.photoSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraftPhotoUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: r.id,
        status,
        priority,
        department,
        publicComment: publicComment.trim() || undefined,
        resolutionPhotoUrl,
      });
      setPublicComment('');
      toast.success('Incident updated');
    } catch {
      toast.error('Could not update incident. Try again.');
    }
  };

  return (
    <article className="space-y-6">
      <Link to={back} className="inline-flex min-h-11 items-center font-medium text-[var(--ai)] underline">
        {t('backToList')}
      </Link>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityTag priority={r.priority} />
          <StatusPill status={r.status} />
          <span className="text-sm text-[var(--ink-2)]">{r.number}</span>
        </div>
        <h1 className="text-2xl font-semibold">{r.title}</h1>
        {r.description && <p className="text-[var(--ink)]">{r.description}</p>}
        <p className="text-sm text-[var(--ink-2)]">
          {r.department} · {tq('queue.reports', { count: r.reportCount })}
          {r.location ? ` · ${r.location}` : ''}
        </p>
        {r.resolutionNote && (
          <p className="rounded-xl bg-[var(--bg)] p-3 text-sm text-[var(--ink)]">
            Latest update: {r.resolutionNote}
          </p>
        )}
        {resolutionPhotoUrl && (
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--ink-2)]">Resolution evidence photo</p>
            <img
              src={resolutionPhotoUrl}
              alt={`Resolution evidence for ${r.number}`}
              width={240}
              height={160}
              className="h-40 w-60 rounded-xl border border-[var(--line)] object-cover"
            />
          </div>
        )}
      </div>

      {/* Department & Admin Portal Actions */}
      <form onSubmit={handleSave} className="rounded-2xl border border-[var(--line)] bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Manage incident</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="inc-status" className="mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              id="inc-status"
              value={status}
              onChange={(e) => setDraftStatus(e.target.value as StatusKey)}
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {tq(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inc-priority" className="mb-1 block text-sm font-medium">
              Priority
            </label>
            <select
              id="inc-priority"
              value={priority}
              onChange={(e) => setDraftPriority(e.target.value as PriorityKey)}
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {tq(`priority.${p}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="inc-dept" className="mb-1 block text-sm font-medium">
            Assign department
          </label>
          <select
            id="inc-dept"
            value={department}
            onChange={(e) => setDraftDept(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3"
          >
            {MUNICIPAL_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="inc-comment" className="mb-1 block text-sm font-medium">
            Public update note
          </label>
          <textarea
            id="inc-comment"
            rows={3}
            value={publicComment}
            onChange={(e) => setPublicComment(e.target.value)}
            placeholder="Share work progress or resolution details visible to citizens..."
            className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-medium">
            <Camera aria-hidden className="size-4" />
            Attach resolution photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
            />
          </label>

          <Button type="submit" loading={update.isPending} className="ml-auto">
            Save update
          </Button>
        </div>
      </form>
    </article>
  );
}
