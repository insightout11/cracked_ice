import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { likelyOwnedPlayerIds } from '../../lib/pickupCandidateDiscovery';
import { availableGoalies, rosterGaps } from '../../lib/rosterGaps';
import { toRosterPlayer } from '../../hooks/useAcquisitionRecommendations';
import { PlayerNameLink } from './PlayerNameLink';

/**
 * Lineup spots the roster can't fill at all (one goalie for two G spots), with the
 * best goalies nobody in the league has. Shown whether or not the planner includes
 * goalies: an empty spot costs more than any stream or trade.
 */
export function RosterGapAlert({ workspace, roster, players, includeGoalies, onIncludeGoalies, onOpenPlayer }: {
  workspace: LeagueWorkspace;
  roster: RosterPlayer[];
  players: PlayerSearchResult[];
  includeGoalies: boolean;
  onIncludeGoalies: () => void;
  onOpenPlayer?: (player: RosterPlayer) => void;
}) {
  const gaps = useMemo(() => rosterGaps(workspace, roster), [roster, workspace]);
  const goalieGap = gaps.find((gap) => gap.kind === 'goalies');
  const skaterGap = gaps.find((gap) => gap.kind === 'skaters');
  const goalies = useMemo(() => {
    if (!goalieGap || !players.length) return [];
    const hidden = workspace.candidates.filter((candidate) => candidate.status === 'taken' || candidate.preference?.dismissed).map((candidate) => candidate.playerId);
    return availableGoalies(players, [...likelyOwnedPlayerIds(workspace, players), ...roster.map((player) => player.id), ...hidden]);
  }, [goalieGap, players, roster, workspace]);
  if (!gaps.length) return null;

  return (
    <div className="rounded-md border border-warning/60 bg-warning-muted p-3 text-sm" role="alert">
      {goalieGap && (
        <div>
          <p className="flex items-start gap-2 font-semibold text-ink">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            You have {goalieGap.have} healthy goalie{goalieGap.have === 1 ? '' : 's'} for {goalieGap.spots} G spots, so a G spot sits empty most nights.
          </p>
          {goalies.length > 0 && (
            <p className="mt-1 pl-6 text-xs text-ink-dim">
              Likely free: {goalies.map(({ player, startShare }, index) => (
                <span key={player.id}>
                  {index > 0 && ', '}
                  <span className="text-ink"><PlayerNameLink player={toRosterPlayer(player)} onOpen={onOpenPlayer} /></span> ({player.team}, {(player.blendedFppg ?? 0).toFixed(2)} a start, starts {Math.round(startShare * 100)}%)
                </span>
              ))}. Picking one up beats any stream or trade.
            </p>
          )}
          {!includeGoalies && (
            <p className="mt-1 pl-6 text-xs">
              <button type="button" onClick={onIncludeGoalies} className="inline-link font-semibold text-accent hover:underline">Plan with goalies</button>
              <span className="text-ink-dim"> to see which goalie adds help most this week.</span>
            </p>
          )}
        </div>
      )}
      {skaterGap && (
        <p className={`flex items-start gap-2 font-semibold text-ink ${goalieGap ? 'mt-2' : ''}`}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          You have {skaterGap.have} healthy skaters for {skaterGap.spots} skater spots. Add skaters to fill them; the planner below shows who plays when.
        </p>
      )}
    </div>
  );
}
