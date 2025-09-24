interface CoffeeLinkProps {
  variant?: 'header' | 'footer' | 'blog';
  className?: string;
  onClick?: () => void;
}

export function CoffeeLink({ variant = 'header', className = '', onClick }: CoffeeLinkProps) {
  const baseClasses = 'inline-flex items-center gap-2 font-medium transition-all duration-300 no-underline';

  const variantClasses = {
    header: 'px-4 py-2 rounded-lg text-sm text-[var(--ci-muted)] hover:text-[var(--ci-white)] hover:bg-[var(--glass-fill-hover)] hover:shadow-[0_0_18px_rgba(255,215,106,0.3)]',
    footer: 'px-6 py-3 rounded-xl text-base bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold border-2 border-orange-300 shadow-xl hover:from-orange-400 hover:to-orange-500 hover:shadow-[0_0_24px_rgba(255,165,0,0.6)] transform hover:scale-105',
    blog: 'px-5 py-2.5 rounded-lg text-sm bg-[var(--glass-fill)] border border-[var(--glass-border)] text-gray-800 hover:bg-[var(--glass-fill-hover)] hover:border-[var(--laser-cyan)] hover:shadow-[0_0_18px_rgba(94,245,255,0.2)] font-medium'
  };

  const CoffeeIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className={variant === 'footer' ? 'animate-pulse' : ''}
    >
      {/* Hockey puck base */}
      <ellipse cx="12" cy="20" rx="8" ry="2" fill="currentColor" opacity="0.3"/>

      {/* Coffee cup */}
      <path
        d="M4 7h12c1 0 2 1 2 2v6c0 2-2 4-4 4H8c-2 0-4-2-4-4V9c0-1 1-2 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Coffee handle */}
      <path
        d="M16 10a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Steam/energy lines */}
      <path d="M8 3v2M12 3v2M16 3v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

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
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      <CoffeeIcon />
      <span>{getText()}</span>
    </a>
  );
}