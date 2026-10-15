'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  // Kotiz Design System colors
  const variantClasses = {
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    danger: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    info: 'bg-[#E0F2FE] text-[var(--color-secondary)]',
    default: 'bg-[var(--color-border-light)] text-[var(--color-text-muted)]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-[var(--radius-badge)] text-sm font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
