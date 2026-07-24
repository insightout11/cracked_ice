import * as React from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export type ToastIntent = 'info' | 'success' | 'error';

const icons = { info: Info, success: CheckCircle2, error: CircleAlert };
const intentClasses = {
  info: 'border-accent bg-surface-raised text-accent',
  success: 'border-positive bg-positive-muted text-positive shadow-positive',
  error: 'border-negative bg-negative-muted text-negative',
};

export interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  intent?: ToastIntent;
  title?: React.ReactNode;
  onDismiss?: () => void;
}

export function Toast({ intent = 'info', title, onDismiss, className, children, ...props }: ToastProps) {
  const Icon = icons[intent];
  return (
    <div role={intent === 'error' ? 'alert' : 'status'} className={cn('flex max-w-sm items-start gap-3 rounded-lg border p-4 shadow-raised [backdrop-filter:var(--frost)]', intentClasses[intent], className)} {...props}>
      <Icon className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold text-ink">{title}</div>}
        <div className="text-sm text-ink-dim">{children}</div>
      </div>
      {onDismiss && <Button type="button" variant="ghost" size="icon" className="size-7 min-h-7 border-transparent" onClick={onDismiss} aria-label="Dismiss notification"><X size={16} /></Button>}
    </div>
  );
}

export function ToastRegion({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('fixed right-4 top-4 z-[9999] flex max-w-[calc(100vw-2rem)] flex-col gap-2', className)} {...props} />;
}
