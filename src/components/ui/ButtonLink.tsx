"use client";
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../../lib/cn';

export function ButtonLink({ intent = 'primary', className, ...rest }: LinkProps & { intent?: 'primary' | 'secondary' }) {
  return (
    <Link
      className={cn(
        'inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-base font-medium',
        intent === 'primary' ? 'bg-[var(--ink)] text-white' : 'border border-[var(--line)] bg-white text-[var(--ink)]',
        className,
      )}
      {...rest}
    />
  );
}
