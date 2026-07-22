import * as React from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  intent?: 'neutral' | 'negative';
}

export function EmptyState({ title, description, icon, action, intent = 'neutral', className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('rounded-lg border p-6 text-center [backdrop-filter:var(--frost)]', intent === 'negative' ? 'border-negative bg-negative-muted' : 'border-line bg-surface-glass', className)} {...props}>
      <div className={cn('mx-auto mb-3 flex size-11 items-center justify-center rounded-full', intent === 'negative' ? 'bg-negative-muted text-negative' : 'bg-accent-muted text-accent')} aria-hidden="true">
        {icon ?? <CircleAlert size={22} />}
      </div>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {description && <div className="mx-auto mt-2 max-w-xl text-sm text-ink-dim">{description}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
