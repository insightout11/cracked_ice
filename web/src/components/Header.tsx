import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { PRIMARY_NAV_ITEMS } from '../lib/navigation';
import { MobileMenu } from './MobileMenu';
import { Button } from './ui/button';
import { LeagueWorkspaceControl } from './league/LeagueWorkspaceControl';
import { AccountControl } from './account/AccountControl';
import { ToolsMenu } from './ToolsMenu';
import { rootShowsHome } from '../lib/navigation';

export function Header() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header className="site-header relative z-50 border-b border-line bg-surface-0/95 [backdrop-filter:var(--frost)]">
        <div className="mx-auto flex min-h-[72px] w-full max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
            <Link to="/" className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Cracked Ice home">
              <img
                src="/logo-horizontal.svg"
                alt="Cracked Ice"
                className="h-auto max-h-9 w-auto max-w-[calc(100vw-6rem)] sm:h-10 sm:max-h-none sm:max-w-none"
              />
            </Link>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
              {PRIMARY_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => [
                    'inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold transition-colors',
                    isActive && (item.to !== '/' || rootShowsHome(location.search))
                      ? 'border-accent bg-surface-raised text-accent shadow-accent'
                      : 'border-transparent text-ink-mute hover:border-line hover:bg-surface-glass hover:text-ink',
                  ].join(' ')}
                >
                  {item.label}
                </NavLink>
              ))}
              <ToolsMenu />
              <LeagueWorkspaceControl />
              <AccountControl />
            </nav>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu aria-hidden="true" className="size-6" />
            </Button>
        </div>
      </header>
      <div id="mobile-navigation">
        <MobileMenu open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      </div>
    </>
  );
}
