// @ts-nocheck
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { RosterSlot } from '../lib/rosterLayout';
import type { PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { TeamTierData } from '../types/teamTiers';
import type { IceScoreRange } from './PlayerChip';
import { DraggablePlayerChip } from './DraggablePlayerChip';
import { getPlayerProjection } from '../lib/playerProjection';
import type { LeagueWorkspace, LeagueWorkspaceRosterEntry } from '../lib/leagueWorkspace';

interface RosterSlotComponentProps {
  slot: RosterSlot;
  players: WorkingLineupPlayer[];
  projections?: Record<string, PlayerProjection>;
  isLoadingProjections?: boolean;
  isOver: boolean;
  isValid: boolean;
  isDragging: boolean;
  onRemove?: (playerId: string) => void;
  onPlayerDetails?: (player: RosterPlayer) => void;
  getTeamTier?: (teamCode: string) => TeamTierData | undefined;
  iceScoreRange?: IceScoreRange;
  cardDensity?: 'full' | 'compact';
  onPlayerCompare?: (player: RosterPlayer) => void;
  selectedForComparison?: string[];
  onCompareWithFreeAgents?: (player: RosterPlayer) => void;
  onAddPlayer?: (slot: RosterSlot) => void;
  keeperEntries?: LeagueWorkspaceRosterEntry[];
  keeperRules?: LeagueWorkspace['keeperRules'];
  onToggleKeeper?: (playerId: string) => void;
  onKeeperCostChange?: (playerId: string, cost: LeagueWorkspaceRosterEntry['keeperCost']) => void;
  onCompareKeeper?: (player: RosterPlayer) => void;
}

export const RosterSlotComponent: React.FC<RosterSlotComponentProps> = ({
  slot,
  players,
  projections,
  isLoadingProjections,
  isOver,
  isValid,
  isDragging,
  onRemove,
  onPlayerDetails,
  getTeamTier,
  iceScoreRange,
  cardDensity,
  onPlayerCompare,
  selectedForComparison,
  onCompareWithFreeAgents,
  onAddPlayer,
  keeperEntries,
  keeperRules,
  onToggleKeeper,
  onKeeperCostChange,
  onCompareKeeper,
}) => {
  const { setNodeRef } = useDroppable({
    id: slot.id,
  });

  // Determine visual state classes
  const getStateClasses = () => {
    if (!isDragging) {
      return 'border-line ice-slot-gradient';
    }

    if (isOver) {
      if (isValid) {
        return 'border-accent ice-slot-gradient ring-2 ring-accent shadow-lg shadow-cyan-500/20';
      } else {
        return 'border-negative ice-slot-gradient ring-2 ring-negative animate-shake shadow-lg shadow-red-500/20';
      }
    }

    if (isValid) {
      return 'border-accent ice-slot-gradient ring-1 ring-accent';
    } else {
      return 'border-line ice-slot-gradient opacity-60';
    }
  };

  const isCompact = cardDensity === 'compact';

  return (
    <div
      ref={setNodeRef}
      className={`
        roster-slot
        ${isCompact ? 'w-full max-w-[450px] min-h-[70px] p-2' : 'w-full max-w-[500px] min-h-[160px] p-3'} rounded-xl border-2 transition-all duration-150 flex flex-col
        ${getStateClasses()} [will-change:transform]`}
      aria-label={`${slot.displayName} slot`}
      role="region">
      {/* Slot Header with cyan/gold styling */}
      <div className={`text-xs font-bold text-accent ${isCompact ? 'mb-1' : 'mb-2'} uppercase tracking-wider flex-shrink-0`}>
        {slot.displayName}
      </div>
      {/* Player Chips - takes remaining space */}
      <div className={`${isCompact ? 'space-y-1' : 'space-y-2'} flex-1 flex flex-col justify-start overflow-y-auto`}>
        {players.length > 0 ? (
          players.map((item) => (
            <DraggablePlayerChip
              key={item.player.id}
              player={item.player}
              projection={getPlayerProjection(projections, item.player.id)}
              isLoadingProjections={isLoadingProjections}
              onRemove={onRemove ? () => onRemove(item.player.id) : undefined}
              onDetails={onPlayerDetails ? () => onPlayerDetails(item.player) : undefined}
              teamTier={getTeamTier?.(item.player.team)}
              iceScoreRange={iceScoreRange}
              variant={cardDensity}
              onCompare={onPlayerCompare ? () => onPlayerCompare(item.player) : undefined}
              isSelectedForComparison={selectedForComparison?.includes(item.player.id)}
              onCompareWithFreeAgents={onCompareWithFreeAgents ? () => onCompareWithFreeAgents(item.player) : undefined}
              keeperEntry={keeperEntries?.find((entry) => entry.playerId === item.player.id)}
              keeperRules={keeperRules}
              onToggleKeeper={onToggleKeeper ? () => onToggleKeeper(item.player.id) : undefined}
              onKeeperCostChange={onKeeperCostChange ? (cost) => onKeeperCostChange(item.player.id, cost) : undefined}
              onCompareKeeper={onCompareKeeper ? () => onCompareKeeper(item.player) : undefined}
            />
          ))
        ) : (
          <button
            type="button"
            onClick={() => onAddPlayer?.(slot)}
            disabled={!onAddPlayer || isDragging}
            className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line text-xs font-medium text-ink-dim transition-colors hover:border-accent hover:bg-accent-muted hover:text-accent disabled:cursor-default disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-ink-dim"
            aria-label={`Add player to ${slot.displayName}`}
          >
            + Add player
          </button>
        )}
      </div>
    </div>
  );
};
