'use client';

import { ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'accent' | 'danger';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-page text-ink-muted border border-border',
  accent: 'bg-accent-100 text-accent-600',
  danger: 'bg-danger-bg text-danger',
};

export function Badge({ variant = 'neutral', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
