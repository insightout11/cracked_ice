import React from 'react';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface RosterPlayerDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterPlayer[];
  onSelect: (player: RosterPlayer) => void;
  freeAgentName?: string;
}

export const RosterPlayerDropdown: React.FC<RosterPlayerDropdownProps> = ({
  isOpen,
  onClose,
  roster,
  onSelect,
  freeAgentName,
}) => {

  if (!isOpen) return null;

  const handleSelect = (player: RosterPlayer) => {
    onSelect(player);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-glass backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-0)] shadow-2xl rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col border border-line">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div>
            <h3 className="text-lg font-bold text-ink">Compare Against Roster Player</h3>
            <p className="text-sm text-ink-dim mt-1">
              {freeAgentName ? (
                <>
                  Comparing <span className="text-accent font-medium">{freeAgentName}</span> vs...
                </>
              ) : (
                'Select a roster player to compare'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-1/10 transition-colors"
          >
            <span className="text-ink-dim text-2xl leading-none">×</span>
          </button>
        </div>

        {/* Roster Player List */}
        <div className="flex-1 overflow-y-auto p-4">
          {roster.length === 0 ? (
            <div className="text-center py-8 text-ink-dim">
              No players on roster
            </div>
          ) : (
            <div className="space-y-2">
              {roster.map(player => {
                const teamLogo = getTeamLogoUrl(player.team);
                const positions = Array.isArray(player.positions)
                  ? player.positions.join('/')
                  : 'N/A';

                return (
                  <button
                    key={player.id}
                    onClick={() => handleSelect(player)}
                    className="w-full flex items-center gap-3 p-3 bg-surface-1/5 hover:bg-surface-1/10 border border-line hover:border-accent rounded-lg transition-all group"
                  >
                    {/* Team Logo */}
                    <img
                      src={teamLogo}
                      alt={player.team}
                      className="h-8 w-8 rounded-full bg-surface-2 p-0.5 object-contain flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />

                    {/* Player Info */}
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-ink group-hover:text-accent transition-colors">
                        {player.full_name}
                      </div>
                      <div className="text-xs text-ink-dim">
                        {player.team} • {positions} • {player.current_slot || 'No slot'}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="text-ink-mute group-hover:text-accent transition-colors">
                      →
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-1/5">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-surface-1/10 hover:bg-surface-1/20 text-ink rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
