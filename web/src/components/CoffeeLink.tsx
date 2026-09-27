import { Coffee } from 'lucide-react';
import { track } from '../lib/analytics';

interface CoffeeLinkProps {
  variant?: 'header' | 'footer' | 'blog';
  className?: string;
  onClick?: () => void;
}

export function CoffeeLink({ variant = 'header', className = '', onClick }: CoffeeLinkProps) {
  const linkClasses = 'inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-glass)] px-5 py-2.5 text-sm font-medium text-ink no-underline transition-all duration-300 hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] hover:shadow-[0_0_18px_var(--accent-muted)]';

  return (
    <a
      href="https://buymeacoffee.com/crackedicehockey"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        track('outbound_coffee', { placement: variant });
        onClick?.();
      }}
      className={`${linkClasses} ${className}`}
    >
      <Coffee size={18} aria-hidden="true" />
      <span>Support This Content</span>
    </a>
  );
}
