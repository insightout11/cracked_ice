// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { RosterPlayer, PlayerProjection, LeagueProfile } from '../lib/coachSchemas';
import type { TeamTierData } from '../types/teamTiers';
import { buildRosterRows, canDrop, getRowClasses, getRowLabel, type RosterSlot, type SlotType } from '../lib/rosterLayout';
import { RosterSlotComponent } from './RosterSlotComponent';
import { PlayerChip, type IceScoreRange } from './PlayerChip';

export interface WorkingLineupPlayer {
  player: RosterPlayer;
  slot: string; // "LW-0", "C-1", "BN-2", etc.
  order: number;
}

interface RosterGridProps {
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections?: Record<string, PlayerProjection>;
  isLoadingProjections?: boolean;
  onChange?: (lineup: WorkingLineupPlayer[]) => void;
  onRemove?: (playerId: string) => void;
  onPlayerDetails?: (player: RosterPlayer) => void;
  getTeamTier?: (teamCode: string) => TeamTierData | undefined;
  cardDensity?: 'full' | 'compact';
  onPlayerCompare?: (player: RosterPlayer) => void;
  selectedForComparison?: string[];
  onCompareWithFreeAgents?: (player: RosterPlayer) => void;
}

export const RosterGrid: React.FC<RosterGridProps> = ({
  roster,
  leagueProfile,
  projections,
  isLoadingProjections,
  onChange,
  onRemove,
  onPlayerDetails,
  getTeamTier,
  cardDensity,
  onPlayerCompare,
  selectedForComparison,
  onCompareWithFreeAgents,
}) => {
  const [lineup, setLineup] = useState<WorkingLineupPlayer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overSlotId, setOverSlotId] = useState<string | null>(null);

  // Build roster layout from lineup_slots, including dynamic bench slots
  const rosterRows = useMemo(() => {
    const baseRows = buildRosterRows(leagueProfile.lineup_slots);

    // Find all bench slots currently in use
    const benchSlotsInUse = lineup
      .filter(p => p.slot.startsWith('BN-'))
      .map(p => p.slot);

    // Get existing bench slots from base rows
    const existingBenchSlots = new Set(
      baseRows
        .filter(row => row.rowType === 'bench')
        .flatMap(row => row.slots)
        .map(slot => slot.id)
    );

    // Find any bench slots in use that aren't in the base layout
    const extraBenchSlots = benchSlotsInUse
      .filter(slotId => !existingBenchSlots.has(slotId))
      .sort();

    // If there are extra bench slots, add them to the bench rows
    if (extraBenchSlots.length > 0) {
      const extraSlots = extraBenchSlots.map(slotId => {
        const index = parseInt(slotId.split('-')[1]);
        return {
          id: slotId,
          type: 'BN' as SlotType,
          index,
          displayName: `BN ${index + 1}`
        };
      });

      // Find bench rows and add extra slots
      const benchRowIndex = baseRows.findIndex(row => row.rowType === 'bench');
      if (benchRowIndex >= 0) {
        // Add to last bench row
        const lastBenchRowIndex = baseRows.map((row, idx) => ({ row, idx }))
          .filter(({ row }) => row.rowType === 'bench')
          .pop()?.idx ?? benchRowIndex;

        baseRows[lastBenchRowIndex] = {
          ...baseRows[lastBenchRowIndex],
          slots: [...baseRows[lastBenchRowIndex].slots, ...extraSlots]
        };
      } else {
        // No bench rows exist, create one
        baseRows.push({
          rowType: 'bench',
          slots: extraSlots,
          columns: 4
        });
      }
    }

    return baseRows;
  }, [leagueProfile.lineup_slots, lineup]);

  // Calculate ICE score range for dynamic coloring
  const iceScoreRange = useMemo<IceScoreRange | undefined>(() => {
    if (lineup.length === 0) return undefined;

    const iceScores = lineup.map(({ player }) => {
      const projection = projections?.[player.id];
      const seasonFppg = (player as any).seasonFppg ?? projection?.fppg ?? 0;
      const last30Fppg = (player as any).last30Fppg ?? seasonFppg;
      const last7Fppg = (player as any).last7Fppg ?? seasonFppg;
      return (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2);
    }).filter(isFinite);

    if (iceScores.length === 0) return undefined;

    return {
      min: Math.min(...iceScores),
      max: Math.max(...iceScores),
      allScores: iceScores
    };
  }, [lineup, projections]);

  // Sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize lineup from roster
  useEffect(() => {
    const initialLineup: WorkingLineupPlayer[] = roster.map((player, index) => ({
      player,
      slot: player.current_slot || 'BN-0',
      order: index,
    }));
    setLineup(initialLineup);
  }, [roster]);

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      onChange(lineup);
    }
  }, [lineup, onChange]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Disable text selection while dragging
    document.body.classList.add('select-none');
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverSlotId(over ? (over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverSlotId(null);
    document.body.classList.remove('select-none');

    if (!over) return;

    const playerId = active.id as string;
    const targetSlotId = over.id as string;

    // Find the player and target slot type
    const draggedPlayer = lineup.find((p) => p.player.id === playerId);
    if (!draggedPlayer) return;

    const targetSlotType = targetSlotId.split('-')[0] as SlotType;
    const originalSlotId = draggedPlayer.slot;

    // If dropping in the same slot, do nothing
    if (originalSlotId === targetSlotId) return;

    // Check eligibility
    if (!canDrop(draggedPlayer.player, targetSlotType)) {
      // Show toast or visual feedback for invalid drop
      console.warn(`Cannot drop ${draggedPlayer.player.full_name} into ${targetSlotType} slot`);
      return;
    }

    // Check if target slot is already occupied
    const occupyingPlayer = lineup.find((p) => p.slot === targetSlotId);

    if (!occupyingPlayer) {
      // Target slot is empty - simple move
      setLineup((prev) => {
        return prev.map((p) => {
          if (p.player.id === playerId) {
            return { ...p, slot: targetSlotId };
          }
          return p;
        });
      });
      return;
    }

    // Target slot is occupied - determine what to do
    const originalSlotType = originalSlotId.split('-')[0] as SlotType;
    const canSwap = canDrop(occupyingPlayer.player, originalSlotType);

    if (canSwap) {
      // Both players can swap - do it
      setLineup((prev) => {
        return prev.map((p) => {
          if (p.player.id === playerId) {
            return { ...p, slot: targetSlotId };
          }
          if (p.player.id === occupyingPlayer.player.id) {
            return { ...p, slot: originalSlotId };
          }
          return p;
        });
      });
    } else {
      // Occupying player can't go to original slot - must find or create bench slot
      const benchSlots = rosterRows
        .filter(row => row.rowType === 'bench')
        .flatMap(row => row.slots);

      const occupiedBenchSlots = new Set(
        lineup.filter(p => p.slot.startsWith('BN-')).map(p => p.slot)
      );

      let targetBenchSlot = benchSlots.find(slot => !occupiedBenchSlots.has(slot.id));

      if (!targetBenchSlot) {
        // No bench space available - create a new bench slot
        const nextBenchIndex = benchSlots.length;
        const newBenchSlotId = `BN-${nextBenchIndex}`;
        targetBenchSlot = {
          id: newBenchSlotId,
          type: 'BN' as SlotType,
          index: nextBenchIndex,
          displayName: `BN ${nextBenchIndex + 1}`
        };
      }

      // Move occupying player to bench and dragged player to target
      setLineup((prev) => {
        return prev.map((p) => {
          if (p.player.id === playerId) {
            return { ...p, slot: targetSlotId };
          }
          if (p.player.id === occupyingPlayer.player.id) {
            return { ...p, slot: targetBenchSlot!.id };
          }
          return p;
        });
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverSlotId(null);
    document.body.classList.remove('select-none');
  };

  // Get active player for drag overlay
  const activePlayer = activeId ? lineup.find((p) => p.player.id === activeId) : null;

  // Check if a slot is valid for the active player
  const isValidTarget = (slotId: string): boolean => {
    if (!activePlayer) return false;
    const slotType = slotId.split('-')[0] as SlotType;
    return canDrop(activePlayer.player, slotType);
  };

  const isCompact = cardDensity === 'compact';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`roster-grid ${isCompact ? 'space-y-2' : 'space-y-6'}`}>
        {rosterRows.map((row, rowIndex) => (
          <div key={rowIndex} className="roster-row">
            {/* Row Label */}
            {rowIndex === 0 || rosterRows[rowIndex - 1].rowType !== row.rowType ? (
              <div className={`flex justify-center ${isCompact ? 'mt-2 mb-1.5' : 'mb-3'}`}>
                <div className="inline-flex items-center px-3 py-1 bg-slate-800/80 rounded-full border border-cyan-500/30">
                  <span className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                    {getRowLabel(row.rowType)}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Row Grid */}
            <div className={`${
              isCompact
                ? row.rowType === 'bench' || row.rowType === 'ir'
                  ? 'grid grid-cols-3 gap-1.5'
                  : 'flex justify-center gap-1.5'
                : `${getRowClasses(row.rowType)} ${isCompact ? 'gap-1.5' : 'gap-3'}`
            }`}>
              {row.slots.map((slot) => {
                const playersInSlot = lineup.filter((p) => p.slot === slot.id);
                const isOver = overSlotId === slot.id;
                const isValid = isValidTarget(slot.id);

                return (
                  <RosterSlotComponent
                    key={slot.id}
                    slot={slot}
                    players={playersInSlot}
                    projections={projections}
                    isLoadingProjections={isLoadingProjections}
                    isOver={isOver}
                    isValid={isValid}
                    isDragging={!!activeId}
                    onRemove={onRemove}
                    onPlayerDetails={onPlayerDetails}
                    getTeamTier={getTeamTier}
                    iceScoreRange={iceScoreRange}
                    cardDensity={cardDensity}
                    onPlayerCompare={onPlayerCompare}
                    selectedForComparison={selectedForComparison}
                    onCompareWithFreeAgents={onCompareWithFreeAgents}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Drag Overlay - follows cursor */}
      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
        style={{ cursor: 'grabbing' }}
      >
        {activePlayer ? (
          <PlayerChip
            player={activePlayer.player}
            projection={projections?.[activePlayer.player.id]}
            isDragging={true}
            teamTier={getTeamTier?.(activePlayer.player.team)}
            iceScoreRange={iceScoreRange}
            variant={cardDensity}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
