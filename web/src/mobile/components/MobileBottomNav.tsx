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
      className="flex-shrink-0 bg-slate-900 border-t border-slate-700"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '64px' }}
    >
      <div style={{ display: 'flex', height: '64px', alignItems: 'stretch', justifyContent: 'space-around' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === 'gaps' && gapCount && gapCount > 0;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                position: 'relative',
                color: isActive ? '#22d3ee' : '#94a3b8',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div style={{ position: 'relative' }}>
                <Icon style={{ width: '24px', height: '24px' }} />
                {showBadge && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '9999px',
                    backgroundColor: '#f97316',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}>
                    {gapCount > 99 ? '99+' : gapCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 500 }}>
                {tab.label}
              </span>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '48px',
                  height: '2px',
                  backgroundColor: '#22d3ee',
                  borderRadius: '9999px',
                }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
