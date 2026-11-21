"use client";
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

const button = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium ' +
    'transition-[background-color,transform] duration-150 active:scale-[0.98] ' +
    'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100',
  {
    variants: {
      intent: {
        primary: 'bg-[var(--ink)] text-white [@media(hover:hover)]:hover:bg-[#1c2c46]',
        secondary: 'border border-[var(--line)] bg-white text-[var(--ink)] [@media(hover:hover)]:hover:bg-[#f1f2f0]',
        ghost: 'text-[var(--ink)] [@media(hover:hover)]:hover:bg-[#eceeea]',
        danger: 'bg-[var(--crit)] text-white [@media(hover:hover)]:hover:bg-[#991b1b]',
      },
      size: { md: '', lg: 'min-h-12 px-6 text-base', icon: 'w-11 px-0' },
    },
    defaultVariants: { intent: 'primary', size: 'md' },
  },
);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ intent, size, loading, disabled, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(button({ intent, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
