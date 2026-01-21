import { Users, Search, BarChart3, Settings } from 'lucide-react';

export type MobileTab = 'lineup' | 'players' | 'gaps' | 'settings';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  gapCount?: number;
}

const tabs: { id: MobileTab; label: string; icon: typeof Users }[] = [
  { id: 'lineup', label: 'Lineup', icon: Users },
  { id: 'players', label: 'Players', icon: Search },
  { id: 'gaps', label: 'Gaps', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/**
 * MobileBottomNav - Bottom tab navigation bar
 *
 * Fixed to bottom of screen with 4 tabs:
 * - Lineup: Main roster management
 * - Players: Search and add players
 * - Gaps: Roster gap analysis
 * - Settings: League configuration
 */
export function MobileBottomNav({ activeTab, onTabChange, gapCount }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === 'gaps' && gapCount && gapCount > 0;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-1
                transition-colors duration-150 relative
                ${isActive
                  ? 'text-cyan-400'
                  : 'text-slate-400 active:text-slate-300'
                }
              `}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon
                  className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : ''}`}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold">
                    {gapCount > 99 ? '99+' : gapCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
