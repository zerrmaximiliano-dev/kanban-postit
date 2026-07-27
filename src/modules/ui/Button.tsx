'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { SpinnerIcon } from './icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-accent-500 shadow-elevation-sm hover:shadow-elevation-md',
  secondary:
    'bg-surface text-ink border border-border hover:border-border-strong focus-visible:ring-accent-500',
  ghost: 'bg-transparent text-ink-muted hover:bg-black/5 hover:text-ink focus-visible:ring-accent-500',
  danger:
    'bg-transparent text-danger border border-danger/30 hover:bg-danger-bg focus-visible:ring-danger',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, disabled, className = '', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && <SpinnerIcon className="h-4 w-4" />}
      {children}
    </button>
  );
});
