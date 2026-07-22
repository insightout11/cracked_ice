import * as React from 'react';
import { cn } from '../../lib/utils';

export function DataTable({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface-glass shadow-raised [backdrop-filter:var(--frost)]">
      <table className={cn('w-full border-collapse text-left text-sm text-ink', className)} {...props} />
    </div>
  );
}

export function DataTableHeader({ sticky = false, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return <thead className={cn('bg-surface-2 text-xs uppercase tracking-wider text-ink-dim', sticky && 'sticky top-0 z-10', className)} {...props} />;
}

export function DataTableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-line [&>tr:nth-child(even)]:bg-surface-2/60 [&>tr]:transition-colors [&>tr:hover]:bg-accent-muted', className)} {...props} />;
}

export function DataTableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-3 font-semibold', className)} {...props} />;
}

export function DataTableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3', className)} {...props} />;
}
