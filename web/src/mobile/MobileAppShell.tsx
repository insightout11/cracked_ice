import { useState, useCallback, useMemo } from 'react';
import { MobileHeader, type AppSection } from './components/MobileHeader';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { useMobileNavigation } from './hooks/useMobileNavigation';

// Views
import { MobileLineupView } from './views/MobileLineupView';
import { MobilePlayersView } from './views/MobilePlayersView';
import { MobileGapsView } from './views/MobileGapsView';
import { MobileSettingsView } from './views/MobileSettingsView';

// Sheets
import { MobilePlayerDetailSheet } from './sheets/MobilePlayerDetailSheet';
import { MobileSlotPickerSheet } from './sheets/MobileSlotPickerSheet';
import { MobileFilterSheet, defaultFilters, type PlayerFilters } from './sheets/MobileFilterSheet';
import { MobileComparisonSheet } from './sheets/MobileComparisonSheet';

import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { RosterSlot } from '../lib/rosterLayout';
import type { TimeWindowState } from '../types/timeWindow';
import type { WorkingLineupPlayer } from '../components/RosterGrid';

export interface MobileAppShellProps {
  // Data
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  workingLineup: WorkingLineupPlayer[];
  slots: RosterSlot[];
  timeWindow: TimeWindowState;
  unusedSlotsByDate: Record<string, Record<string, number>>;
  freeAgents?: RosterPlayer[];
  isLoadingFreeAgents?: boolean;

  // Callbacks
  onSlotChange: (slotId: string, playerId: string | null) => void;
  onPlayerDetails: (player: RosterPlayer) => void;
  onLineupChange: (lineup: WorkingLineupPlayer[]) => void;
  onSaveLeagueProfile: (profile: LeagueProfile) => void;
  onAddPlayer: (playerId: string, slot: string) => void;
  onRemovePlayer: (playerId: string) => void;

  // Computed values
  teamIceScore?: number;
  totalGames?: number;
  totalStarts?: number;
}

/**
 * MobileAppShell - Main container for mobile experience
 *
 * Provides:
 * - App header with section switching (Ice Level / Press Box / Front Office)
 * - Bottom tab navigation (Lineup / Players / Gaps / Settings)
 * - Renders the active view based on selected tab
 * - Manages sheet state (player details, slot picker, filters, comparison)
 */
export function MobileAppShell({
  roster,
  leagueProfile,
  projections,
  workingLineup,
  slots,
  timeWindow,
  unusedSlotsByDate,
  freeAgents = [],
  isLoadingFreeAgents = false,
  onSlotChange,
  onPlayerDetails,
  onLineupChange,
  onSaveLeagueProfile,
  onAddPlayer,
  onRemovePlayer,
  teamIceScore,
  totalGames,
  totalStarts,
}: MobileAppShellProps) {
  const {
    activeTab,
    setActiveTab,
    appSection,
    setAppSection,
    playerFilters: navFilters,
    setPlayerFilters: setNavFilters,
    clearPlayerFilters,
    navigateToPlayersWithFilter,
  } = useMobileNavigation();

  // Sheet states
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);
  const [playerDetailOpen, setPlayerDetailOpen] = useState(false);
  const [slotPickerPlayer, setSlotPickerPlayer] = useState<RosterPlayer | null>(null);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<PlayerFilters>(defaultFilters);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparePlayerA, setComparePlayerA] = useState<RosterPlayer | null>(null);
  const [comparePlayerB, setComparePlayerB] = useState<RosterPlayer | null>(null);

  // Watchlist state
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  // Simulation state for gaps
  const [simulatingWithout, setSimulatingWithout] = useState<string | null>(null);

  // Calculate gap count for badge
  const gapCount = useMemo(() => {
    return Object.values(unusedSlotsByDate).reduce((total, dateSlots) => {
      return total + Object.values(dateSlots).reduce((sum, count) => sum + count, 0);
    }, 0);
  }, [unusedSlotsByDate]);

  // Convert unusedSlotsByDate to array format for MobileGapsView
  const gapsByDate = useMemo(() => {
    return Object.entries(unusedSlotsByDate).map(([date, slots]) => ({
      date,
      unusedSlots: slots,
    }));
  }, [unusedSlotsByDate]);

  // Get current lineup as record for slot picker
  const currentLineup = useMemo(() => {
    const lookup: Record<string, RosterPlayer | null> = {};
    workingLineup.forEach((item) => {
      lookup[item.slot] = item.player;
    });
    return lookup;
  }, [workingLineup]);

  // Get unique teams for filter
  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    roster.forEach((p) => teams.add(p.team));
    freeAgents.forEach((p) => teams.add(p.team));
    return Array.from(teams).sort();
  }, [roster, freeAgents]);

  // Team recommendations for gaps (mock - would come from actual analysis)
  const teamRecommendations = useMemo(() => {
    // Simple mock calculation - in real app would be more sophisticated
    const teamGaps: Record<string, number> = {};
    const teamPlayers: Record<string, number> = {};

    freeAgents.forEach((p) => {
      teamPlayers[p.team] = (teamPlayers[p.team] || 0) + 1;
    });

    // For now, just return top teams with most free agents
    return Object.entries(teamPlayers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([team, count]) => ({
        team,
        gapsFilled: Math.min(count, 3), // Mock value
        playersAvailable: count,
      }));
  }, [freeAgents]);

  // Handlers
  const handleSettingsClick = useCallback(() => {
    setActiveTab('settings');
  }, [setActiveTab]);

  const handlePlayerTap = useCallback((player: RosterPlayer) => {
    setSelectedPlayer(player);
    setPlayerDetailOpen(true);
  }, []);

  const handlePlayerMenu = useCallback((slotId: string, player: RosterPlayer) => {
    // For now, open player detail sheet
    setSelectedPlayer(player);
    setPlayerDetailOpen(true);
  }, []);

  const handleAddPlayerToSlot = useCallback((slotId: string, position: string) => {
    // Navigate to players tab filtered by position
    navigateToPlayersWithFilter({ position });
  }, [navigateToPlayersWithFilter]);

  const handleRemovePlayerFromSlot = useCallback((slotId: string, playerId: string) => {
    onSlotChange(slotId, null);
  }, [onSlotChange]);

  const handleOpenSlotPicker = useCallback((player: RosterPlayer) => {
    setSlotPickerPlayer(player);
    setSlotPickerOpen(true);
  }, []);

  const handleSelectSlot = useCallback((slotId: string) => {
    if (slotPickerPlayer) {
      onAddPlayer(slotPickerPlayer.id, slotId);
      setSlotPickerOpen(false);
      setSlotPickerPlayer(null);
    }
  }, [slotPickerPlayer, onAddPlayer]);

  const handleToggleWatch = useCallback((playerId: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedPlayer) {
      setComparePlayerA(selectedPlayer);
      setPlayerDetailOpen(false);
      setComparisonOpen(true);
    }
  }, [selectedPlayer]);

  const handleTeamClick = useCallback((team: string) => {
    navigateToPlayersWithFilter({ team });
  }, [navigateToPlayersWithFilter]);

  const handleApplyFilters = useCallback((newFilters: PlayerFilters) => {
    setFilters(newFilters);
  }, []);

  // Render the active view
  const renderView = () => {
    switch (activeTab) {
      case 'lineup':
        return (
          <MobileLineupView
            workingLineup={workingLineup}
            slots={slots}
            projections={projections}
            teamIceScore={teamIceScore}
            totalGames={totalGames}
            totalStarts={totalStarts}
            onPlayerTap={handlePlayerTap}
            onPlayerMenu={handlePlayerMenu}
            onAddPlayer={handleAddPlayerToSlot}
            onRemovePlayer={handleRemovePlayerFromSlot}
          />
        );

      case 'players':
        return (
          <MobilePlayersView
            roster={roster}
            projections={projections}
            watchlist={watchlist}
            freeAgents={freeAgents}
            isLoadingFreeAgents={isLoadingFreeAgents}
            initialPositionFilter={navFilters.position}
            initialTeamFilter={navFilters.team}
            onPlayerTap={handlePlayerTap}
            onAddPlayer={handleOpenSlotPicker}
            onToggleWatch={handleToggleWatch}
            onOpenFilters={() => setFilterSheetOpen(true)}
            onClearFilters={clearPlayerFilters}
          />
        );

      case 'gaps':
        return (
          <MobileGapsView
            gapsByDate={gapsByDate}
            teamRecommendations={teamRecommendations}
            roster={roster}
            simulatingWithout={simulatingWithout}
            onSimulateWithout={setSimulatingWithout}
            onTeamClick={handleTeamClick}
          />
        );

      case 'settings':
        // Calculate roster structure from lineup_slots
        const lineupSlots = leagueProfile.lineup_slots || {};
        const forwards = (lineupSlots['C'] || 0) + (lineupSlots['LW'] || 0) +
                        (lineupSlots['RW'] || 0) + (lineupSlots['F'] || 0) + (lineupSlots['UTIL'] || 0);
        const defense = lineupSlots['D'] || 0;
        const goalies = lineupSlots['G'] || 0;
        const bench = lineupSlots['BN'] || 0;
        const ir = (lineupSlots['IR'] || 0) + (lineupSlots['IR+'] || 0);

        return (
          <MobileSettingsView
            leagueInfo={{
              name: leagueProfile.league_name || 'My League',
              teams: leagueProfile.num_teams || 12,
              scoringType: leagueProfile.scoring_type || 'points',
              platform: 'Yahoo Fantasy',
            }}
            rosterStructure={{
              forwards,
              defense,
              goalies,
              bench,
              ir,
            }}
            skaterWeights={Object.entries(leagueProfile.skater_scoring || {}).map(
              ([category, value]) => ({ category, value: value as number })
            )}
            goalieWeights={Object.entries(leagueProfile.goalie_scoring || {}).map(
              ([category, value]) => ({ category, value: value as number })
            )}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <MobileHeader
        currentSection={appSection}
        onSectionChange={setAppSection}
        leagueName={leagueProfile.league_name}
        onSettingsClick={handleSettingsClick}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        {renderView()}
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        gapCount={gapCount}
      />

      {/* Player Detail Sheet */}
      <MobilePlayerDetailSheet
        isOpen={playerDetailOpen}
        onClose={() => setPlayerDetailOpen(false)}
        player={selectedPlayer}
        projection={selectedPlayer ? projections[selectedPlayer.id] : undefined}
        isOnRoster={selectedPlayer ? roster.some(p => p.id === selectedPlayer.id) : false}
        isWatched={selectedPlayer ? watchlist.has(selectedPlayer.id) : false}
        onAddToSlot={() => {
          if (selectedPlayer) {
            setPlayerDetailOpen(false);
            handleOpenSlotPicker(selectedPlayer);
          }
        }}
        onCompare={handleCompare}
        onToggleWatch={() => {
          if (selectedPlayer) {
            handleToggleWatch(selectedPlayer.id);
          }
        }}
        onRemove={() => {
          if (selectedPlayer) {
            onRemovePlayer(selectedPlayer.id);
            setPlayerDetailOpen(false);
          }
        }}
      />

      {/* Slot Picker Sheet */}
      <MobileSlotPickerSheet
        isOpen={slotPickerOpen}
        onClose={() => {
          setSlotPickerOpen(false);
          setSlotPickerPlayer(null);
        }}
        player={slotPickerPlayer}
        slots={slots}
        currentLineup={currentLineup}
        onSelectSlot={handleSelectSlot}
      />

      {/* Filter Sheet */}
      <MobileFilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onApply={handleApplyFilters}
        availableTeams={availableTeams}
      />

      {/* Comparison Sheet */}
      <MobileComparisonSheet
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        playerA={comparePlayerA}
        playerB={comparePlayerB}
        projectionA={comparePlayerA ? projections[comparePlayerA.id] : undefined}
        projectionB={comparePlayerB ? projections[comparePlayerB.id] : undefined}
        onSelectPlayerA={() => {
          // Could open a player picker here
        }}
        onSelectPlayerB={() => {
          // Could open a player picker here
        }}
        onSwapPlayers={() => {
          // Handle swap logic
          if (comparePlayerA && comparePlayerB) {
            // Implementation depends on business logic
            setComparisonOpen(false);
          }
        }}
      />
    </div>
  );
}
