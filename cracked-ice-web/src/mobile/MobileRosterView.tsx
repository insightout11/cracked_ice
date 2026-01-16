import { useState } from 'react';
import { Menu, Plus, BarChart3, Settings } from 'lucide-react';
import { MobileLineupList } from './MobileLineupList';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileRosterGapsPanel } from './MobileRosterGapsPanel';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { RosterSlot } from '../lib/rosterLayout';
import type { TimeWindowState } from '../types/timeWindow';
import type { WorkingLineupPlayer } from '../components/RosterGrid';

interface MobileRosterViewProps {
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile | null;
  projections: Record<string, PlayerProjection>;
  workingLineup: WorkingLineupPlayer[];
  slots: RosterSlot[];
  timeWindow: TimeWindowState;
  unusedSlotsByDate: Record<string, Record<string, number>>;
  onOpenPlayerManagement: (filters?: { team?: string; position?: string }) => void;
  onOpenLeagueSettings: () => void;
  onOpenWeights: () => void;
  onSlotChange: (slotId: string, playerId: string | null) => void;
  onPlayerDetails: (player: RosterPlayer) => void;
  teamIceScore?: number;
  totalGames?: number;
  totalStarts?: number;
}

/**
 * Mobile Roster View - Main orchestrator for mobile roster interface
 *
 * Provides a mobile-optimized interface for:
 * - Viewing and managing lineup
 * - Adding/removing players
 * - Viewing roster gaps
 * - Accessing settings
 */
export function MobileRosterView({
  roster,
  leagueProfile,
  projections,
  workingLineup,
  slots,
  timeWindow,
  unusedSlotsByDate,
  onOpenPlayerManagement,
  onOpenLeagueSettings,
  onOpenWeights,
  onSlotChange,
  onPlayerDetails,
  teamIceScore,
  totalGames,
  totalStarts
}: MobileRosterViewProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGapsExpanded, setIsGapsExpanded] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedPlayerForMenu, setSelectedPlayerForMenu] = useState<{
    slotId: string;
    player: RosterPlayer;
  } | null>(null);

  // Convert workingLineup to lineup record for MobileLineupList
  const lineup: Record<string, RosterPlayer | null> = {};
  workingLineup.forEach((item) => {
    lineup[item.slot] = item.player;
  });

  // Prepare gap dates for MobileRosterGapsPanel
  const gapDates = Object.entries(unusedSlotsByDate).map(([date, unusedSlots]) => ({
    date,
    unusedSlots
  }));

  // Get player projections for lineup display
  const lineupProjections: Record<string, { games: number; starts?: number; iceScore?: number }> = {};
  workingLineup.forEach((item) => {
    if (item.player) {
      const projection = projections[item.player.id];
      if (projection) {
        lineupProjections[item.player.id] = {
          games: projection.gamesAvailable || 0,
          starts: projection.starts,
          iceScore: projection.iceScore
        };
      }
    }
  });

  const handleSlotTap = (slotId: string) => {
    setSelectedSlotId(slotId);
    // Open player management with position filter based on slot
    const slot = slots.find((s) => s.id === slotId);
    if (slot) {
      onOpenPlayerManagement({ position: slot.type });
    }
  };

  const handlePlayerMenu = (slotId: string, player: RosterPlayer) => {
    setSelectedPlayerForMenu({ slotId, player });
  };

  const handleMovePlayer = () => {
    // TODO: Implement move player functionality
    setSelectedPlayerForMenu(null);
  };

  const handleRemovePlayer = () => {
    if (selectedPlayerForMenu) {
      onSlotChange(selectedPlayerForMenu.slotId, null);
      setSelectedPlayerForMenu(null);
    }
  };

  const handleViewPlayerDetails = () => {
    if (selectedPlayerForMenu) {
      onPlayerDetails(selectedPlayerForMenu.player);
      setSelectedPlayerForMenu(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-lg border-b border-slate-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Menu Button */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-6 h-6 text-cyan-400" />
            </button>

            {/* Title */}
            <div className="text-center">
              <h1 className="text-lg font-bold text-white">Roster Optimizer</h1>
              {leagueProfile && (
                <div className="text-xs text-slate-400">{leagueProfile.league_name}</div>
              )}
            </div>

            {/* Settings Button */}
            <button
              onClick={onOpenLeagueSettings}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Quick Stats Bar */}
          {teamIceScore !== undefined && (
            <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-700">
              <div className="text-center">
                <div className="text-xs text-cyan-400 uppercase tracking-wide">Team ICE</div>
                <div className="text-xl font-bold text-white">{teamIceScore.toFixed(0)}</div>
              </div>
              {totalGames !== undefined && (
                <div className="text-center">
                  <div className="text-xs text-cyan-400 uppercase tracking-wide">Games</div>
                  <div className="text-xl font-bold text-white">{totalGames}</div>
                </div>
              )}
              {totalStarts !== undefined && (
                <div className="text-center">
                  <div className="text-xs text-cyan-400 uppercase tracking-wide">Starts</div>
                  <div className="text-xl font-bold text-white">{totalStarts}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Roster Gaps Panel */}
        {gapDates.length > 0 && (
          <MobileRosterGapsPanel
            isExpanded={isGapsExpanded}
            onToggle={() => setIsGapsExpanded(!isGapsExpanded)}
            gapDates={gapDates}
          />
        )}

        {/* Lineup List */}
        <MobileLineupList
          lineup={lineup}
          slots={slots}
          onSlotTap={handleSlotTap}
          onPlayerTap={onPlayerDetails}
          onPlayerMenu={handlePlayerMenu}
          projections={lineupProjections}
        />
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => onOpenPlayerManagement()}
        className="fixed right-4 bottom-4 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-40"
        aria-label="Add player"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Menu Bottom Sheet */}
      <MobileBottomSheet
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Menu"
        height="half"
      >
        <div className="space-y-2 pt-4">
          <button
            onClick={() => {
              onOpenPlayerManagement();
              setIsMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-medium">Manage Players</span>
          </button>

          <button
            onClick={() => {
              onOpenWeights();
              setIsMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-medium">Scoring Weights</span>
          </button>

          <button
            onClick={() => {
              onOpenLeagueSettings();
              setIsMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-medium">League Settings</span>
          </button>
        </div>
      </MobileBottomSheet>

      {/* Player Menu Bottom Sheet */}
      <MobileBottomSheet
        isOpen={selectedPlayerForMenu !== null}
        onClose={() => setSelectedPlayerForMenu(null)}
        title={selectedPlayerForMenu?.player.full_name}
        height="half"
      >
        <div className="space-y-2 pt-4">
          <button
            onClick={handleViewPlayerDetails}
            className="w-full flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-medium">View Details</span>
          </button>

          <button
            onClick={handleMovePlayer}
            className="w-full flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <span className="text-white font-medium">Move to...</span>
          </button>

          <button
            onClick={handleRemovePlayer}
            className="w-full flex items-center gap-3 p-4 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors"
          >
            <span className="text-red-300 font-medium">Remove from Roster</span>
          </button>
        </div>
      </MobileBottomSheet>
    </div>
  );
}
