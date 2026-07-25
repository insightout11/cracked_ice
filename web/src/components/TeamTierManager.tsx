import { useEffect } from 'react';
import { useTeamTiers } from '../contexts/TeamTierContext';
import { useLeagueWorkspace } from '../contexts/LeagueWorkspaceContext';

/**
 * TeamTierManager is responsible for initializing team tier data once on app startup
 * and ensuring team colors remain consistent across all view modes.
 *
 * This component should be placed high in the component tree (e.g., in App.tsx)
 * to ensure team tiers are fetched early and shared across all components.
 */
export function TeamTierManager() {
  const teamTiers = useTeamTiers();
  const { activeLeague } = useLeagueWorkspace();

  useEffect(() => {

    teamTiers.fetchTiers({
      start: activeLeague.season.start,
      end: activeLeague.season.end,
      playoffStart: activeLeague.schedule.playoffs.start,
      playoffEnd: activeLeague.schedule.playoffs.end,
    });
  }, [
    activeLeague.id,
    activeLeague.schedule.playoffs.end,
    activeLeague.schedule.playoffs.start,
    activeLeague.season.end,
    activeLeague.season.start,
    teamTiers.fetchTiers,
  ]);

  // This component doesn't render anything - it's just for lifecycle management
  return null;
}

export default TeamTierManager;
