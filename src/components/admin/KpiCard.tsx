"use client";
import NumberFlow from '@number-flow/react';
import { AlertTriangle, CheckCircle2, CircleDot, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

const TONE = {
  neutral: ['text-[var(--ink-2)]', CircleDot],
  ok: ['text-[var(--ok)]', CheckCircle2],
  warn: ['text-[var(--warn)]', Wrench],
  crit: ['text-[var(--crit)]', AlertTriangle],
} as const satisfies Record<string, readonly [string, LucideIcon]>;

export function KpiCard({ label, value, tone = 'neutral', hint }: { label: string; value: number; tone?: keyof typeof TONE; hint?: string }) {
  const [color, Icon] = TONE[tone];
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
      <p className={cn('flex items-center gap-2 text-sm font-medium', color)}>
        <Icon aria-hidden className="size-4" />
        {label}
      </p>
      <NumberFlow value={value} className="mt-1 block text-3xl font-semibold tabular-nums" />
      {hint && <p className="mt-1 text-sm text-[var(--ink-2)]">{hint}</p>}
    </div>
  );
}
