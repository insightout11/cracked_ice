import { Coffee } from 'lucide-react';
import { track } from '../lib/analytics';

interface CoffeeLinkProps {
  variant?: 'header' | 'footer' | 'blog';
  className?: string;
  onClick?: () => void;
}

export function CoffeeLink({ variant = 'header', className = '', onClick }: CoffeeLinkProps) {
  const baseClasses = 'inline-flex items-center gap-2 font-medium transition-all duration-300 no-underline';

  const variantClasses = {
    header: 'px-4 py-2 rounded-lg text-sm text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[var(--surface-raised)] hover:shadow-[0_0_18px_var(--warning-muted)]',
    footer: 'px-6 py-3 rounded-xl text-base bg-gradient-to-r from-warning to-warning text-ink font-bold border-2 border-warning shadow-xl hover:from-warning hover:to-warning hover:shadow-[0_0_24px_var(--warning-muted)] transform hover:scale-105',
    blog: 'px-5 py-2.5 rounded-lg text-sm bg-[var(--surface-glass)] border border-[var(--line)] text-ink hover:bg-[var(--surface-raised)] hover:border-[var(--accent)] hover:shadow-[0_0_18px_var(--accent-muted)] font-medium'
  };

  const CoffeeIcon = () => <Coffee size={18} className={variant === 'footer' ? 'animate-pulse' : ''} aria-hidden="true" />;

  const getText = () => {
    switch (variant) {
      case 'header':
        return 'Fuel the Analytics';
      case 'footer':
        return 'Buy Me a Coffee';
      case 'blog':
        return 'Support This Content';
      default:
        return 'Buy Me a Coffee';
    }
  };

  return (
    <a
      href="https://buymeacoffee.com/crackedicehockey"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        track('outbound_coffee', { placement: variant });
        onClick?.();
      }}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      <CoffeeIcon />
      <span>{getText()}</span>
    </a>
  );
}
