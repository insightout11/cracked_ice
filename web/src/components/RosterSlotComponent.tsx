// @ts-nocheck
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { RosterSlot } from '../lib/rosterLayout';
import type { PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { TeamTierData } from '../types/teamTiers';
import type { IceScoreRange } from './PlayerChip';
import { DraggablePlayerChip } from './DraggablePlayerChip';

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
}) => {
  const { setNodeRef } = useDroppable({
    id: slot.id,
  });

  // Determine visual state classes
  const getStateClasses = () => {
    if (!isDragging) {
      return 'border-slate-700/40 ice-slot-gradient';
    }

    if (isOver) {
      if (isValid) {
        return 'border-cyan-400 ice-slot-gradient ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/20';
      } else {
        return 'border-red-500 ice-slot-gradient ring-2 ring-red-400/50 animate-shake shadow-lg shadow-red-500/20';
      }
    }

    if (isValid) {
      return 'border-cyan-500/60 ice-slot-gradient ring-1 ring-cyan-400/30';
    } else {
      return 'border-slate-600 ice-slot-gradient opacity-60';
    }
  };

  const isCompact = cardDensity === 'compact';

  return (
    <div
      ref={setNodeRef}
      className={`
        roster-slot
        ${isCompact ? 'w-full max-w-[450px] min-h-[70px] p-2' : 'w-full max-w-[500px] min-h-[160px] p-3'} rounded-xl border-2 transition-all duration-150 flex flex-col
        ${getStateClasses()}
      `}
      style={{ willChange: 'transform' }}
      aria-label={`${slot.displayName} slot`}
      role="region"
    >
      {/* Slot Header with cyan/gold styling */}
      <div className={`text-xs font-bold text-cyan-300 ${isCompact ? 'mb-1' : 'mb-2'} uppercase tracking-wider flex-shrink-0`}>
        {slot.displayName}
      </div>

      {/* Player Chips - takes remaining space */}
      <div className={`${isCompact ? 'space-y-1' : 'space-y-2'} flex-1 flex flex-col justify-start overflow-y-auto`}>
        {players.length > 0 ? (
          players.map((item) => (
            <DraggablePlayerChip
              key={item.player.id}
              player={item.player}
              projection={projections?.[item.player.id]}
              isLoadingProjections={isLoadingProjections}
              onRemove={onRemove ? () => onRemove(item.player.id) : undefined}
              onDetails={onPlayerDetails ? () => onPlayerDetails(item.player) : undefined}
              teamTier={getTeamTier?.(item.player.team)}
              iceScoreRange={iceScoreRange}
              variant={cardDensity}
            />
          ))
        ) : (
          <div className="flex items-center justify-center flex-1 text-xs text-slate-500 italic">
            Empty
          </div>
        )}
      </div>
    </div>
  );
};
