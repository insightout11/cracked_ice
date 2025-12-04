// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { LeagueSettingsDrawer } from '../components/LeagueSettingsDrawer';
import { ImageUploadZone } from '../components/ImageUploadZone';
import { CoachPlayerSearchPanel } from '../components/CoachPlayerSearchPanel';
import { PlayerManagementDrawer } from '../components/PlayerManagementDrawer';
import { SlotPicker } from '../components/PlayerManagement/SlotPicker';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { RosterHeader } from '../components/RosterHeader';
import { ShareRosterModal } from '../components/ShareRosterModal';
import { PlayerDetailModal } from '../components/PlayerDetailModal';

export const RosterPage: React.FC = () => {
  const timeWindow = useTimeWindow();
  const teamTiers = useTeamTiers();

  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [leagueProfile, setLeagueProfile] = useState<LeagueProfile | null>(null);
  const [projections, setProjections] = useState<Record<string, PlayerProjection>>({});
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingProjections, setIsLoadingProjections] = useState(false);
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

  // Slot picker state
  const [isSlotPickerOpen, setIsSlotPickerOpen] = useState(false);
  const [pendingPlayer, setPendingPlayer] = useState<PlayerSearchResult | null>(null);

  // Card density mode
  const [cardDensity, setCardDensity] = useState<'full' | 'compact'>('full');

  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Player detail modal state
  const [playerDetailModal, setPlayerDetailModal] = useState<{
    isOpen: boolean;
    player: RosterPlayer | null;
  }>({ isOpen: false, player: null });

  // Abort controller for projection requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save refs
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastSavedLineupRef = useRef<string>('');

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
          apiService.getCoachRoster(),
        ]);

        console.log('Loaded context:', contextRes);
        console.log('Loaded roster:', rosterRes);

        // Set roster (even if empty - we'll show setup UI)
        setRoster(rosterRes.roster || []);
        console.log('Set roster state to:', rosterRes.roster || []);

        // Set league profile (even if missing - we'll use defaults)
        if (contextRes.league_profile) {
          // Ensure IR+ is defined if IR is defined (common Yahoo setup)
          const profile = { ...contextRes.league_profile };
          if (profile.lineup_slots) {
            profile.lineup_slots = { ...profile.lineup_slots };
            // If IR exists but IR+ doesn't, add IR+ with count of 1
            if (profile.lineup_slots['IR'] && !profile.lineup_slots['IR+']) {
              profile.lineup_slots['IR+'] = 1;
            }
          }
          setLeagueProfile(profile);
          setSelectedPreset(profile.preset_name || '');
        } else {
          // Set default league profile for empty roster
          setLeagueProfile({
            league_name: 'My League',
            scoring_type: 'points',
            lineup_slots: {
              C: 2,
              LW: 2,
              RW: 2,
              D: 4,
              G: 2,
              BN: 4,
              IR: 1,
              'IR+': 1,
            },
          });
        }
      } catch (err: any) {
        console.error('Failed to load initial data:', err);
        setError(err.message || 'Failed to load roster data. Please try again.');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadInitialData();
  }, []);

  // Fetch team tier data when time window changes
  useEffect(() => {
    if (timeWindow.state.config?.startUtc && timeWindow.state.config?.endUtc) {
      teamTiers.fetchTiers({
        start: timeWindow.state.config.startUtc,
        end: timeWindow.state.config.endUtc,
      });
    }
  }, [timeWindow.state.config?.startUtc, timeWindow.state.config?.endUtc, teamTiers.fetchTiers]);

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
            roster: lineup.map((item) => ({
              playerId: item.player.id,
              slot: item.slot,
            })),
          };

          console.log('Sending projections request:', {
            leagueProfile,
            window: timeWindow.state.config,
            lineupCount: lineup.length,
            request
          });

          const response: ProjectionsResponse = await apiService.applyRosterLineup(request);

          // Only update if this request wasn't aborted
          if (!controller.signal.aborted) {
            setProjections(response.projections);
            setWeightsSource(response.meta?.weightsSource || null);
          }
        } catch (err: any) {
          if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
            console.error('Failed to apply lineup:', err);
            setError('Failed to calculate projections. Please try again.');
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

  // Refresh roster from server
  const refreshRoster = useCallback(async () => {
    try {
      const rosterRes = await apiService.getCoachRoster();
      setRoster(rosterRes.roster || []);
    } catch (err) {
      console.error('Failed to refresh roster:', err);
    }
  }, []);

  // Save lineup to server (debounced)
  const saveLineup = useCallback(async (lineup: WorkingLineupPlayer[]) => {
    try {
      // Convert to API format - strip indices from slots
      // Frontend uses "C-0", "LW-1", "IR+-0" but backend expects "C", "LW", "IR+"
      const lineupData = lineup.map(item => {
        // Extract slot type without index
        // Handle IR+ specially (don't split on the +)
        const slotType = item.slot.includes('IR+')
          ? 'IR+'
          : item.slot.split('-')[0];

        return {
          playerId: item.player.id,
          slot: slotType
        };
      });

      await apiService.saveRosterLineup(lineupData);
      console.log('Lineup saved successfully');
    } catch (err) {
      console.error('Failed to save lineup:', err);
      // Don't show error to user - this is auto-save in the background
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

      // Refresh roster data to show newly added players
      const rosterRes = await apiService.getCoachRoster();
      setRoster(rosterRes.roster || []);

      setRosterPreview(undefined);

      // Show success message
      const addedCount = result.roster?.length || 0;
      const duplicatesSkipped = (result as any).duplicatesSkipped || 0;
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

        const message = `✅ ${parts.join(', ')}`;
        console.log(message);
        setError(null);
      } else if (unmatchedCount > 0) {
        setError(`Could not match ${unmatchedCount} players from the screenshot. Try adding them manually.`);
      } else {
        setError('No players found in screenshot. Please try again with a clearer image.');
      }
    } catch (err: any) {
      console.error('Failed to upload roster:', err);
      setError(err.message || 'Failed to process roster image. Please try again.');
      setRosterPreview(undefined);
    } finally {
      setIsUploadingRoster(false);
    }
  }, []);

  // Handle player selection from search
  const handlePlayerSelect = useCallback(async (player: PlayerSearchResult) => {
    try {
      await apiService.addPlayerToRoster(player.id);
      await refreshRoster();
      setError(null); // Clear any previous errors on success
    } catch (err: any) {
      console.error('Failed to add player:', err);
      const serverError = err.response?.data?.error || err.message;
      setError(`Failed to add ${player.name}: ${serverError}`);
    }
  }, [refreshRoster]);

  // Handle player removal
  const handlePlayerRemove = useCallback(async (playerId: string) => {
    // Save original roster for potential rollback
    const originalRoster = roster;

    try {
      // Optimistically remove player immediately
      setRoster(prev => prev.filter(p => p.id !== playerId));

      // Persist to backend
      await apiService.removePlayerFromRoster(playerId);

      // Refresh from server to ensure sync (in background)
      refreshRoster().catch(err => console.error('Background refresh failed:', err));

      setError(null); // Clear any previous errors on success
    } catch (err: any) {
      console.error('Failed to remove player:', err);
      const serverError = err.response?.data?.error || err.message;
      setError(`Failed to remove player: ${serverError}`);

      // Revert optimistic update on error
      setRoster(originalRoster);
    }
  }, [roster, refreshRoster]);

  // Handle player addition from drawer - show slot picker first
  const handlePlayerAdd = useCallback((player: PlayerSearchResult) => {
    setPendingPlayer(player);
    setIsSlotPickerOpen(true);
  }, []);

  // Handle slot confirmation - actually add the player with the selected slot
  const handleSlotConfirm = useCallback(async (slotId: string) => {
    if (!pendingPlayer) return;

    try {
      // Extract slot type from slotId (e.g., "C-0" -> "C", "IR+-0" -> "IR+")
      const slotType = slotId.includes('IR+') ? 'IR+' : slotId.split('-')[0];

      // Optimistically update roster immediately
      const newRosterPlayer: RosterPlayer = {
        id: pendingPlayer.id,
        full_name: pendingPlayer.name,
        team: pendingPlayer.team,
        positions: [pendingPlayer.position],
        current_slot: slotType,
        games_played: 0,
        stats: {} as any,
      };
      setRoster(prev => [...prev, newRosterPlayer]);

      // Close slot picker and clear pending player immediately for instant feedback
      setIsSlotPickerOpen(false);
      setPendingPlayer(null);

      // Persist to backend in background
      await apiService.addPlayerToRoster(pendingPlayer.id, slotType);

      // Refresh from server to ensure sync (in background)
      refreshRoster().catch(err => console.error('Background refresh failed:', err));

      setError(null); // Clear any previous errors on success
    } catch (err: any) {
      console.error('Failed to add player:', err);
      const serverError = err.response?.data?.error || err.message;
      setError(`Failed to add ${pendingPlayer.name}: ${serverError}`);

      // Revert optimistic update on error
      setRoster(prev => prev.filter(p => p.id !== pendingPlayer.id));

      // Reopen slot picker to allow retry
      setIsSlotPickerOpen(true);
    }
  }, [pendingPlayer, refreshRoster]);

  // Handle league settings save
  const handleLeagueSettingsSave = useCallback(async (updatedLeague: LeagueProfile) => {
    try {
      // Update local state immediately
      setLeagueProfile(updatedLeague);
      setSelectedPreset(updatedLeague.preset_name || '');

      // Sync with backend API
      await apiService.updateLeagueProfile(updatedLeague);

      console.log('League settings saved and synced:', updatedLeague);
    } catch (err: any) {
      console.error('Failed to save league settings:', err);
      setError('Failed to save league settings. Please try again.');
    }
  }, []);

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

  // DEBUG: Show current state
  console.log('RosterPage render:', {
    isLoadingData,
    hasError: !!error,
    rosterLength: roster?.length,
    hasLeagueProfile: !!leagueProfile
  });

  // Loading state
  if (isLoadingData) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-[var(--ci-white)]">Loading roster...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <div className="font-bold mb-2">Error</div>
            <div>{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log('RENDERING ROSTER PAGE - roster length:', roster?.length, 'leagueProfile:', leagueProfile);

  return (
    <div className="min-h-screen ice-rink-bg">
      {/* Unified Header Strip */}
      <RosterHeader
        timeWindow={timeWindow}
        weightsSource={weightsSource}
        isLoadingProjections={isLoadingProjections}
        healthStatus={healthStatus}
        cardDensity={cardDensity}
        onCardDensityChange={setCardDensity}
        onSettingsClick={() => setIsLeagueSettingsOpen(true)}
        onManageClick={() => setIsPlayerManagementOpen(true)}
        onWeightsClick={() => setIsWeightsDrawerOpen(true)}
        onShareClick={handleShareClick}
      />

      {/* Health Warning (non-blocking) */}
      {healthStatus && healthStatus.capabilities?.projections === false && (
        <div className="mx-auto mt-3 w-full max-w-7xl px-4">
          <div className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-xs">
            ⚠️ Projections service is currently unavailable. Some features may not work.
          </div>
        </div>
      )}

      <div className={`container mx-auto px-4 sm:px-6 lg:px-8 ${cardDensity === 'compact' ? 'py-2' : 'py-4'}`}>

        {/* Player Management Panel */}
        {showPlayerManagement && (
          <div className="mb-3 bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[var(--ci-white)]">
                Manage Roster
              </h3>
              <button
                onClick={() => setShowPlayerManagement(false)}
                className="text-[var(--ci-muted)] hover:text-[var(--ci-white)] text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Screenshot Upload */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--ci-white)] mb-3">
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
                <h4 className="text-sm font-semibold text-[var(--ci-white)] mb-3">
                  Add Players Manually
                </h4>
                <CoachPlayerSearchPanel
                  mode="roster"
                  onPlayerSelect={handlePlayerSelect}
                />
              </div>
            </div>
          </div>
        )}

        {/* Weights Source Banner (Default warning) */}
        {weightsSource && weightsSource.includes('Default') && (
          <div className="mb-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-xs">
            ℹ️ Using Default weights; upload or pick a preset to personalize scoring.
          </div>
        )}

        {/* Subtle stats update timestamp - removed large banners */}

        {/* Roster Grid */}
        {roster && leagueProfile && (
          <div className={`bg-white/5 rounded-xl border border-white/10 ${cardDensity === 'compact' ? 'p-2' : 'p-4'}`} style={{ transform: 'none' }}>
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

      {/* League Settings Drawer */}
      <LeagueSettingsDrawer
        isOpen={isLeagueSettingsOpen}
        onClose={() => setIsLeagueSettingsOpen(false)}
        league={leagueProfile}
        onSave={handleLeagueSettingsSave}
      />

      {/* Player Management Drawer */}
      <PlayerManagementDrawer
        isOpen={isPlayerManagementOpen}
        onClose={() => setIsPlayerManagementOpen(false)}
        roster={roster}
        projections={projections}
        leagueProfile={leagueProfile}
        timeWindowConfig={timeWindow.state.config}
        timeWindow={timeWindow.state}
        onAddPlayer={handlePlayerAdd}
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
          projection={projections[playerDetailModal.player.id]}
          teamTier={teamTiers.getTeamTier(playerDetailModal.player.team)}
          timeWindow={timeWindow.state}
          leagueProfile={leagueProfile}
        />
      )}
    </div>
  );
};
