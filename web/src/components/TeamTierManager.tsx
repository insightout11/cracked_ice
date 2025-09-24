import { useEffect } from 'react';
import { useTeamTiers } from '../contexts/TeamTierContext';
import { useTimeWindow } from '../contexts/TimeWindowContext';
import { getPlayoffStartWeekFromTimeWindow } from '../lib/timeWindow';

/**
 * TeamTierManager is responsible for initializing team tier data once on app startup
 * and ensuring team colors remain consistent across all view modes.
 *
 * This component should be placed high in the component tree (e.g., in App.tsx)
 * to ensure team tiers are fetched early and shared across all components.
 */
export function TeamTierManager() {
  const teamTiers = useTeamTiers();
  const timeWindow = useTimeWindow();

  useEffect(() => {
    console.log('🏒 TeamTierManager: Initializing team tiers on app startup');

    // Fetch team tiers once on app startup using user's playoff configuration
    // This ensures colors are consistent regardless of current view tab
    const playoffStartWeek = getPlayoffStartWeekFromTimeWindow(timeWindow.state);
    console.log('🏒 TeamTierManager: Using playoff start week:', playoffStartWeek);

    teamTiers.fetchTiers({ playoffStartWeek });
  }, []); // Empty dependency array - only run once on mount

  // Separate effect to handle when user explicitly changes their playoff configuration
  // This is the ONLY time we should refetch team tiers
  useEffect(() => {
    // Only refetch if user has explicitly configured playoff settings
    // and it's not the default configuration
    if (timeWindow.state.playoffMode?.preset &&
        timeWindow.state.playoffMode.preset !== 'weeks-24-26') {
      console.log('🏒 TeamTierManager: User changed playoff configuration, refetching team tiers');
      console.log('🏒 TeamTierManager: New playoff preset:', timeWindow.state.playoffMode.preset);
      console.log('🏒 TeamTierManager: League weeks:', timeWindow.state.playoffMode?.leagueWeekConfig?.selectedWeeks);

      const playoffStartWeek = getPlayoffStartWeekFromTimeWindow(timeWindow.state);
      console.log('🏒 TeamTierManager: Using playoff start week:', playoffStartWeek);

      teamTiers.fetchTiers({ playoffStartWeek });
    }
  }, [
    timeWindow.state.playoffMode?.preset,
    JSON.stringify(timeWindow.state.playoffMode?.leagueWeekConfig?.selectedWeeks)
  ]);

  // This component doesn't render anything - it's just for lifecycle management
  return null;
}

export default TeamTierManager;