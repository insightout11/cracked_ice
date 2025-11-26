// @ts-nocheck
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DraggablePlayerChip } from './DraggablePlayerChip';
import { WorkingLineupPlayer } from './RosterGrid';
import type { PlayerProjection } from '../lib/coachSchemas';

interface RosterSlotProps {
  slotId: string;
  slotName: string;
  players: WorkingLineupPlayer[];
  projections?: Record<string, PlayerProjection>;
  isLoadingProjections?: boolean;
}

export const RosterSlot: React.FC<RosterSlotProps> = ({
  slotId,
  slotName,
  players,
  projections,
  isLoadingProjections,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
  });

  const playerIds = players.map((p) => p.player.id);

  return (
    <div
      ref={setNodeRef}
      className={`
        roster-slot
        min-h-[120px] p-4 rounded-lg border-2 transition-colors
        ${isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}
      `}
    >
      <div className="text-sm font-semibold text-gray-700 mb-3">
        {slotName}
      </div>

      <SortableContext items={playerIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {players.length > 0 ? (
            players.map((item) => (
              <DraggablePlayerChip
                key={item.player.id}
                player={item.player}
                projection={projections?.[item.player.id]}
                isLoadingProjections={isLoadingProjections}
              />
            ))
          ) : (
            <div className="text-xs text-gray-400 italic text-center py-4">
              Empty
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};
