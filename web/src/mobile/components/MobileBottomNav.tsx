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
      className='fixed bottom-[0] left-[0] right-[0] z-[50] bg-surface-1 [border-top:1px_solid_var(--line)] [padding:8px_0] [padding-bottom:max(8px,_env(safe-area-inset-bottom))]'
    >
      <div
        className='flex justify-around items-center'
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
                color: isActive ? 'var(--accent)' : 'var(--ink-dim)'
              }}
              className='flex flex-col items-center justify-center [padding:8px_16px] [background-color:transparent] [border:none] cursor-pointer'>
              <Icon size={24} color={isActive ? 'var(--accent)' : 'var(--ink-dim)'} />
              <span
                style={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--accent)' : 'var(--ink-dim)'
                }}
                className='text-[11px] mt-[4px]'>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
