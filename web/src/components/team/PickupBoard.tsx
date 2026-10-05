import { useEffect } from 'react';
import type { LeagueProfile, PlayerProjection, RosterPlayer } from '../../lib/coachSchemas';
import type { TimeWindowState } from '../../types/timeWindow';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { useAcquisitionRecommendations, type AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import { StreamingPlanner } from './StreamingPlanner';
import { AddsUsedControl } from './AddsUsedControl';
import { PickupFinder } from './PickupFinder';
import type { PickupFinderResult } from '../../hooks/usePickupFinder';
import type { ShareIntent } from '../ShareRosterModal';

interface PickupBoardProps {
  roster: RosterPlayer[];
  rosterProjections: Record<string, PlayerProjection>;
  leagueProfile: LeagueProfile;
  timeWindow: TimeWindowState;
  compact?: boolean;
  /** The page's shared recommendation result (player directory, planner inputs); fetched here when absent. */
  recommendations?: AcquisitionRecommendationResult;
  /** Scroll to the board. Changes to `nonce` repeat the request. */
  focus?: { scenarioId: string | null; nonce: number } | null;
  onOpenPlayer?: (player: RosterPlayer) => void;
  onShare?: (intent: ShareIntent) => void;
  /** The page's finder result, so the pickups are worked out once. */
  finder?: PickupFinderResult;
}

/**
 * My Team's pickups: the gaps-first finder (this week's add advice, open spots, every
 * player who'd help), your adds used this week, and the multi-add planner folded away.
 */
export function PickupBoard({ roster, rosterProjections, leagueProfile, timeWindow, compact = false, recommendations: sharedRecommendations, focus = null, onOpenPlayer, onShare, finder }: PickupBoardProps) {
  const { activeLeague } = useLeagueWorkspace();
  const ownRecommendations = useAcquisitionRecommendations({ workspace: activeLeague, leagueProfile, timeWindow, rosterProjections, enabled: !sharedRecommendations });
  const recommendations = sharedRecommendations ?? ownRecommendations;

  useEffect(() => {
    if (!focus) return;
    document.getElementById('pickup-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus]);

  return (
    <div className="space-y-3">
      <AddsUsedControl />
      <PickupFinder
        workspace={activeLeague}
        directory={recommendations.players.length ? recommendations.players : undefined}
        onOpenPlayer={onOpenPlayer}
        result={finder}
        planSeveral={roster.length > 0 && !recommendations.directoryLoading ? (
          <StreamingPlanner workspace={activeLeague} roster={roster} leagueProfile={leagueProfile} recommendations={recommendations} compact={compact} onOpenPlayer={onOpenPlayer} onShare={onShare} />
        ) : undefined}
      />
    </div>
  );
}
