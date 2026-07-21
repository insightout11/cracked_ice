import { useState, useCallback, useMemo, useEffect } from 'react';
import { SCHEDULE_URL } from '../lib/season';
import {
  DndContext,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { MobileHeader, type AppSection } from './components/MobileHeader';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { MobileDragOverlay } from './components/MobileDragOverlay';
import { useMobileNavigation } from './hooks/useMobileNavigation';
import { canDrop, type SlotType } from '../lib/rosterLayout';

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
import { MobileTimeWindowSheet } from './sheets/MobileTimeWindowSheet';

import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { RosterSlot } from '../lib/rosterLayout';
import type { TimeWindowState, TimeWindowPreset, CustomDateRange } from '../types/timeWindow';
import type { WorkingLineupPlayer } from '../components/RosterGrid';
import { calculatePositionSpecificRecommendations } from '../lib/rosterGapsUtils';
import type { ScheduleData } from '../lib/rosterGapsUtils';

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

  // Time window callbacks
  onTimeWindowPresetChange?: (preset: TimeWindowPreset) => void;
  onTimeWindowCustomRangeChange?: (range: CustomDateRange) => void;
  onWeekChange?: (direction: 'prev' | 'next') => void;

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
  onTimeWindowPresetChange,
  onTimeWindowCustomRangeChange,
  onWeekChange,
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
  const [selectingCompareSlot, setSelectingCompareSlot] = useState<'A' | 'B' | null>(null);
  const [timeWindowSheetOpen, setTimeWindowSheetOpen] = useState(false);

  // Watchlist state - persisted to localStorage
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cracked-ice-watchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.warn('Failed to load watchlist from localStorage:', e);
    }
    return new Set();
  });

  // Persist watchlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cracked-ice-watchlist', JSON.stringify([...watchlist]));
    } catch (e) {
      console.warn('Failed to save watchlist to localStorage:', e);
    }
  }, [watchlist]);

  // Simulation state for gaps
  const [simulatingWithout, setSimulatingWithout] = useState<string | null>(null);

  // Schedule data for position-specific recommendations
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Fetch schedule data when gaps tab is active and there are gaps
  useEffect(() => {
    if (activeTab === 'gaps' && !scheduleData && Object.keys(unusedSlotsByDate).length > 0) {
      setIsLoadingSchedule(true);
      fetch(SCHEDULE_URL)
        .then(res => res.json())
        .then(data => {
          setScheduleData(data);
          setIsLoadingSchedule(false);
        })
        .catch(err => {
          console.error('Failed to load schedule data:', err);
          setIsLoadingSchedule(false);
        });
    }
  }, [activeTab, scheduleData, unusedSlotsByDate]);

  // Drag and drop state
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [overSlotId, setOverSlotId] = useState<string | null>(null);

  // Configure touch sensor with 500ms delay to distinguish from swipe
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 500,
      tolerance: 5,
    },
  });
  const sensors = useSensors(touchSensor);

  // Get active player for drag overlay
  const activePlayer = useMemo(() => {
    if (!activePlayerId) return null;
    return roster.find(p => p.id === activePlayerId) || null;
  }, [activePlayerId, roster]);

  // Calculate gap count for badge
  const gapCount = useMemo(() => {
    return Object.values(unusedSlotsByDate).reduce((total, dateSlots) => {
      return total + Object.values(dateSlots).reduce((sum, count) => sum + count, 0);
    }, 0);
  }, [unusedSlotsByDate]);

  // Calculate simulated gaps when a player is selected for removal simulation
  const simulatedUnusedSlots = useMemo(() => {
    if (!simulatingWithout) return unusedSlotsByDate;

    const player = roster.find(p => p.id === simulatingWithout);
    if (!player) return unusedSlotsByDate;

    // Get the player's scheduled games from projections
    const playerProjection = projections[player.id];
    const playerGames = playerProjection?.gamesByDate || {};

    // Deep clone the original gaps
    const newGaps: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(unusedSlotsByDate));

    // For each game the player has, add a gap for that position on that date
    Object.keys(playerGames).forEach(date => {
      if (!newGaps[date]) newGaps[date] = {};
      // Use the player's first position for the gap
      const pos = player.positions?.[0] || 'BN';
      newGaps[date][pos] = (newGaps[date][pos] || 0) + 1;
    });

    return newGaps;
  }, [simulatingWithout, unusedSlotsByDate, roster, projections]);

  // Position-specific recommendations
  const positionRecommendations = useMemo(() => {
    if (!scheduleData) return {};
    return calculatePositionSpecificRecommendations(simulatedUnusedSlots, scheduleData);
  }, [simulatedUnusedSlots, scheduleData]);

  // Convert unusedSlotsByDate to array format for MobileGapsView
  const gapsByDate = useMemo(() => {
    return Object.entries(simulatedUnusedSlots).map(([date, slots]) => ({
      date,
      unusedSlots: slots,
    }));
  }, [simulatedUnusedSlots]);

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
    // If we're selecting a player for comparison
    if (selectingCompareSlot) {
      if (selectingCompareSlot === 'A') {
        setComparePlayerA(player);
      } else {
        setComparePlayerB(player);
      }
      setSelectingCompareSlot(null);
      setComparisonOpen(true);
      return;
    }
    // Normal player tap - open detail sheet
    setSelectedPlayer(player);
    setPlayerDetailOpen(true);
  }, [selectingCompareSlot]);

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

  const handleBrowsePlayers = useCallback((team: string, position: string) => {
    navigateToPlayersWithFilter({ team, position });
  }, [navigateToPlayersWithFilter]);

  const handleApplyFilters = useCallback((newFilters: PlayerFilters) => {
    setFilters(newFilters);
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const playerId = event.active.id as string;
    setActivePlayerId(playerId);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    setOverSlotId(overId);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayerId(null);
    setOverSlotId(null);

    if (!over) return;

    const draggedPlayerId = active.id as string;
    const targetSlotId = over.id as string;

    // Find the source slot (where the dragged player is currently)
    const sourceSlotItem = workingLineup.find(item => item.player?.id === draggedPlayerId);
    if (!sourceSlotItem) return;

    const sourceSlotId = sourceSlotItem.slot;

    // If dropped on same slot, do nothing
    if (sourceSlotId === targetSlotId) return;

    // Find target slot info
    const targetSlot = slots.find(s => s.id === targetSlotId);
    if (!targetSlot) return;

    // Find dragged player
    const draggedPlayer = roster.find(p => p.id === draggedPlayerId);
    if (!draggedPlayer) return;

    // Check if dragged player can go to target slot
    if (!canDrop(draggedPlayer, targetSlot.type as SlotType)) {
      // Invalid drop - could show toast here
      return;
    }

    // Find target slot's current player (if any)
    const targetSlotItem = workingLineup.find(item => item.slot === targetSlotId);
    const targetPlayer = targetSlotItem?.player;

    // Build new lineup atomically to avoid React batching issues
    let newLineup = [...workingLineup];

    if (!targetPlayer) {
      // Target slot is empty - simple move
      // Remove from source, add to target
      newLineup = newLineup.filter(item => item.slot !== sourceSlotId);
      newLineup.push({ player: draggedPlayer, slot: targetSlotId, order: newLineup.length });
    } else {
      // Target slot has a player - need to swap or bump
      const sourceSlot = slots.find(s => s.id === sourceSlotId);
      if (!sourceSlot) return;

      // Check if target player can go to source slot (swap is valid)
      if (canDrop(targetPlayer, sourceSlot.type as SlotType)) {
        // Swap both players atomically
        newLineup = newLineup.map(item => {
          if (item.slot === sourceSlotId) {
            return { ...item, player: targetPlayer };
          }
          if (item.slot === targetSlotId) {
            return { ...item, player: draggedPlayer };
          }
          return item;
        });
      } else {
        // Target player can't go to source slot - bump to first empty bench
        let emptyBenchSlot = slots.find(
          s => s.id.startsWith('BN-') && !newLineup.some(item => item.slot === s.id)
        );

        if (!emptyBenchSlot) {
          // No empty bench slot - bench is unlimited so create a new one
          let maxBnIndex = -1;
          slots.forEach(s => {
            const m = s.id.match(/^BN-(\d+)$/);
            if (m) maxBnIndex = Math.max(maxBnIndex, parseInt(m[1]));
          });
          newLineup.forEach(item => {
            const m = item.slot?.match(/^BN-(\d+)$/);
            if (m) maxBnIndex = Math.max(maxBnIndex, parseInt(m[1]));
          });
          const nextIndex = maxBnIndex + 1;
          emptyBenchSlot = {
            id: `BN-${nextIndex}`,
            type: 'BN' as SlotType,
            index: nextIndex,
            displayName: `BN ${nextIndex + 1}`,
          };
        }

        // Remove dragged player from source, move target to bench, put dragged in target
        newLineup = newLineup.filter(item => item.slot !== sourceSlotId && item.slot !== targetSlotId);
        newLineup.push({ player: targetPlayer, slot: emptyBenchSlot.id, order: newLineup.length });
        newLineup.push({ player: draggedPlayer, slot: targetSlotId, order: newLineup.length });
      }
    }

    onLineupChange(newLineup);
  }, [workingLineup, slots, roster, onLineupChange]);

  // Render the active view
  const renderView = () => {
    switch (activeTab) {
      case 'lineup':
        return (
          <MobileLineupView
            workingLineup={workingLineup}
            slots={slots}
            projections={projections}
            timeWindow={timeWindow}
            teamIceScore={teamIceScore}
            totalGames={totalGames}
            totalStarts={totalStarts}
            onPlayerTap={handlePlayerTap}
            onAddPlayer={handleAddPlayerToSlot}
            onRemovePlayer={handleRemovePlayerFromSlot}
            onOpenTimeWindow={() => setTimeWindowSheetOpen(true)}
            onWeekChange={onWeekChange}
            isDragging={!!activePlayerId}
            activePlayerId={activePlayerId}
            overSlotId={overSlotId}
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
            sheetFilters={filters}
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
            positionRecommendations={positionRecommendations}
            unusedSlotsByDate={simulatedUnusedSlots}
            isLoadingSchedule={isLoadingSchedule}
            roster={roster}
            simulatingWithout={simulatingWithout}
            onSimulateWithout={setSimulatingWithout}
            onTeamClick={handleTeamClick}
            onBrowsePlayers={handleBrowsePlayers}
          />
        );

      case 'settings':
        return (
          <MobileSettingsView
            leagueProfile={leagueProfile}
            onSave={onSaveLeagueProfile}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col"
      style={{ height: '100dvh', minHeight: '100vh' }}
    >
      {/* Header */}
      <MobileHeader
        currentSection={appSection}
        onSectionChange={setAppSection}
        leagueName={leagueProfile.league_name || 'My League'}
        onSettingsClick={handleSettingsClick}
      />

      {/* Comparison Selection Banner */}
      {selectingCompareSlot && (
        <div className="bg-cyan-600 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            Select a player for comparison (Slot {selectingCompareSlot})
          </span>
          <button
            onClick={() => {
              setSelectingCompareSlot(null);
              setComparisonOpen(true);
            }}
            className="text-xs text-cyan-200 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Content Area - scrollable with space for bottom nav */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main className="flex-1 overflow-y-auto pb-20">
          {renderView()}
        </main>

        {/* Drag Overlay - floating preview while dragging */}
        <MobileDragOverlay
          player={activePlayer}
          projection={activePlayer ? projections[activePlayer.id] : undefined}
        />
      </DndContext>

      {/* Bottom Navigation - part of flex layout, not fixed */}
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
        timeWindow={timeWindow}
        leagueProfile={leagueProfile}
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
        onClose={() => {
          setComparisonOpen(false);
          setSelectingCompareSlot(null);
        }}
        playerA={comparePlayerA}
        playerB={comparePlayerB}
        projectionA={comparePlayerA ? projections[comparePlayerA.id] : undefined}
        projectionB={comparePlayerB ? projections[comparePlayerB.id] : undefined}
        onSelectPlayerA={() => {
          // Navigate to players tab to select a player for slot A
          setSelectingCompareSlot('A');
          setComparisonOpen(false);
          setActiveTab('players');
        }}
        onSelectPlayerB={() => {
          // Navigate to players tab to select a player for slot B
          setSelectingCompareSlot('B');
          setComparisonOpen(false);
          setActiveTab('players');
        }}
        onSwapPlayers={() => {
          // Swap: Remove player A from roster, add player B to that slot
          if (comparePlayerA && comparePlayerB) {
            const isAOnRoster = roster.some(p => p.id === comparePlayerA.id);
            const isBOnRoster = roster.some(p => p.id === comparePlayerB.id);

            if (isAOnRoster && !isBOnRoster) {
              // A is on roster, B is free agent - swap them
              const slotId = comparePlayerA.current_slot;
              if (slotId) {
                onRemovePlayer(comparePlayerA.id);
                onAddPlayer(comparePlayerB.id, slotId);
              }
            } else if (isBOnRoster && !isAOnRoster) {
              // B is on roster, A is free agent - swap them
              const slotId = comparePlayerB.current_slot;
              if (slotId) {
                onRemovePlayer(comparePlayerB.id);
                onAddPlayer(comparePlayerA.id, slotId);
              }
            }
            // Clear comparison and close
            setComparePlayerA(null);
            setComparePlayerB(null);
            setComparisonOpen(false);
          }
        }}
        teamImpact={
          // Calculate team impact if swapping roster player with free agent
          comparePlayerA && comparePlayerB
            ? (projections[comparePlayerB.id]?.iceScore ?? 0) - (projections[comparePlayerA.id]?.iceScore ?? 0)
            : undefined
        }
      />

      {/* Time Window Sheet */}
      {onTimeWindowPresetChange && onTimeWindowCustomRangeChange && (
        <MobileTimeWindowSheet
          isOpen={timeWindowSheetOpen}
          onClose={() => setTimeWindowSheetOpen(false)}
          timeWindow={timeWindow}
          onPresetChange={onTimeWindowPresetChange}
          onCustomRangeChange={onTimeWindowCustomRangeChange}
        />
      )}
    </div>
  );
}
