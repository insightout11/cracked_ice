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
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: '#0f172a',
        borderTop: '1px solid #334155',
        padding: '8px 0',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              type="button"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                color: isActive ? '#22d3ee' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <Icon size={24} color={isActive ? '#22d3ee' : '#94a3b8'} />
              <span
                style={{
                  fontSize: '11px',
                  marginTop: '4px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#22d3ee' : '#94a3b8',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
