"use client";
import { cva } from 'class-variance-authority';
import {
  CheckCheck, CheckCircle2, Eye, Flame, Inbox, MessageCircleQuestion, RotateCcw, Sparkles,
  TrendingUp, UserCheck, ThumbsUp, Wrench, XCircle, AlertTriangle, CircleDot, ArrowDown,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const pill = cva('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium', {
  variants: {
    tone: {
      ok: 'bg-[var(--ok-bg)] text-[var(--ok)]',
      warn: 'bg-[var(--warn-bg)] text-[var(--warn)]',
      crit: 'bg-[var(--crit-bg)] text-[var(--crit)]',
      ai: 'bg-[var(--ai-bg)] text-[var(--ai)]',
      neutral: 'bg-[#eef0f2] text-[var(--ink-2)]',
    },
  },
});
type Tone = 'ok' | 'warn' | 'crit' | 'ai' | 'neutral';

const STATUS = {
  reported: ['ai', Inbox], ai_analyzed: ['ai', Sparkles], under_review: ['warn', Eye],
  awaiting_info: ['warn', MessageCircleQuestion], assigned: ['ai', UserCheck], accepted: ['ai', ThumbsUp],
  in_progress: ['warn', Wrench], escalated: ['crit', TrendingUp], reopened: ['crit', RotateCcw],
  rejected: ['neutral', XCircle], resolved: ['ok', CheckCircle2], closed: ['ok', CheckCheck],
} as const satisfies Record<string, readonly [Tone, LucideIcon]>;

const PRIORITY = {
  critical: ['crit', Flame], high: ['warn', AlertTriangle], medium: ['neutral', CircleDot], low: ['neutral', ArrowDown],
} as const satisfies Record<string, readonly [Tone, LucideIcon]>;

export type StatusKey = keyof typeof STATUS;
export type PriorityKey = keyof typeof PRIORITY;

/** Colour is never the only signal: every pill carries an icon and a text label. */
export function StatusPill({ status }: { status: StatusKey }) {
  const { t } = useTranslation();
  const [tone, Icon] = STATUS[status];
  return (
    <span className={pill({ tone })}>
      <Icon aria-hidden className="size-3.5" />
      {t(`status.${status}`)}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: PriorityKey }) {
  const { t } = useTranslation();
  const [tone, Icon] = PRIORITY[priority];
  return (
    <span className={pill({ tone })}>
      <Icon aria-hidden className="size-3.5" />
      {t(`priority.${priority}`)}
    </span>
  );
}
