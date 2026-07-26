import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AccountControl } from '../../components/account/AccountControl';

interface MobileHeaderProps {
  leagueName?: string;
  onSettingsClick?: () => void;
}

/** Product-level mobile header shared by every My Team tab. */
export function MobileHeader({ leagueName, onSettingsClick }: MobileHeaderProps) {
  return (
    <header className="safe-area-top sticky top-0 z-40 border-b border-line bg-surface-2/95 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3">
        <Link
          to="/"
          className="inline-flex shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Cracked Ice home"
        >
          <img src="/logo-mark.svg" alt="" className="size-8 object-contain" />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="scoreboard-text text-[9px] text-accent">MY TEAM</p>
          <h1 className="truncate text-sm font-semibold text-ink">{leagueName || 'My League'}</h1>
        </div>

        <AccountControl />
        <button
          type="button"
          onClick={onSettingsClick}
          className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-ink-dim transition-colors hover:border-accent hover:text-accent"
          aria-label="League settings"
        >
          <Settings className="size-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
