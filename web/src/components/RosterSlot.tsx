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
        ${isOver ? 'border-accent bg-accent-muted' : 'border-line bg-surface-2'}
      `}
    >
      <div className="text-sm font-semibold text-ink mb-3">
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
            <div className="text-xs text-ink-dim italic text-center py-4">
              Empty
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};
