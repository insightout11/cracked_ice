import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
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
import { MobileHeader } from './components/MobileHeader';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { MobileDragOverlay } from './components/MobileDragOverlay';
import { useMobileNavigation } from './hooks/useMobileNavigation';
import { getPlayerProjection } from '../lib/playerProjection';
import { canDrop, type SlotType } from '../lib/rosterLayout';

// Views
import { MobileLineupView } from './views/MobileLineupView';
import { MobilePlayersView } from './views/MobilePlayersView';
import { MobileGapsView } from './views/MobileGapsView';
import { MobileSettingsView } from './views/MobileSettingsView';
import { PlayerDetailModal } from '../components/PlayerDetailModal';
import { Plus, Star, Trash2 } from 'lucide-react';

// Sheets
import { MobileSlotPickerSheet } from './sheets/MobileSlotPickerSheet';
import { MobileFilterSheet, defaultFilters, type PlayerFilters } from './sheets/MobileFilterSheet';
import { MobileTimeWindowSheet } from './sheets/MobileTimeWindowSheet';

import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { RosterSlot } from '../lib/rosterLayout';
import type { TimeWindowState, TimeWindowPreset, CustomDateRange } from '../types/timeWindow';
import type { WorkingLineupPlayer } from '../components/RosterGrid';
import { calculatePositionSpecificRecommendations, filterUnusedSlotsToGameDates } from '../lib/rosterGapsUtils';
import type { ScheduleData } from '../lib/rosterGapsUtils';
import { personalizeIceForOpenRosterSlot } from '../lib/iceRating';
import { apiService } from '../services/api';
import { buildGapSimulationRoster } from '../lib/rosterGapsUtils';
import { useLeagueWorkspace } from '../contexts/LeagueWorkspaceContext';
import { createLeagueCandidateObservation, isLeagueCandidateCurrent, upsertLeagueCandidates } from '../lib/leagueWorkspace';
import { useNavigate } from 'react-router-dom';

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
  isLoadingProjections?: boolean;
  projectionError?: string | null;
  overview?: ReactNode;
  pickupBoard?: ReactNode;

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
 * - Product-aligned app header with account sync and league settings
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
  isLoadingProjections = false,
  projectionError = null,
  overview,
  pickupBoard,
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
  const navigate = useNavigate();
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const {
    activeTab,
    setActiveTab,
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
  const [timeWindowSheetOpen, setTimeWindowSheetOpen] = useState(false);
  const [targetRosterSlot, setTargetRosterSlot] = useState<RosterSlot | null>(null);

  const candidateProjections = useMemo<Record<string, PlayerProjection>>(() => {
    if (!targetRosterSlot || !['C', 'LW', 'RW', 'D', 'G', 'F', 'UTIL'].includes(targetRosterSlot.type)) {
      return projections;
    }
    return Object.fromEntries(
      Object.entries(projections).map(([playerId, projection]) => [
        playerId,
        personalizeIceForOpenRosterSlot(projection),
      ]),
    );
  }, [projections, targetRosterSlot]);

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
  const [gapSimulation, setGapSimulation] = useState<{
    unusedSlotsByDate: Record<string, Record<string, number>>;
    isLoading: boolean;
    error: string | null;
  } | null>(null);

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

  useEffect(() => {
    if (!simulatingWithout) {
      setGapSimulation(null);
      return;
    }

    let cancelled = false;
    setGapSimulation({ unusedSlotsByDate: {}, isLoading: true, error: null });
    apiService.applyRosterLineup({
      league: leagueProfile,
      window: {
        start: timeWindow.config.startUtc.split('T')[0],
        end: timeWindow.config.endUtc.split('T')[0],
      },
      roster: buildGapSimulationRoster(workingLineup, simulatingWithout),
    }).then((response) => {
      if (cancelled) return;
      setGapSimulation({
        unusedSlotsByDate: response.meta?.simulation?.unusedSlotsByDate ?? {},
        isLoading: false,
        error: null,
      });
    }).catch(() => {
      if (cancelled) return;
      setGapSimulation({
        unusedSlotsByDate: {},
        isLoading: false,
        error: 'Could not re-solve the lineup without this player.',
      });
    });

    return () => { cancelled = true; };
  }, [leagueProfile, simulatingWithout, timeWindow.config.endUtc, timeWindow.config.startUtc, workingLineup]);

  const simulatedUnusedSlots = gapSimulation && !gapSimulation.isLoading && !gapSimulation.error
    ? gapSimulation.unusedSlotsByDate
    : unusedSlotsByDate;

  const actionableUnusedSlots = useMemo(
    () => filterUnusedSlotsToGameDates(simulatedUnusedSlots, scheduleData),
    [scheduleData, simulatedUnusedSlots],
  );

  // Position-specific recommendations
  const positionRecommendations = useMemo(() => {
    if (!scheduleData) return {};
    return calculatePositionSpecificRecommendations(actionableUnusedSlots, scheduleData);
  }, [actionableUnusedSlots, scheduleData]);

  // Convert unusedSlotsByDate to array format for MobileGapsView
  const gapsByDate = useMemo(() => {
    return Object.entries(actionableUnusedSlots).map(([date, slots]) => ({
      date,
      unusedSlots: slots,
    }));
  }, [actionableUnusedSlots]);

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

  const confirmedCandidateIds = useMemo(() => new Set(
    activeLeague.candidates
      .filter((candidate) => isLeagueCandidateCurrent(candidate))
      .map((candidate) => candidate.playerId.replace(/^nhl:/, '')),
  ), [activeLeague.candidates]);

  const handleConfirmAvailable = useCallback((playerId: string) => {
    const now = new Date().toISOString();
    updateLeague({
      ...activeLeague,
      candidates: upsertLeagueCandidates(activeLeague.candidates, [
        createLeagueCandidateObservation(playerId, 'user-confirmed', now),
      ]),
      updatedAt: now,
    });
  }, [activeLeague, updateLeague]);

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
    const slot = slots.find((candidate) => candidate.id === slotId) ?? null;
    setTargetRosterSlot(slot);
    const positionFilter = ['C', 'LW', 'RW', 'D', 'G'].includes(position) ? position : undefined;
    navigateToPlayersWithFilter({ position: positionFilter });
  }, [navigateToPlayersWithFilter, slots]);

  const handleRemovePlayerFromSlot = useCallback((slotId: string, playerId: string) => {
    onSlotChange(slotId, null);
  }, [onSlotChange]);

  const handleOpenSlotPicker = useCallback((player: RosterPlayer) => {
    if (targetRosterSlot && canDrop(player, targetRosterSlot.type)) {
      onAddPlayer(player.id, targetRosterSlot.id);
      setTargetRosterSlot(null);
      clearPlayerFilters();
      setActiveTab('lineup');
      return;
    }
    setSlotPickerPlayer(player);
    setSlotPickerOpen(true);
  }, [clearPlayerFilters, onAddPlayer, setActiveTab, targetRosterSlot]);

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
      setPlayerDetailOpen(false);
      navigate(`/compare?a=${encodeURIComponent(selectedPlayer.id.replace(/^nhl:/, ''))}`);
    }
  }, [navigate, selectedPlayer]);

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
          <>
            {pickupBoard}
            <MobilePlayersView
              roster={roster}
              projections={candidateProjections}
              watchlist={watchlist}
              freeAgents={freeAgents}
              isLoadingFreeAgents={isLoadingFreeAgents}
              initialPositionFilter={navFilters.position}
              initialTeamFilter={navFilters.team}
              sheetFilters={filters}
              onPlayerTap={handlePlayerTap}
              onAddPlayer={handleOpenSlotPicker}
              onToggleWatch={handleToggleWatch}
              confirmedCandidateIds={confirmedCandidateIds}
              onConfirmAvailable={handleConfirmAvailable}
              onOpenFilters={() => setFilterSheetOpen(true)}
              onClearFilters={clearPlayerFilters}
              targetSlotLabel={targetRosterSlot?.displayName}
              onCancelTargetSlot={() => {
                setTargetRosterSlot(null);
                clearPlayerFilters();
                setActiveTab('lineup');
              }}
            />
          </>
        );

      case 'gaps':
        return (
          <MobileGapsView
            gapsByDate={gapsByDate}
            positionRecommendations={positionRecommendations}
            unusedSlotsByDate={actionableUnusedSlots}
            isLoadingSchedule={isLoadingSchedule}
            isLoading={isLoadingProjections || Boolean(gapSimulation?.isLoading)}
            dataError={projectionError}
            simulationError={gapSimulation?.error ?? null}
            roster={roster}
            simulatingWithout={simulatingWithout}
            onSimulateWithout={setSimulatingWithout}
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
      className='bg-gradient-to-br from-surface-2 via-surface-2 to-surface-2 flex flex-col h-[100dvh] min-h-[100vh]'>
      {/* Header */}
      <MobileHeader
        leagueName={leagueProfile.league_name || 'My League'}
        onSettingsClick={handleSettingsClick}
      />
      {/* Main Content Area - scrollable with space for bottom nav */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main className="flex-1 overflow-y-auto pb-20">
          {renderView()}
          {activeTab === 'lineup' && overview}
        </main>

        {/* Drag Overlay - floating preview while dragging */}
        <MobileDragOverlay
          player={activePlayer}
          projection={activePlayer ? getPlayerProjection(projections, activePlayer.id) : undefined}
        />
      </DndContext>
      {/* Bottom Navigation - part of flex layout, not fixed */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        gapCount={gapCount}
      />
      {/* Player Detail Sheet */}
      {selectedPlayer && (
        <PlayerDetailModal
          isOpen={playerDetailOpen}
          onClose={() => setPlayerDetailOpen(false)}
          player={selectedPlayer}
          projection={getPlayerProjection(projections, selectedPlayer.id)}
          timeWindow={timeWindow}
          leagueProfile={leagueProfile}
          onCompare={handleCompare}
          footerActions={(
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button
                type="button"
                onClick={() => handleToggleWatch(selectedPlayer.id)}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 ${watchlist.has(selectedPlayer.id) ? 'border-warning/50 bg-warning-muted text-warning' : 'border-line bg-surface-1 text-ink-dim'}`}
                aria-label={watchlist.has(selectedPlayer.id) ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <Star className={`h-5 w-5 ${watchlist.has(selectedPlayer.id) ? 'fill-current' : ''}`} />
              </button>
              {roster.some((player) => player.id === selectedPlayer.id) ? (
                <button
                  type="button"
                  onClick={() => {
                    onRemovePlayer(selectedPlayer.id);
                    setPlayerDetailOpen(false);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-negative/40 bg-negative-muted px-4 font-semibold text-negative"
                >
                  <Trash2 className="h-4 w-4" /> Remove from team
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPlayerDetailOpen(false);
                    handleOpenSlotPicker(selectedPlayer);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-surface-0"
                >
                  <Plus className="h-4 w-4" /> Add to team
                </button>
              )}
            </div>
          )}
        />
      )}
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
