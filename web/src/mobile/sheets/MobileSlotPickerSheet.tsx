import { useMemo } from 'react';
import { Check, ArrowLeftRight, X } from 'lucide-react';
import { MobileBottomSheet } from '../MobileBottomSheet';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { RosterSlot } from '../../lib/rosterLayout';

interface MobileSlotPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  player: RosterPlayer | null;
  slots: RosterSlot[];
  currentLineup: Record<string, RosterPlayer | null>;
  onSelectSlot: (slotId: string) => void;
}

/**
 * MobileSlotPickerSheet - Select slot to place a player
 *
 * Features:
 * - Shows only eligible slots based on player positions
 * - Indicates empty vs occupied slots
 * - Shows swap indicator for occupied slots
 * - Half-screen bottom sheet
 */
export function MobileSlotPickerSheet({
  isOpen,
  onClose,
  player,
  slots,
  currentLineup,
  onSelectSlot,
}: MobileSlotPickerSheetProps) {
  // Get eligible slots for this player
  const eligibleSlots = useMemo(() => {
    if (!player) return [];

    // Handle both roster players (positions array) and free agents (position string)
    const playerPositions = player.positions || [(player as any).position].filter(Boolean);

    return slots.filter((slot) => {
      // Check if player can fill this slot type
      const slotType = slot.type;

      // Special slot types - cast to handle type narrowing
      const st = slotType as string;
      if (st === 'BN') return true; // Bench can hold any player
      if (st === 'IR' || st === 'IR+') return true; // IR slots
      if (st === 'NA') return true; // N/A slot

      // UTIL can hold any skater (not goalie)
      if (slotType === 'UTIL') {
        return !playerPositions.includes('G');
      }

      // F slot can hold C, LW, RW
      if (slotType === 'F') {
        return playerPositions.some(p => ['C', 'LW', 'RW'].includes(p));
      }

      // Direct position match
      return playerPositions.includes(slotType);
    });
  }, [player, slots]);

  // Group slots by type
  const groupedSlots = useMemo(() => {
    const groups: Record<string, typeof eligibleSlots> = {};

    eligibleSlots.forEach((slot) => {
      const group = getSlotGroup(slot.type);
      if (!groups[group]) groups[group] = [];
      groups[group].push(slot);
    });

    // Sort groups in display order
    const order = ['Active', 'Utility', 'Bench', 'IR'];
    return order
      .filter((g) => groups[g]?.length > 0)
      .map((group) => ({
        name: group,
        slots: groups[group],
      }));
  }, [eligibleSlots]);

  if (!player) return null;

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={['50%', '80%']}
      initialSnap={0}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 bg-surface-2 border-b border-line px-4 py-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-ink-dim" />
          </button>

          <h2 className="text-lg font-bold text-ink">Select Slot</h2>
          <p className="text-sm text-ink-dim mt-1">
            For <span className="text-accent">{player.full_name || (player as any).name}</span>
          </p>
          <p className="text-xs text-ink-dim mt-0.5">
            Eligible: {(player.positions || [(player as any).position].filter(Boolean)).join(', ') || 'N/A'}
          </p>
        </div>

        {/* Slot List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {groupedSlots.length === 0 ? (
            <div className="text-center py-8 text-ink-dim">
              No eligible slots available
            </div>
          ) : (
            groupedSlots.map((group) => (
              <div key={group.name} className="mb-4">
                <h3 className="text-xs font-bold text-ink-dim uppercase tracking-wide mb-2">
                  {group.name}
                </h3>
                <div className="space-y-2">
                  {group.slots.map((slot) => {
                    const occupant = currentLineup[slot.id];
                    const isEmpty = !occupant;

                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          onSelectSlot(slot.id);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between p-4 bg-surface-2 rounded-xl border border-line hover:border-accent active:bg-surface-2 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {/* Slot Label */}
                          <div className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center">
                            <span className="text-sm font-bold text-accent">
                              {slot.displayName}
                            </span>
                          </div>

                          {/* Slot Info */}
                          <div className="text-left">
                            {isEmpty ? (
                              <span className="text-sm text-positive">Empty</span>
                            ) : (
                              <>
                                <span className="text-sm text-ink">
                                  {occupant.full_name}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-warning mt-0.5">
                                  <ArrowLeftRight className="w-3 h-3" />
                                  <span>Will swap</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action Icon */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isEmpty
                              ? 'bg-positive-muted text-positive'
                              : 'bg-warning-muted text-warning'
                          }`}
                        >
                          {isEmpty ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Safe area padding */}
        <div className="h-8 safe-area-bottom" />
      </div>
    </MobileBottomSheet>
  );
}

/**
 * Get group name for slot type
 */
function getSlotGroup(slotType: string): string {
  if (['C', 'LW', 'RW', 'D', 'G', 'F'].includes(slotType)) {
    return 'Active';
  }
  if (slotType === 'UTIL') {
    return 'Utility';
  }
  if (slotType === 'BN') {
    return 'Bench';
  }
  if (['IR', 'IR+', 'NA'].includes(slotType)) {
    return 'IR';
  }
  return 'Other';
}
