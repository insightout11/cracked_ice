import React from 'react';
import { cn } from '../lib/utils';

interface CardProps {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function Card({ active, children, className = '', onClick, onKeyDown }: CardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onClick?.();
    }
    onKeyDown?.(e);
  };

  return (
    <section 
      className={cn(
        'rounded-lg border border-line bg-surface-glass text-ink shadow-raised [backdrop-filter:var(--frost)]',
        active && 'border-accent shadow-accent',
        className,
      )}
      tabIndex={onClick ? 0 : undefined}
      role="region" 
      aria-live="polite"
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : onKeyDown}
    >
      {children}
    </section>
  );
}
