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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-[#0A1628] to-[#0E1A2B] shadow-2xl rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">Compare Against Roster Player</h3>
            <p className="text-sm text-gray-400 mt-1">
              {freeAgentName ? (
                <>
                  Comparing <span className="text-cyan-400 font-medium">{freeAgentName}</span> vs...
                </>
              ) : (
                'Select a roster player to compare'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="text-gray-400 text-2xl leading-none">×</span>
          </button>
        </div>

        {/* Roster Player List */}
        <div className="flex-1 overflow-y-auto p-4">
          {roster.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
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
                    className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 rounded-lg transition-all group"
                  >
                    {/* Team Logo */}
                    <img
                      src={teamLogo}
                      alt={player.team}
                      className="h-8 w-8 rounded-full bg-slate-900/80 p-0.5 object-contain flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />

                    {/* Player Info */}
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {player.full_name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {player.team} • {positions} • {player.current_slot || 'No slot'}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="text-gray-500 group-hover:text-cyan-400 transition-colors">
                      →
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
