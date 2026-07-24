// @ts-nocheck
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { PlayerChip, type IceScoreRange } from './PlayerChip';
import type { RosterPlayer, PlayerProjection } from '../lib/coachSchemas';
import type { TeamTierData } from '../types/teamTiers';
import type { LeagueWorkspace, LeagueWorkspaceRosterEntry } from '../lib/leagueWorkspace';

interface DraggablePlayerChipProps {
  player: RosterPlayer;
  projection?: PlayerProjection;
  isLoadingProjections?: boolean;
  onRemove?: () => void;
  onDetails?: () => void;
  teamTier?: TeamTierData;
  iceScoreRange?: IceScoreRange;
  variant?: 'full' | 'compact';
  onCompare?: () => void;
  isSelectedForComparison?: boolean;
  onCompareWithFreeAgents?: () => void;
  keeperEntry?: LeagueWorkspaceRosterEntry;
  keeperRules?: LeagueWorkspace['keeperRules'];
  onToggleKeeper?: () => void;
  onKeeperCostChange?: (cost: LeagueWorkspaceRosterEntry['keeperCost']) => void;
  onCompareKeeper?: () => void;
}

export const DraggablePlayerChip: React.FC<DraggablePlayerChipProps> = ({
  player,
  projection,
  isLoadingProjections,
  onRemove,
  onDetails,
  teamTier,
  iceScoreRange,
  variant,
  onCompare,
  isSelectedForComparison,
  onCompareWithFreeAgents,
  keeperEntry,
  keeperRules,
  onToggleKeeper,
  onKeeperCostChange,
  onCompareKeeper,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: player.id,
  });

  // No transform needed - DragOverlay handles the dragging visual
  const style = undefined;

  const positions = Array.isArray(player.positions) ? player.positions.join('/') : 'N/A';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        ${isDragging ? 'opacity-30' : 'opacity-100'}
        cursor-grab active:cursor-grabbing
        touch-none
      `}
      aria-roledescription="draggable"
      aria-label={`${player.full_name} ${positions}`}
      tabIndex={0}
    >
      <PlayerChip
        player={player}
        projection={projection}
        isLoading={isLoadingProjections}
        isDragging={false}
        onRemove={onRemove}
        onDetails={onDetails}
        teamTier={teamTier}
        iceScoreRange={iceScoreRange}
        variant={variant}
        onCompare={onCompare}
        isSelectedForComparison={isSelectedForComparison}
        onCompareWithFreeAgents={onCompareWithFreeAgents}
        keeperEntry={keeperEntry}
        keeperRules={keeperRules}
        onToggleKeeper={onToggleKeeper}
        onKeeperCostChange={onKeeperCostChange}
        onCompareKeeper={onCompareKeeper}
      />
    </div>
  );
};
