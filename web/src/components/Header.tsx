import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { PRIMARY_NAV_ITEMS } from '../lib/navigation';
import { CoffeeLink } from './CoffeeLink';
import { MobileMenu } from './MobileMenu';
import { Button } from './ui/button';
import { LeagueWorkspaceControl } from './league/LeagueWorkspaceControl';
import { AccountControl } from './account/AccountControl';

export function Header() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasDedicatedMobileShell = location.pathname === '/team';

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header className={`hero-header ${hasDedicatedMobileShell ? 'mobile-team-global-header' : ''}`}>
        <div className="header-overlay flex items-center">
          <div className="relative z-10 mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
            <Link to="/" className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Cracked Ice home">
              <img
                src="/logo-horizontal.svg"
                alt="Cracked Ice"
                className="h-auto max-h-9 w-auto max-w-[calc(100vw-6rem)] sm:h-10 sm:max-h-none sm:max-w-none"
              />
            </Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
              {PRIMARY_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => [
                    'rounded-md border px-4 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? 'border-accent bg-surface-raised text-accent shadow-accent'
                      : 'border-transparent text-ink-mute hover:border-line hover:bg-surface-glass hover:text-ink',
                  ].join(' ')}
                >
                  {item.label}
                </NavLink>
              ))}
              <LeagueWorkspaceControl />
              <AccountControl />
              <CoffeeLink variant="header" />
            </nav>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu aria-hidden="true" className="size-6" />
            </Button>
          </div>
        </div>
      </header>
      <div id="mobile-navigation" className={hasDedicatedMobileShell ? 'hidden lg:block' : undefined}>
        <MobileMenu open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      </div>
    </>
  );
}
