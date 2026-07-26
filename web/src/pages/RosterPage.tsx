import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useTimeWindow } from '../hooks/useTimeWindow';
import { useTeamTiers } from '../contexts/TeamTierContext';
import { apiService } from '../services/api';
import type {
  RosterPlayer,
  LeagueProfile,
  ProjectionsResponse,
  PlayerProjection,
  ProjectionsRequest,
  HealthResponse,
} from '../lib/coachSchemas';
import type { PlayerSearchResult } from '../types';
import { RosterGrid, WorkingLineupPlayer } from '../components/RosterGrid';
import { TimeWindow } from '../components/TimeWindow/TimeWindow';
import { LeaguePresetBar } from '../components/LeaguePresetBar';
import { WeightsDrawer } from '../components/WeightsDrawer';
import { LeagueWorkspaceControl } from '../components/league/LeagueWorkspaceControl';
import { ImageUploadZone } from '../components/ImageUploadZone';
import { CoachPlayerSearchPanel } from '../components/CoachPlayerSearchPanel';
import { PlayerManagementDrawer } from '../components/PlayerManagementDrawer';
import { SlotPicker } from '../components/PlayerManagement/SlotPicker';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { RosterHeader } from '../components/RosterHeader';
import { ShareRosterModal } from '../components/ShareRosterModal';
import { PlayerDetailModal } from '../components/PlayerDetailModal';
import { TeamStatsScoreboard } from '../components/TeamStatsScoreboard';
import type { WorkingLineupItem } from '../lib/teamMetrics';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { MobileAppShell } from '../mobile/MobileAppShell';
import { buildRosterRows, canDrop, type RosterSlot } from '../lib/rosterLayout';
import { normalizePlayers } from '../mobile/utils/normalizePlayer';
import { calculateProjectionsForPlayers, mergeProjections } from '../mobile/utils/calculateProjection';
import { getStartOfIsoWeek } from '../lib/schedule';
import { addDays, format } from 'date-fns';
import { ClipboardPaste } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/ui/button';
import { BulkImportPanel } from '../components/players/BulkImportPanel';
import { useLeagueWorkspace } from '../contexts/LeagueWorkspaceContext';
import { mergeLegacyLeagueProfile, toLeagueProfile } from '../lib/leagueWorkspace';
import { analyzeMyTeam, enrichWorkspaceRosterPlayers, reconcileWorkspaceRoster, rosterPlayersFromWorkspace, shouldAdoptLegacyRoster } from '../lib/myTeamAnalysis';
import { MyTeamOverview } from '../components/team/MyTeamOverview';
import { PickupBoard } from '../components/team/PickupBoard';
import { getPlayerProjection } from '../lib/playerProjection';
import { Link, useNavigate } from 'react-router-dom';

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string; message?: string }>(error)) {
    return error.response?.data?.error ?? error.response?.data?.message ?? error.message ?? fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function isCanceledRequest(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? error.name : undefined;
  return name === 'AbortError' || name === 'CanceledError';
}

export const RosterPage: React.FC = () => {
  const navigate = useNavigate();
  const timeWindow = useTimeWindow();
  const teamTiers = useTeamTiers();
  const deviceType = useDeviceDetection();
  const { activeLeague, mergeLegacyProfile, updateLeague } = useLeagueWorkspace();
  const mergeLegacyProfileRef = useRef(mergeLegacyProfile);
  const activeLeagueRef = useRef(activeLeague);
  const updateLeagueRef = useRef(updateLeague);
  const skipWorkspaceReconcileRef = useRef(false);
  const rosterLeagueIdRef = useRef(activeLeague.id);

  const [roster, setRoster] = useState<RosterPlayer[]>(() => rosterPlayersFromWorkspace(activeLeague));
  const [leagueProfile, setLeagueProfile] = useState<LeagueProfile | null>(() => toLeagueProfile(activeLeague));
  const [projections, setProjections] = useState<Record<string, PlayerProjection>>({});
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [unusedSlotsByDate, setUnusedSlotsByDate] = useState<Record<string, Record<string, number>>>({});
  const [totalNHLGamesInWindow, setTotalNHLGamesInWindow] = useState<number>(0);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingProjections, setIsLoadingProjections] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [workingLineup, setWorkingLineup] = useState<WorkingLineupPlayer[]>([]);
  const [weightsSource, setWeightsSource] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isWeightsDrawerOpen, setIsWeightsDrawerOpen] = useState(false);
  const [isLeagueSettingsOpen, setIsLeagueSettingsOpen] = useState(false);

  // Roster setup state
  const [isUploadingRoster, setIsUploadingRoster] = useState(false);
  const [rosterPreview, setRosterPreview] = useState<string | undefined>(undefined);
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);
  const [isPlayerManagementOpen, setIsPlayerManagementOpen] = useState(false);
  const [isQuickImportOpen, setIsQuickImportOpen] = useState(false);
  const [rosterImportPlayers, setRosterImportPlayers] = useState<PlayerSearchResult[]>([]);
  const [isLoadingRosterImport, setIsLoadingRosterImport] = useState(false);
  const [rosterImportStatus, setRosterImportStatus] = useState<string | null>(null);
  const [playerManagementFilters, setPlayerManagementFilters] = useState<{
    team?: string;
    position?: string;
  }>({});

  // Slot picker state
  const [isSlotPickerOpen, setIsSlotPickerOpen] = useState(false);
  const [pendingPlayer, setPendingPlayer] = useState<PlayerSearchResult | null>(null);
  const [targetRosterSlot, setTargetRosterSlot] = useState<RosterSlot | null>(null);

  // Card density mode
  const [cardDensity, setCardDensity] = useState<'full' | 'compact'>('full');

  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Player detail modal state
  const [playerDetailModal, setPlayerDetailModal] = useState<{
    isOpen: boolean;
    player: RosterPlayer | null;
  }>({ isOpen: false, player: null });

  // Free agents for comparison drawer and mobile
  const [freeAgentsForComparison, setFreeAgentsForComparison] = useState<RosterPlayer[]>([]);
  const [isLoadingFreeAgents, setIsLoadingFreeAgents] = useState(false);

  // Abort controller for projection requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save refs
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastSavedLineupRef = useRef<string>('');

  useEffect(() => {
    activeLeagueRef.current = activeLeague;
    updateLeagueRef.current = updateLeague;
    mergeLegacyProfileRef.current = mergeLegacyProfile;
  }, [activeLeague, mergeLegacyProfile, updateLeague]);

  useEffect(() => {
    if (rosterLeagueIdRef.current === activeLeague.id) return;
    rosterLeagueIdRef.current = activeLeague.id;
    skipWorkspaceReconcileRef.current = true;
    setRoster(rosterPlayersFromWorkspace(activeLeague));
    setWorkingLineup([]);
    setProjections({});
    setUnusedSlotsByDate({});
  }, [activeLeague.id]);

  useEffect(() => {
    setLeagueProfile(toLeagueProfile(activeLeague));
    setSelectedPreset(activeLeague.scoring.label);
  }, [activeLeague]);

  useEffect(() => {
    if (isLoadingData) return;
    if (skipWorkspaceReconcileRef.current) {
      skipWorkspaceReconcileRef.current = false;
      return;
    }
    const nextRoster = reconcileWorkspaceRoster(activeLeague.roster, roster);
    if (JSON.stringify(nextRoster) === JSON.stringify(activeLeague.roster)) return;
    updateLeague({ ...activeLeague, roster: nextRoster, updatedAt: new Date().toISOString() });
  }, [activeLeague, isLoadingData, roster, updateLeague]);

  const myTeamAnalysis = useMemo(
    () => analyzeMyTeam(activeLeague, projections, unusedSlotsByDate),
    [activeLeague, projections, unusedSlotsByDate],
  );

  const toggleRosterFlag = useCallback((playerId: string, flag: 'keeper' | 'protected') => {
    updateLeague({
      ...activeLeague,
      roster: activeLeague.roster.map((entry) => entry.playerId === playerId
        ? { ...entry, [flag]: !entry[flag] }
        : entry),
      updatedAt: new Date().toISOString(),
    });
  }, [activeLeague, updateLeague]);

  const updateKeeperCost = useCallback((playerId: string, keeperCost: typeof activeLeague.roster[number]['keeperCost']) => {
    updateLeague({
      ...activeLeague,
      roster: activeLeague.roster.map((entry) => entry.playerId === playerId ? { ...entry, keeperCost } : entry),
      updatedAt: new Date().toISOString(),
    });
  }, [activeLeague, updateLeague]);

  const handleCompareKeeper = useCallback((playerId: string) => {
    navigate(`/compare?mode=keeper&a=${encodeURIComponent(playerId.replace(/^nhl:/, ''))}`);
  }, [navigate]);

  // Load initial data (health, context, roster)
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingData(true);
      setError(null);

      try {
        // Health check (non-blocking)
        const healthRes = await apiService.getCoachHealth().catch((err) => {
          console.warn('Health check failed:', err);
          return null;
        });
        setHealthStatus(healthRes);

        // Load context and roster in parallel
        const [contextRes, rosterRes] = await Promise.all([
          apiService.getCoachContext(),
          apiService.getCoachRoster(leagueProfile),
        ]);


        const legacyRoster = rosterRes.roster || [];
        const workspace = activeLeagueRef.current;
        const adoptLegacyRoster = shouldAdoptLegacyRoster(workspace, legacyRoster);

        // The League Workspace is authoritative after migration. Legacy coach data is
        // imported only into an otherwise-empty, migratable workspace.
        if (adoptLegacyRoster) setRoster(legacyRoster);
        else setRoster(enrichWorkspaceRosterPlayers(workspace, legacyRoster));

        if (contextRes.league_profile && adoptLegacyRoster) {
          // Ensure IR+ is defined if IR is defined (common Yahoo setup)
          const profile = { ...contextRes.league_profile };
          if (profile.lineup_slots) {
            profile.lineup_slots = { ...profile.lineup_slots };
            // If IR exists but IR+ doesn't, add IR+ with count of 1
            if (profile.lineup_slots['IR'] && !profile.lineup_slots['IR+']) {
              profile.lineup_slots['IR+'] = 1;
            }
          }
          mergeLegacyProfileRef.current(profile, legacyRoster);
        } else if (adoptLegacyRoster) {
          updateLeagueRef.current({
            ...workspace,
            roster: reconcileWorkspaceRoster([], legacyRoster),
            source: { kind: 'legacy-coach', label: 'Migrated from the existing roster workspace' },
            freshness: { ...workspace.freshness, importedAt: new Date().toISOString() },
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        console.error('Failed to load initial data:', err);
        setError(errorMessage(err, 'Failed to load roster data. Please try again.'));
      } finally {
        setIsLoadingData(false);
      }
    };

    loadInitialData();
  }, []);

  // Apply lineup and fetch projections
  const applyLineup = useCallback(
    async (lineup: WorkingLineupPlayer[]) => {
      if (!leagueProfile || !timeWindow.state.config) return;
      if (!timeWindow.state.config.startUtc || !timeWindow.state.config.endUtc) {
        console.warn('Time window not fully configured yet');
        return;
      }

      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the request
      debounceTimerRef.current = setTimeout(async () => {
        setIsLoadingProjections(true);
        setProjectionError(null);

        try {
          // Create abort controller for this request
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const request: ProjectionsRequest = {
            league: leagueProfile,
            window: {
              start: timeWindow.state.config.startUtc.split('T')[0],
              end: timeWindow.state.config.endUtc.split('T')[0],
            },
            roster: lineup.map((item) => {
              // Extract slot type without index (strip "-0", "-1", etc.)
              // Handle IR+ specially (don't split on the +)
              const slotType = item.slot.includes('IR+')
                ? 'IR+'
                : item.slot.split('-')[0];

              return {
                playerId: item.player.id,
                slot: slotType,
              };
            }),
          };


          const response: ProjectionsResponse = await apiService.applyRosterLineup(request);

          // Only update if this request wasn't aborted
          if (!controller.signal.aborted) {
            setProjections(prev => ({ ...prev, ...response.projections }));
            setWeightsSource(response.meta?.weightsSource || null);
            setUnusedSlotsByDate(response.meta?.simulation?.unusedSlotsByDate || {});
            setTotalNHLGamesInWindow(response.meta?.totalNHLGamesInWindow || 0);
            setProjectionError(null);
          }
        } catch (err: unknown) {
          if (!isCanceledRequest(err)) {
            console.error('Failed to apply lineup:', err);
            const message = 'Failed to calculate projections. Please try again.';
            setProjectionError(message);
            setError(message);
          }
        } finally {
          setIsLoadingProjections(false);
          abortControllerRef.current = null;
        }
      }, 300); // 300ms debounce
    },
    [leagueProfile, timeWindow.state.config]
  );

  // Handle lineup changes from RosterGrid
  const handleLineupChange = useCallback(
    (lineup: WorkingLineupPlayer[]) => {
      setWorkingLineup(lineup);
      const slotByPlayer = new Map(lineup.map((item) => [item.player.id, item.slot]));
      setRoster((current) => current.map((player) => ({
        ...player,
        current_slot: slotByPlayer.get(player.id) ?? player.current_slot,
      })));
    },
    []
  );

  // Auto-apply projections when lineup, time window, or league profile changes
  useEffect(() => {
    if (workingLineup.length > 0 && leagueProfile) {
      applyLineup(workingLineup);
    }
  }, [workingLineup, timeWindow.state.config, leagueProfile, applyLineup]);

  // Handle preset change
  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset);
    // Note: Preset change should trigger a league profile update
    // For now, we just track it for the UI
  }, []);

  // Refresh legacy statistics without letting the device-global legacy roster
  // replace membership in the active League Workspace.
  const refreshRoster = useCallback(async (profileOverride?: LeagueProfile) => {
    try {
      const rosterRes = await apiService.getCoachRoster(profileOverride ?? leagueProfile);
      setRoster((current) => {
        const workspace = activeLeagueRef.current;
        const currentWorkspace = {
          ...workspace,
          roster: reconcileWorkspaceRoster(workspace.roster, current),
        };
        return enrichWorkspaceRosterPlayers(currentWorkspace, rosterRes.roster || []);
      });
    } catch (err) {
      console.error('Failed to refresh roster:', err);
    }
  }, [leagueProfile]);

  // Roster FPPG is scored with the active league, so re-fetch when it changes.
  useEffect(() => {
    if (!leagueProfile) return;
    void refreshRoster();
  }, [leagueProfile, refreshRoster]);

  useEffect(() => {
    if (!isQuickImportOpen || rosterImportPlayers.length > 0) return;
    let cancelled = false;
    setIsLoadingRosterImport(true);
    setRosterImportStatus(null);
    apiService.getAllPlayers(leagueProfile)
      .then((response) => {
        if (cancelled) return;
        const payload = response as typeof response & { players?: PlayerSearchResult[] };
        setRosterImportPlayers(payload.players ?? payload.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setRosterImportStatus('The player directory could not be loaded. Try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRosterImport(false);
      });
    return () => { cancelled = true; };
  }, [isQuickImportOpen, leagueProfile, rosterImportPlayers.length]);

  const handleQuickRosterImport = useCallback(async (playerIds: string[]) => {
    const selected = rosterImportPlayers.filter((player) => playerIds.includes(player.id));
    setRoster((current) => {
      const existing = new Set(current.map((player) => player.id));
      return [...current, ...selected.filter((player) => !existing.has(player.id)).map((player): RosterPlayer => ({
        id: player.id,
        full_name: player.name,
        team: player.team,
        positions: player.pos,
        current_slot: 'BN',
        games_played: player.games_played ?? 0,
        stats: player.stats ?? { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
      }))];
    });

    try {
      const result = await apiService.addPlayersToRosterBulk(playerIds, 'AUTO');
      await refreshRoster();
      const added = Number(result?.added ?? playerIds.length);
      const skipped = Number(result?.skipped ?? 0);
      setRosterImportStatus([
        `${added} player${added === 1 ? '' : 's'} added`,
        skipped > 0 ? `${skipped} already rostered` : null,
      ].filter(Boolean).join(' · '));
    } catch {
      setRosterImportStatus(`${selected.length} player${selected.length === 1 ? '' : 's'} saved on this device; legacy roster sync is unavailable.`);
    }
  }, [refreshRoster, rosterImportPlayers]);

  // Save lineup to server (debounced)
  const saveLineup = useCallback(async (lineup: WorkingLineupPlayer[]) => {
    try {
      // Persist the concrete slot ID so C 1/C 2 and equivalent slots survive reloads.
      // Projection requests still normalize these IDs to their slot type separately.
      const lineupData = lineup.map(item => ({
        playerId: item.player.id,
        slot: item.slot,
      }));

      await apiService.saveRosterLineup(lineupData);
    } catch (err) {
      console.error('Failed to save lineup:', err);
      setError('Lineup changes are saved in this League Workspace, but the legacy roster service could not sync them.');
    }
  }, []);

  // Auto-save when lineup changes
  useEffect(() => {
    // Skip on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Skip if no lineup
    if (workingLineup.length === 0) {
      return;
    }

    // Check if lineup actually changed (avoid saving on every render)
    const currentLineupStr = JSON.stringify(
      workingLineup.map(item => ({ id: item.player.id, slot: item.slot }))
    );
    if (currentLineupStr === lastSavedLineupRef.current) {
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Debounce save (1 second after last change)
    saveTimerRef.current = setTimeout(() => {
      lastSavedLineupRef.current = currentLineupStr;
      saveLineup(workingLineup);
    }, 1000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [workingLineup, saveLineup]);

  // Handle roster screenshot upload
  const handleRosterUpload = useCallback(async (file: File) => {
    setIsUploadingRoster(true);
    setError(null);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setRosterPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to OCR service
      const result = await apiService.uploadRosterImage(file);

      // The upload response contains the players recognized from this image.
      // Merge only those players into this workspace; the legacy endpoint is
      // device-global and may also contain members of another saved league.
      const uploadedPlayers = (result.roster || []) as RosterPlayer[];
      setRoster((current) => {
        const existing = new Set(current.map((player) => player.id));
        return [...current, ...uploadedPlayers.filter((player) => !existing.has(player.id))];
      });

      setRosterPreview(undefined);

      // Show success message
      const addedCount = result.roster?.length || 0;
      const uploadResult = result as typeof result & { duplicatesSkipped?: number };
      const duplicatesSkipped = uploadResult.duplicatesSkipped ?? 0;
      const unmatchedCount = result.unmatchedPlayers?.length || 0;

      if (addedCount > 0 || duplicatesSkipped > 0) {
        // Build success message
        const parts: string[] = [];
        if (addedCount > 0) {
          parts.push(`Added ${addedCount} player${addedCount !== 1 ? 's' : ''}`);
        }
        if (duplicatesSkipped > 0) {
          parts.push(`${duplicatesSkipped} already on roster`);
        }
        if (unmatchedCount > 0) {
          parts.push(`${unmatchedCount} could not be matched`);
        }

        setRosterImportStatus(parts.join(', '));
        setError(null);
      } else if (unmatchedCount > 0) {
        setError(`Could not match ${unmatchedCount} players from the screenshot. Try adding them manually.`);
      } else {
        setError('No players found in screenshot. Please try again with a clearer image.');
      }
    } catch (err: unknown) {
      console.error('Failed to upload roster:', err);
      setError(errorMessage(err, 'Failed to process roster image. Please try again.'));
      setRosterPreview(undefined);
    } finally {
      setIsUploadingRoster(false);
    }
  }, []);

  // Handle player selection from search
  const handlePlayerSelect = useCallback(async (player: PlayerSearchResult) => {
    const localPlayer: RosterPlayer = {
      id: player.id,
      full_name: player.name,
      team: player.team,
      positions: player.pos,
      current_slot: 'BN',
      games_played: player.games_played ?? 0,
      stats: player.stats ?? { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
    };
    setRoster((current) => current.some((entry) => entry.id === player.id) ? current : [...current, localPlayer]);
    try {
      await apiService.addPlayerToRoster(player.id);
      await refreshRoster();
      setError(null); // Clear any previous errors on success
    } catch (err: unknown) {
      console.error('Failed to add player:', err);
      setError(`${player.name} was added to this League Workspace, but the legacy roster service could not sync the change.`);
    }
  }, [refreshRoster]);

  // Handle player removal
  const handlePlayerRemove = useCallback(async (playerId: string) => {
    try {
      // Optimistically remove player from both roster AND workingLineup immediately
      setRoster(prev => prev.filter(p => p.id !== playerId));
      setWorkingLineup(prev => prev.filter(item => item.player.id !== playerId));

      // Persist to backend
      await apiService.removePlayerFromRoster(playerId);

      // Refresh from server to ensure sync (in background)
      refreshRoster().catch(err => console.error('Background refresh failed:', err));

      setError(null); // Clear any previous errors on success
    } catch (err: unknown) {
      console.error('Failed to remove player:', err);
      setError('The player was removed from this League Workspace, but the legacy roster service could not sync the change.');
    }
  }, [refreshRoster]);

  // Handle slot change (for mobile drag-free interface)
  const handleSlotChange = useCallback((slotId: string, playerId: string | null) => {
    if (!playerId) {
      // Remove player from slot
      const updatedLineup = workingLineup.filter(item => item.slot !== slotId);
      handleLineupChange(updatedLineup);
    } else {
      // Add/move player to slot
      const player = roster.find(p => p.id === playerId);
      if (!player) return;

      // Remove player from any existing slot and remove any player from target slot
      const updatedLineup = workingLineup.filter(
        item => item.player.id !== playerId && item.slot !== slotId
      );

      // Add player to new slot
      updatedLineup.push({
        player,
        slot: slotId,
        order: updatedLineup.length
      });

      handleLineupChange(updatedLineup);
    }
  }, [workingLineup, roster, handleLineupChange]);

  const addPlayerToSlot = useCallback(async (player: PlayerSearchResult, slotId: string) => {
    const newRosterPlayer: RosterPlayer = {
      id: player.id,
      full_name: player.name,
      team: player.team,
      positions: player.pos,
      current_slot: slotId,
      games_played: player.games_played ?? 0,
      stats: player.stats ?? { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
    };

    setRoster(prev => [...prev, newRosterPlayer]);

    try {
      await apiService.addPlayerToRoster(player.id, slotId);
      await refreshRoster();
      setError(null);
      return true;
    } catch (err: unknown) {
      console.error('Failed to add player:', err);
      setError(`${player.name} was added to this League Workspace, but the legacy roster service could not sync the change.`);
      return true;
    }
  }, [refreshRoster]);

  // Handle player addition from the general drawer or a specific empty slot.
  const handlePlayerAdd = useCallback(async (player: PlayerSearchResult) => {
    if (targetRosterSlot) {
      const requestedSlot = targetRosterSlot;
      if (!canDrop(player, requestedSlot.type)) {
        setError(`${player.name} is not eligible for ${requestedSlot.displayName}.`);
        return;
      }
      setIsPlayerManagementOpen(false);
      setTargetRosterSlot(null);
      setPlayerManagementFilters({});
      const added = await addPlayerToSlot(player, requestedSlot.id);
      if (!added) {
        setTargetRosterSlot(requestedSlot);
        setPlayerManagementFilters({ position: requestedSlot.type });
        setIsPlayerManagementOpen(true);
      }
      return;
    }

    setPendingPlayer(player);
    setIsSlotPickerOpen(true);
  }, [addPlayerToSlot, targetRosterSlot]);

  const handleEmptySlotAdd = useCallback((slot: RosterSlot) => {
    const position = ['C', 'LW', 'RW', 'D', 'G'].includes(slot.type)
      ? slot.type
      : ['F', 'UTIL'].includes(slot.type)
        ? 'SKATERS'
        : 'ALL';
    setTargetRosterSlot(slot);
    setPlayerManagementFilters({ position });
    setIsPlayerManagementOpen(true);
  }, []);

  // Handle browse players request from Roster Gaps Panel
  const handleBrowsePlayers = useCallback((team: string, position: string) => {
    // Set filters first
    setPlayerManagementFilters({ team, position });
    // Then open drawer
    setIsPlayerManagementOpen(true);
  }, []);

  // Handle slot confirmation - actually add the player with the selected slot
  const handleSlotConfirm = useCallback(async (slotId: string) => {
    if (!pendingPlayer) return;
    const player = pendingPlayer;
    setIsSlotPickerOpen(false);
    setPendingPlayer(null);
    const added = await addPlayerToSlot(player, slotId);
    if (!added) {
      setPendingPlayer(player);
      setIsSlotPickerOpen(true);
    }
  }, [addPlayerToSlot, pendingPlayer]);

  // Handle league settings save
  const handleLeagueSettingsSave = useCallback(async (updatedLeague: LeagueProfile) => {
    try {
      // Update local state immediately
      setLeagueProfile(updatedLeague);
      setSelectedPreset(updatedLeague.preset_name || '');
      const workspace = mergeLegacyLeagueProfile(activeLeague, updatedLeague, roster);
      updateLeague({ ...workspace, source: { kind: 'manual', label: 'Edited in League Workspace' } });

      // Sync with backend API
      await apiService.updateLeagueProfile(updatedLeague);
      // Rehydrate season/recent FPPG splits using the newly saved scoring.
      // Projection state also refreshes via the leagueProfile dependency, but
      // roster-player fields must not retain their pre-save scoring values.
      await refreshRoster(updatedLeague);

    } catch (err: unknown) {
      console.error('Failed to save league settings:', err);
      setError('Failed to save league settings. Please try again.');
    }
  }, [activeLeague, refreshRoster, roster, updateLeague]);

  // Handle share roster - opens modal
  const handleShareClick = useCallback(() => {
    setIsShareModalOpen(true);
  }, []);

  const handlePlayerDetails = useCallback((player: RosterPlayer) => {
    setPlayerDetailModal({ isOpen: true, player });
  }, []);

  const handleClosePlayerDetail = useCallback(() => {
    setPlayerDetailModal({ isOpen: false, player: null });
  }, []);

  // Handle compare with free agents
  const handleCompareWithFreeAgents = useCallback((player: RosterPlayer) => {
    navigate(`/compare?a=${encodeURIComponent(player.id.replace(/^nhl:/, ''))}`);
  }, [navigate]);

  // Week navigation handler for mobile - snaps to Monday boundaries
  const handleMobileWeekChange = useCallback((direction: 'prev' | 'next') => {
    if (!timeWindow.state.config) return;

    // Get current start and snap to Monday
    const currentStart = new Date(timeWindow.state.config.startUtc);
    const currentMonday = getStartOfIsoWeek(currentStart);

    // Calculate new Monday (7 days forward or back)
    const days = direction === 'next' ? 7 : -7;
    const newMonday = addDays(currentMonday, days);
    const newSunday = addDays(newMonday, 6);

    timeWindow.setCustomRange({
      start: format(newMonday, 'yyyy-MM-dd'),
      end: format(newSunday, 'yyyy-MM-dd')
    });
  }, [timeWindow]);

  // Load free agents when comparison drawer opens OR on mobile
  useEffect(() => {
    const shouldLoad = deviceType === 'mobile' && freeAgentsForComparison.length === 0 && !isLoadingFreeAgents;
    if (shouldLoad) {
      setIsLoadingFreeAgents(true);
      apiService.getAllPlayers(leagueProfile)
        .then(async (playersResponse) => {
          const allPlayers = playersResponse.results;

          // Filter out roster players
          const rosterIds = new Set(roster.map(p => p.id));
          const availablePlayers = allPlayers.filter((p: PlayerSearchResult) => !rosterIds.has(p.id));

          // Normalize players to consistent format (handles name/full_name, position/positions differences)
          const normalizedPlayers = normalizePlayers(availablePlayers);

          setFreeAgentsForComparison(normalizedPlayers);

          // Request server projections for free agents if we have time window config
          // This gives them proper ICE scores with Strength of Schedule
          if (timeWindow.state.config?.startUtc && timeWindow.state.config?.endUtc && leagueProfile) {
            try {
              // Build request with free agents as "BN" slots (server will calculate projections for any player)
              const faRequest: ProjectionsRequest = {
                league: leagueProfile,
                window: {
                  start: timeWindow.state.config.startUtc.split('T')[0],
                  end: timeWindow.state.config.endUtc.split('T')[0],
                },
                roster: normalizedPlayers.map((p: RosterPlayer) => ({
                  playerId: p.id,
                  slot: 'BN', // Use bench slot - server will resolve player and calculate projection
                })),
              };


              const faResponse = await apiService.applyRosterLineup(faRequest);

              // Merge free agent projections into main projections state
              // Existing roster projections take precedence
              setProjections(prev => ({
                ...faResponse.projections,
                ...prev, // Roster projections override free agent projections if same player
              }));

            } catch (faErr) {
              console.warn('Failed to load server projections for free agents, using local calculation:', faErr);
              // Fall back to local calculation if server request fails
              const freeAgentProjections = calculateProjectionsForPlayers(normalizedPlayers);
              setProjections(prev => mergeProjections(prev, freeAgentProjections));
            }
          } else {
            // No time window configured - use local calculation as fallback
            const freeAgentProjections = calculateProjectionsForPlayers(normalizedPlayers);
            setProjections(prev => mergeProjections(prev, freeAgentProjections));
          }
        })
        .catch(err => {
          console.error('Failed to load players for comparison:', err);
        })
        .finally(() => {
          setIsLoadingFreeAgents(false);
        });
    }
  }, [deviceType, freeAgentsForComparison.length, isLoadingFreeAgents, leagueProfile, roster, timeWindow.state.config]);

  // DEBUG: Show current state

  // Loading state
  if (isLoadingData) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-4"></div>
          <p className="text-[var(--ink)]">Loading roster...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-negative-muted border border-negative text-negative px-4 py-3 rounded">
            <div className="font-bold mb-2">Error</div>
            <div>{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-negative text-ink rounded hover:bg-negative transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }


  // Mobile View
  if (deviceType === 'mobile' && leagueProfile) {

    // Build roster slots from league profile
    const rosterRows = buildRosterRows(leagueProfile.lineup_slots);
    const slots = rosterRows.flatMap(row => row.slots);

    // Initialize workingLineup from roster if empty (on mobile we don't have RosterGrid to do this)
    // This is a one-time initialization - use a local variable to build it immediately
    let mobileWorkingLineup = workingLineup;
    if (roster.length > 0 && workingLineup.length === 0) {
      // Build initial lineup by assigning players to their current_slot or first eligible slot
      const usedSlots = new Set<string>();
      const initialLineup: WorkingLineupPlayer[] = [];

      roster.forEach((player, index) => {
        // Find a slot for this player
        const playerPositions = player.positions || [];
        let assignedSlot: string | null = null;

        // First try to use player's current_slot if set
        if (player.current_slot) {
          const requestedSlot = player.current_slot.toUpperCase();
          const slotType = requestedSlot.replace(/-\d+$/, '');
          // Preserve an exact C-1/LW-0 style assignment, then fall back to
          // the first available slot of the same type for legacy rosters.
          const availableSlot = slots.find(s => s.id === requestedSlot && !usedSlots.has(s.id))
            ?? slots.find(s => s.type === slotType && !usedSlots.has(s.id));
          if (availableSlot) {
            assignedSlot = availableSlot.id;
          }
        }

        // If no current_slot or it wasn't available, find any eligible slot
        if (!assignedSlot) {
          for (const slot of slots) {
            if (usedSlots.has(slot.id)) continue;

            const slotType = slot.type;
            // Check if player is eligible for this slot
            const isEligible =
              playerPositions.includes(slotType) ||
              slotType === 'BN' ||
              slotType === 'IR' ||
              slotType === 'IR+' ||
              (slotType === 'UTIL' && playerPositions.some(p => ['C', 'LW', 'RW', 'D'].includes(p))) ||
              (slotType === 'F' && playerPositions.some(p => ['C', 'LW', 'RW'].includes(p)));

            if (isEligible) {
              assignedSlot = slot.id;
              break;
            }
          }
        }

        if (assignedSlot) {
          usedSlots.add(assignedSlot);
          initialLineup.push({
            player,
            slot: assignedSlot,
            order: index
          });
        }
      });

      mobileWorkingLineup = initialLineup;

      // Trigger the lineup change to update state (will run projections)
      if (initialLineup.length > 0) {
        // Use setTimeout to avoid calling setState during render
        setTimeout(() => {
          handleLineupChange(initialLineup);
        }, 0);
      }
    }


    // Calculate team metrics for mobile header
    // Uses same formulas as desktop TeamStatsScoreboard.tsx
    const teamIceScore = mobileWorkingLineup.reduce((sum, item) => {
      if (item.player) {
        const projection = getPlayerProjection(projections, item.player.id);
        const iceScore = projection?.iceScore ?? 0;
        const starts = projection?.starts ?? 0;
        // Total ICE = sum of (iceScore × starts) - matches desktop
        return sum + (iceScore * starts);
      }
      return sum;
    }, 0);

    // Total Games = sum of starts (roster games played) - matches desktop "ROSTER GAMES"
    const totalGames = mobileWorkingLineup.reduce((sum, item) => {
      if (item.player) {
        const projection = getPlayerProjection(projections, item.player.id);
        return sum + (projection?.starts || 0);
      }
      return sum;
    }, 0);

    // Total Starts = same as totalGames for consistency
    const totalStarts = totalGames;

    return (
      <MobileAppShell
        roster={roster}
        leagueProfile={leagueProfile}
        projections={projections}
        workingLineup={mobileWorkingLineup}
        slots={slots}
        timeWindow={timeWindow.state}
        unusedSlotsByDate={unusedSlotsByDate}
        onSlotChange={handleSlotChange}
        onPlayerDetails={handlePlayerDetails}
        onLineupChange={handleLineupChange}
        onSaveLeagueProfile={handleLeagueSettingsSave}
        onAddPlayer={async (playerId, slot) => {
          const player = [...roster, ...freeAgentsForComparison].find(p => p.id === playerId);
          if (!player) return;

          // Optimistic update
          const newRosterPlayer: RosterPlayer = {
            id: player.id,
            full_name: player.full_name,
            team: player.team,
            positions: player.positions,
            current_slot: slot,
            games_played: player.games_played ?? 0,
            stats: player.stats,
          };
          setRoster(prev => [...prev, newRosterPlayer]);
          setFreeAgentsForComparison(prev => prev.filter(p => p.id !== playerId));
          setWorkingLineup(prev => [...prev, { player: newRosterPlayer, slot, order: prev.length }]);

          try {
            await apiService.addPlayerToRoster(playerId, slot);
            refreshRoster().catch(err => console.error('Background refresh failed:', err));
          } catch (err: unknown) {
            console.error('Failed to add player:', err);
            setError(`${player.full_name} was added to this League Workspace, but the legacy roster service could not sync the change.`);
          }
        }}
        onRemovePlayer={handlePlayerRemove}
        onTimeWindowPresetChange={timeWindow.setPreset}
        onTimeWindowCustomRangeChange={timeWindow.setCustomRange}
        onWeekChange={handleMobileWeekChange}
        teamIceScore={teamIceScore}
        totalGames={totalGames}
        totalStarts={totalStarts}
        freeAgents={freeAgentsForComparison}
        isLoadingFreeAgents={isLoadingFreeAgents}
        isLoadingProjections={isLoadingProjections}
        projectionError={projectionError}
        overview={(
          <div className="p-3 pb-0">
            <MyTeamOverview
              workspace={activeLeague}
              roster={roster}
              analysis={myTeamAnalysis}
              compact
              onManageRoster={() => setIsPlayerManagementOpen(true)}
              onOpenSettings={() => setIsLeagueSettingsOpen(true)}
              onToggleKeeper={(playerId) => toggleRosterFlag(playerId, 'keeper')}
              onToggleProtected={(playerId) => toggleRosterFlag(playerId, 'protected')}
              onCompareKeeper={handleCompareKeeper}
              onKeeperCostChange={updateKeeperCost}
            />
          </div>
        )}
        pickupBoard={(
          <div className="p-3 pb-0">
            <PickupBoard
              roster={roster}
              rosterProjections={projections}
              leagueProfile={leagueProfile}
              timeWindow={timeWindow.state}
              compact
            />
          </div>
        )}
      />
    );
  }

  // Desktop View (existing code)
  return (
    <div className="min-h-screen ice-rink-bg">
      {/* Unified Header Strip with Integrated Scoreboard */}
      <RosterHeader
        timeWindow={timeWindow}
        weightsSource={weightsSource}
        isLoadingProjections={isLoadingProjections}
        projectionError={projectionError}
        healthStatus={healthStatus}
        cardDensity={cardDensity}
        onCardDensityChange={setCardDensity}
        onSettingsClick={() => setIsLeagueSettingsOpen(true)}
        onManageClick={() => setIsPlayerManagementOpen(true)}
        onWeightsClick={() => setIsWeightsDrawerOpen(true)}
        onShareClick={handleShareClick}
        projections={projections}
        workingLineup={workingLineup}
        leagueProfile={leagueProfile}
        totalNHLGamesInWindow={totalNHLGamesInWindow}
        unusedSlotsByDate={unusedSlotsByDate}
        onBrowsePlayers={handleBrowsePlayers}
      />
      {/* Health Warning (non-blocking) */}
      {healthStatus && healthStatus.capabilities?.projections === false && (
        <div className="mx-auto mt-3 w-full max-w-7xl px-4">
          <div className="px-3 py-1.5 bg-warning-muted border border-warning rounded-lg text-warning text-xs">
 Projections service is currently unavailable. Some features may not work.
          </div>
        </div>
      )}
      <div className={`container mx-auto px-4 sm:px-6 lg:px-8 ${cardDensity === 'compact' ? 'py-2' : 'py-4'}`}>

        <MyTeamOverview
          workspace={activeLeague}
          roster={roster}
          analysis={myTeamAnalysis}
          onManageRoster={() => setIsPlayerManagementOpen(true)}
          onOpenSettings={() => setIsLeagueSettingsOpen(true)}
          onToggleKeeper={(playerId) => toggleRosterFlag(playerId, 'keeper')}
          onToggleProtected={(playerId) => toggleRosterFlag(playerId, 'protected')}
          onCompareKeeper={handleCompareKeeper}
          onKeeperCostChange={updateKeeperCost}
        />

        <Card className="mb-3 mt-3 overflow-hidden">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="scoreboard-text text-accent">QUICK ROSTER IMPORT</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">Paste your roster. Review every match.</h2>
              <p className="mt-1 text-sm text-ink-dim">No login or screenshot required. Imported players feed the roster schedule and gap-night analysis.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="ghost"><Link to="/compare">Compare players</Link></Button>
              <Button type="button" variant={isQuickImportOpen ? 'ghost' : 'primary'} onClick={() => setIsQuickImportOpen((value) => !value)} aria-expanded={isQuickImportOpen}>
                <ClipboardPaste size={16} />{isQuickImportOpen ? 'Close importer' : 'Paste roster'}
              </Button>
            </div>
          </div>
          {isQuickImportOpen && (
            <div className="border-t border-line p-4">
              {isLoadingRosterImport && <p className="text-sm text-ink-dim">Loading the player directory…</p>}
              {!isLoadingRosterImport && rosterImportPlayers.length > 0 && (
                <BulkImportPanel
                  allPlayers={rosterImportPlayers}
                  onImport={handleQuickRosterImport}
                  mode="roster"
                  embedded
                  existingPlayerIds={roster.map((player) => player.id)}
                />
              )}
              {rosterImportStatus && <p className="mt-3 text-sm text-ink-dim" aria-live="polite">{rosterImportStatus}</p>}
            </div>
          )}
        </Card>

        {/* Player Management Panel */}
        {showPlayerManagement && (
          <div className="mb-3 bg-surface-1/10 border border-line rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[var(--ink)]">
                Manage Roster
              </h3>
              <button
                onClick={() => setShowPlayerManagement(false)}
                className="text-[var(--ink-mute)] hover:text-[var(--ink)] text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Screenshot Upload */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">
                  Upload Roster Screenshot
                </h4>
                <ImageUploadZone
                  title="Roster Screenshot"
                  description="Take a screenshot of your roster page and upload it here"
                  onUpload={handleRosterUpload}
                  isUploading={isUploadingRoster}
                  isComplete={false}
                  preview={rosterPreview}
                />
              </div>

              {/* Right: Manual Player Search */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">
                  Add Players Manually
                </h4>
                <CoachPlayerSearchPanel
                  mode="roster"
                  onPlayerSelect={handlePlayerSelect}
                  leagueProfile={leagueProfile}
                />
              </div>
            </div>
          </div>
        )}

        {/* Weights Source Banner (Default warning) */}
        {weightsSource && weightsSource.includes('Default') && (
          <div className="mb-2 px-3 py-1.5 bg-warning-muted border border-warning rounded-lg text-warning text-xs">
 Using Default weights; upload or pick a preset to personalize scoring.
          </div>
        )}

        {/* Subtle stats update timestamp - removed large banners */}

        {/* Team Stats Scoreboard - NOW INTEGRATED INTO HEADER */}

        {/* Roster Grid */}
        {roster && leagueProfile && (
          <div
            className={`bg-surface-1/5 rounded-xl border border-line ${cardDensity === 'compact' ? 'p-2' : 'p-4'} [transform:none]`}>
            <RosterGrid
              roster={roster}
              leagueProfile={leagueProfile}
              projections={projections}
              isLoadingProjections={isLoadingProjections}
              onChange={handleLineupChange}
              onRemove={handlePlayerRemove}
              onPlayerDetails={handlePlayerDetails}
              getTeamTier={teamTiers.getTeamTier}
              cardDensity={cardDensity}
              onCompareWithFreeAgents={handleCompareWithFreeAgents}
              keeperEntries={activeLeague.roster}
              keeperRules={activeLeague.keeperRules}
              onToggleKeeper={(playerId) => toggleRosterFlag(playerId, 'keeper')}
              onKeeperCostChange={updateKeeperCost}
              onCompareKeeper={(player) => handleCompareKeeper(player.id)}
              onAddPlayerToSlot={handleEmptySlotAdd}
            />
          </div>
        )}

        {leagueProfile && (
          <div className="mt-3">
            <PickupBoard
              roster={roster}
              rosterProjections={projections}
              leagueProfile={leagueProfile}
              timeWindow={timeWindow.state}
            />
          </div>
        )}
      </div>
      {/* Weights Drawer */}
      <WeightsDrawer
        isOpen={isWeightsDrawerOpen}
        onClose={() => setIsWeightsDrawerOpen(false)}
        league={leagueProfile || undefined}
      />
      <LeagueWorkspaceControl
        hideTrigger
        open={isLeagueSettingsOpen}
        onOpenChange={setIsLeagueSettingsOpen}
      />
      {/* Player Management Drawer */}
      <PlayerManagementDrawer
        isOpen={isPlayerManagementOpen}
        onClose={() => {
          setIsPlayerManagementOpen(false);
          setPlayerManagementFilters({});
          setTargetRosterSlot(null);
        }}
        roster={roster}
        projections={projections}
        leagueProfile={leagueProfile}
        timeWindowConfig={timeWindow.state.config}
        timeWindow={timeWindow.state}
        onAddPlayer={handlePlayerAdd}
        onRosterChanged={refreshRoster}
        initialPositionFilter={playerManagementFilters.position}
        initialTeamFilter={playerManagementFilters.team}
        targetSlotLabel={targetRosterSlot?.displayName}
        targetSlotType={targetRosterSlot?.type}
      />
      {/* Slot Picker Modal */}
      {pendingPlayer && (
        <SlotPicker
          isOpen={isSlotPickerOpen}
          onClose={() => {
            setIsSlotPickerOpen(false);
            setPendingPlayer(null);
          }}
          player={pendingPlayer}
          leagueProfile={leagueProfile}
          currentRoster={roster}
          onConfirm={handleSlotConfirm}
        />
      )}
      {/* Share Roster Modal */}
      <ShareRosterModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roster={roster}
        leagueProfile={leagueProfile!}
        projections={projections}
        timeWindow={timeWindow.state}
        getTeamTier={teamTiers.getTeamTier}
      />
      {/* Player Detail Modal */}
      {playerDetailModal.isOpen && playerDetailModal.player && leagueProfile && (
        <PlayerDetailModal
          isOpen={playerDetailModal.isOpen}
          onClose={handleClosePlayerDetail}
          player={playerDetailModal.player}
          projection={getPlayerProjection(projections, playerDetailModal.player.id)}
          teamTier={teamTiers.getTeamTier(playerDetailModal.player.team)}
          timeWindow={timeWindow.state}
          leagueProfile={leagueProfile}
          onCompare={() => navigate(`/compare?a=${encodeURIComponent(playerDetailModal.player!.id.replace(/^nhl:/, ''))}`)}
        />
      )}
    </div>
  );
};
