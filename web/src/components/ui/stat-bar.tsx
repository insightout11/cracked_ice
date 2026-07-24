import * as React from 'react';
import { cn } from '../../lib/utils';

type StatIntent = 'accent' | 'positive' | 'warning' | 'negative';

const intentClass: Record<StatIntent, string> = {
  accent: 'bg-accent shadow-accent',
  positive: 'bg-positive shadow-positive',
  warning: 'bg-warning',
  negative: 'bg-negative',
};

export interface StatBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  intent?: StatIntent;
  label?: React.ReactNode;
  displayValue?: React.ReactNode;
}

export function StatBar({ value, max, intent = 'accent', label, displayValue = value, className, ...props }: StatBarProps) {
  const percentage = max > 0 ? Math.min(Math.max(value / max, 0), 1) * 100 : 0;
  return (
    <div className={cn('min-w-24', className)} {...props}>
      <div className="mb-1 flex items-center justify-between gap-3 font-mono text-xs text-ink-dim">
        {label && <span>{label}</span>}
        <span className="text-ink">{displayValue}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-0" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className={cn('h-full rounded-full transition-[width] duration-300', intentClass[intent])} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
