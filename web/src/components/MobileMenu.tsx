import { useEffect } from 'react';
import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { PRIMARY_NAV_ITEMS } from '../lib/navigation';
import { CoffeeLink } from './CoffeeLink';
import { Button } from './ui/button';
import { LeagueWorkspaceControl } from './league/LeagueWorkspaceControl';
import { AccountControl } from './account/AccountControl';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-0/80 px-4 pt-4 backdrop-blur-md md:hidden" role="dialog" aria-modal="true" aria-label="Site navigation" onClick={onClose}>
      <div className="mx-auto max-w-md rounded-lg border border-line bg-surface-raised p-4 shadow-raised" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-accent">Navigation</p>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close navigation">
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <div className="flex flex-col gap-2" role="navigation" aria-label="Mobile navigation">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) => [
                'rounded-md border px-4 py-3 text-base font-semibold transition-colors',
                isActive
                  ? 'border-accent bg-accent/10 text-accent shadow-accent'
                  : 'border-line bg-surface-glass text-ink hover:border-line-strong hover:bg-surface-2',
              ].join(' ')}
            >
              {item.label}
            </NavLink>
          ))}
          <LeagueWorkspaceControl mobile />
          <AccountControl mobile />
          <div className="mt-2 flex justify-center rounded-md border border-line bg-surface-glass p-3">
            <CoffeeLink variant="blog" onClick={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}
