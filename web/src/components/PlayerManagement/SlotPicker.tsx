import React, { useMemo } from 'react';
import type { RosterPlayer, LeagueProfile } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import { canDrop, buildRosterRows, type SlotType, type RosterSlot } from '../../lib/rosterLayout';

interface SlotPickerProps {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerSearchResult | RosterPlayer;
  leagueProfile: LeagueProfile | null;
  currentRoster: RosterPlayer[];
  onConfirm: (slotId: string) => void;
}

export const SlotPicker: React.FC<SlotPickerProps> = ({
  isOpen,
  onClose,
  player,
  leagueProfile,
  currentRoster,
  onConfirm,
}) => {
  // Get all roster slots
  const allSlots = useMemo(() => {
    if (!leagueProfile) return [];
    const rows = buildRosterRows(leagueProfile.lineup_slots);
    return rows.flatMap(row => row.slots);
  }, [leagueProfile]);

  // Get eligible slots for this player
  const eligibleSlots = useMemo(() => {
    if (!player) return [];
    const rosterPlayer = player as RosterPlayer;
    return allSlots.filter(slot => canDrop(rosterPlayer, slot.type));
  }, [allSlots, player]);

  // Get occupied slot IDs
  const occupiedSlotIds = useMemo(() => {
    return new Set(currentRoster.map(p => p.current_slot).filter(Boolean));
  }, [currentRoster]);

  // Separate into empty and occupied slots
  const emptyEligibleSlots = useMemo(() => {
    const existing = eligibleSlots.filter(slot => !occupiedSlotIds.has(slot.id));

    // Bench is unlimited - if no empty bench slot exists, add a new one
    const hasEmptyBench = existing.some(s => s.type === 'BN');
    if (!hasEmptyBench) {
      let maxBnIndex = -1;
      allSlots.forEach(s => {
        const m = s.id.match(/^BN-(\d+)$/);
        if (m) maxBnIndex = Math.max(maxBnIndex, parseInt(m[1]));
      });
      currentRoster.forEach(p => {
        const m = p.current_slot?.match(/^BN-(\d+)$/);
        if (m) maxBnIndex = Math.max(maxBnIndex, parseInt(m[1]));
      });
      const nextIndex = maxBnIndex + 1;
      existing.push({
        id: `BN-${nextIndex}`,
        type: 'BN' as SlotType,
        index: nextIndex,
        displayName: nextIndex === 0 ? 'BN' : `BN ${nextIndex + 1}`,
      });
    }

    return existing;
  }, [eligibleSlots, occupiedSlotIds, allSlots, currentRoster]);

  const occupiedEligibleSlots = useMemo(() => {
    return eligibleSlots.filter(slot => occupiedSlotIds.has(slot.id));
  }, [eligibleSlots, occupiedSlotIds]);

  // Get player in a specific slot
  const getPlayerInSlot = (slotId: string): RosterPlayer | undefined => {
    return currentRoster.find(p => p.current_slot === slotId);
  };

  if (!isOpen || !player) return null;

  // Handle both PlayerSearchResult (pos) and RosterPlayer (positions) types
  const positionsArray = 'pos' in player ? player.pos : (player as any).positions || [];
  const positions = Array.isArray(positionsArray) ? positionsArray.join('/') : 'N/A';
  const playerName = 'name' in player ? player.name : (player as any).full_name || 'Unknown';

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-[#0A1628] to-[#0E1A2B] shadow-2xl rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">Select Roster Slot</h3>
            <p className="text-sm text-gray-400 mt-1">
              Adding <span className="text-cyan-400 font-medium">{playerName}</span> ({player.team} - {positions})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {eligibleSlots.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-red-400 font-medium mb-2">No Eligible Slots</div>
              <p className="text-sm text-gray-400">
                This player cannot be added to any roster slot based on their position eligibility.
                {leagueProfile && leagueProfile.lineup_slots.BN && (
                  <span className="block mt-2">
                    Try moving another player to bench first to free up a slot.
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Empty Slots */}
              {emptyEligibleSlots.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-cyan-300 mb-2 uppercase tracking-wide">
                    Available Slots ({emptyEligibleSlots.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {emptyEligibleSlots.map(slot => (
                      <button
                        key={slot.id}
                        onClick={() => onConfirm(slot.id)}
                        className="p-3 bg-white/5 border border-cyan-400/30 rounded-lg hover:bg-cyan-400/10 hover:border-cyan-400 transition-all text-left"
                      >
                        <div className="font-medium text-cyan-300">{slot.displayName}</div>
                        <div className="text-xs text-gray-400 mt-1">Empty</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Occupied Slots */}
              {occupiedEligibleSlots.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-yellow-300 mb-2 uppercase tracking-wide">
                    Occupied Slots ({occupiedEligibleSlots.length}) - Will Swap
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {occupiedEligibleSlots.map(slot => {
                      const occupyingPlayer = getPlayerInSlot(slot.id);
                      return (
                        <button
                          key={slot.id}
                          onClick={() => onConfirm(slot.id)}
                          className="p-3 bg-white/5 border border-yellow-400/30 rounded-lg hover:bg-yellow-400/10 hover:border-yellow-400 transition-all text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-yellow-300">{slot.displayName}</div>
                              {occupyingPlayer && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Currently: {occupyingPlayer.full_name} ({occupyingPlayer.team})
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-yellow-400 font-medium">
                              Swap
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {emptyEligibleSlots.length === 0 && occupiedEligibleSlots.length > 0 && (
                <div className="text-xs text-yellow-400 bg-yellow-400/10 rounded-lg p-3">
                  ℹ️ All eligible slots are occupied. Selecting a slot will swap the current player to bench or an available slot.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
