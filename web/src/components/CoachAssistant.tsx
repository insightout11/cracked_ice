// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../services/api';
import { ImageUploadZone } from './ImageUploadZone';
import { CoachChat } from './CoachChat';
import { ConflictDashboard } from './ConflictDashboard';
import { CoachPlayerSearchPanel } from './CoachPlayerSearchPanel';
import { LeagueSettingsForm } from './LeagueSettingsForm';
import type {
  CoachUserStatus,
  CoachStreamersResponse,
  CoachConflictResponse,
  CoachWindow,
  LeagueProfile,
  Player,
  UnmatchedPlayer,
  PlayerSearchResult
} from '../types';

type Section = 'settings' | 'roster' | 'free-agents' | 'conflicts' | 'recommendations';

function computeWindow(preset: 'rest-of-week' | '7d' | '14d' | '30d' | 'rest-of-season'): CoachWindow {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);

  switch (preset) {
    case 'rest-of-week': {
      // Calculate next Sunday (inclusive)
      const day = start.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      end.setUTCDate(end.getUTCDate() + daysUntilSunday);
      break;
    }
    case '7d':
      end.setUTCDate(end.getUTCDate() + 6);
      break;
    case '14d':
      end.setUTCDate(end.getUTCDate() + 13);
      break;
    case '30d':
      end.setUTCDate(end.getUTCDate() + 29);
      break;
    case 'rest-of-season':
      // End of 2025-26 season (April 30, 2026)
      return {
        start: start.toISOString().slice(0, 10),
        end: '2026-04-30'
      };
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

export function CoachAssistant() {
  const [status, setStatus] = useState<CoachUserStatus | null>(null);
  const [expandedSection, setExpandedSection] = useState<Section | null>('settings');
  const [window, setWindow] = useState<CoachWindow>(() => computeWindow('rest-of-week'));
  const [windowPreset, setWindowPreset] = useState<'rest-of-week' | '7d' | '14d' | '30d' | 'rest-of-season' | 'custom'>('rest-of-week');

  // Debug: Log expanded section changes
  useEffect(() => {
  }, [expandedSection]);

  // Upload states
  const [settingsUploading, setSettingsUploading] = useState(false);
  const [rosterUploading, setRosterUploading] = useState(false);
  const [freeAgentsUploading, setFreeAgentsUploading] = useState(false);

  // Data states
  const [leagueSettings, setLeagueSettings] = useState<LeagueProfile | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [unmatchedRoster, setUnmatchedRoster] = useState<UnmatchedPlayer[]>([]);
  const [unmatchedFreeAgents, setUnmatchedFreeAgents] = useState<UnmatchedPlayer[]>([]);

  // Recommendations and conflicts
  const [recommendations, setRecommendations] = useState<CoachStreamersResponse | null>(null);
  const [conflicts, setConflicts] = useState<CoachConflictResponse | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [conflictsLoading, setConflictsLoading] = useState(false);

  // Errors
  const [error, setError] = useState<string | null>(null);

  // Load status and existing data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [statusData, rosterData, freeAgentsData, settingsData] = await Promise.all([
          apiService.getCoachUserStatus(),
          apiService.getCoachRoster(),
          apiService.getCoachFreeAgents(),
          apiService.getCoachSettings().catch(() => null) // Don't fail if no settings exist
        ]);
        setStatus(statusData);
        setRoster(rosterData.roster);
        setFreeAgents(freeAgentsData.roster);

        // Load saved settings if they exist, otherwise use defaults
        // API returns { league_profile: {...} }, unwrap it
        setLeagueSettings((settingsData?.league_profile || settingsData) || {
          league_name: 'My League',
          scoring_type: 'points',
          scoring_weights: {
            goals: 1.3,
            assists: 1.3,
            shots_on_goal: 0.1,
            blocks: 0.1,
            power_play_points: 1
          },
          lineup_slots: {
            C: 2,
            LW: 2,
            RW: 2,
            F: 0,
            D: 4,
            G: 2,
            BN: 4,
            IR: 1
          }
        });
      } catch (err) {
        console.error('Failed to load coach data:', err);
      }
    };
    loadInitialData();
  }, []);

  // Auto-expand settings section if not present
  useEffect(() => {
    if (!status) return;

    // Only auto-expand settings if they're not present yet
    if (!status.components.settings.present && expandedSection !== 'settings') {
      setExpandedSection('settings');
    }
    // Don't auto-collapse settings - let users manually control section expansion
  }, [status, expandedSection]);

  // Update window when preset changes
  useEffect(() => {
    if (windowPreset !== 'custom') {
      setWindow(computeWindow(windowPreset));
    }
  }, [windowPreset]);

  // Fetch conflicts when roster is ready
  useEffect(() => {
    if (status?.components.roster.present && !conflicts && !conflictsLoading) {
      fetchConflicts();
    }
  }, [status?.components.roster.present]);

  const refreshStatus = async () => {
    try {
      const data = await apiService.getCoachUserStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  };

  const fetchConflicts = async () => {
    if (!status?.components.roster.present) return;

    setConflictsLoading(true);
    setError(null);
    try {
      const data = await apiService.getCoachConflicts(window);
      setConflicts(data);
    } catch (err) {
      setError('Failed to analyze conflicts');
      console.error(err);
    } finally {
      setConflictsLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    if (!status?.contextReady) return;

    setRecommendationsLoading(true);
    setError(null);
    try {
      const data = await apiService.getCoachStreamers(window);
      setRecommendations(data);
      setExpandedSection('recommendations');
    } catch (err) {
      setError('Failed to generate recommendations');
      console.error(err);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const handleSettingsUpload = useCallback(async (file: File) => {
    setSettingsUploading(true);
    setError(null);
    try {
      const result = await apiService.uploadLeagueSettingsImage(file);
      setLeagueSettings(result.league_profile);
      await refreshStatus();

      if (result.warnings && result.warnings.length > 0) {
        setError(`Settings uploaded with warnings: ${result.warnings.join(', ')}`);
      }
    } catch (err) {
      setError('Failed to upload league settings');
      throw err;
    } finally {
      setSettingsUploading(false);
    }
  }, []);

  const handleRosterUpload = useCallback(async (file: File) => {
    setRosterUploading(true);
    setError(null);
    try {
      const result = await apiService.uploadRosterImage(file);
      // Append new players instead of replacing
      setRoster(prev => [...prev, ...result.roster]);
      setUnmatchedRoster(prev => [...prev, ...result.unmatchedPlayers]);
      await refreshStatus();

      if (result.unmatchedPlayers.length > 0) {
        setError(`${result.unmatchedPlayers.length} players could not be matched automatically`);
      }
    } catch (err) {
      setError('Failed to upload roster');
      throw err;
    } finally {
      setRosterUploading(false);
    }
  }, []);

  const handleFreeAgentsUpload = useCallback(async (file: File) => {
    setFreeAgentsUploading(true);
    setError(null);
    try {
      const result = await apiService.uploadFreeAgentsImage(file);
      // Append new free agents instead of replacing
      setFreeAgents(prev => [...prev, ...result.free_agents]);
      setUnmatchedFreeAgents(prev => [...prev, ...result.unmatchedPlayers]);
      await refreshStatus();

      if (result.unmatchedPlayers.length > 0) {
        setError(`${result.unmatchedPlayers.length} free agents could not be matched automatically`);
      }
    } catch (err) {
      setError('Failed to upload free agents');
      throw err;
    } finally {
      setFreeAgentsUploading(false);
    }
  }, []);

  const handleClearRoster = useCallback(async () => {
    setError(null);
    try {
      await apiService.clearCoachRoster();
      setRoster([]);
      setUnmatchedRoster([]);
      await refreshStatus();
    } catch (err) {
      setError('Failed to clear roster');
      console.error(err);
    }
  }, []);

  const handleClearFreeAgents = useCallback(async () => {
    setError(null);
    try {
      await apiService.clearCoachFreeAgents();
      setFreeAgents([]);
      setUnmatchedFreeAgents([]);
      await refreshStatus();
    } catch (err) {
      setError('Failed to clear free agents');
      console.error(err);
    }
  }, []);

  const handleAddPlayerToRoster = useCallback(async (player: PlayerSearchResult) => {
    setError(null);
    try {
      await apiService.addPlayerToRoster(player.id);
      // Refresh roster from server to get the complete player object
      const data = await apiService.getCoachRoster();
      setRoster(data.roster);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to add ${player.name} to roster`);
      console.error(err);
    }
  }, []);

  const handleAddPlayerToFreeAgents = useCallback(async (player: PlayerSearchResult) => {
    setError(null);
    try {
      await apiService.addPlayerToFreeAgents(player.id);
      // Refresh free agents from server to get the complete player object
      const data = await apiService.getCoachFreeAgents();
      setFreeAgents(data.roster);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to add ${player.name} to free agents`);
      console.error(err);
    }
  }, []);

  const SectionHeader = ({ section, title, complete }: { section: Section; title: string; complete: boolean }) => {
    const isExpanded = expandedSection === section;

    return (
      <button
        onClick={() => {
          setExpandedSection(isExpanded ? null : section);
        }}
        className="w-full flex items-center justify-between p-4 rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition"
        style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-3">
          {complete && (
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          <h3 className="text-base font-semibold text-[var(--ci-white)]">{title}</h3>
        </div>
        <svg
          className={`w-5 h-5 text-[var(--ci-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
        <h2 className="text-2xl font-bold text-[var(--ci-white)] mb-2">AI Fantasy Hockey Coach</h2>
        <p className="text-sm text-[var(--ci-muted)]">
          Upload screenshots of your league settings, roster, and free agents. The AI will read them and provide
          personalized recommendations to optimize your lineup.
        </p>

        {status && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-[var(--ci-muted)]">Status:</span>
            <span className={status.contextReady ? 'text-green-400 font-semibold' : 'text-amber-300'}>
              {status.contextReady ? 'Ready to coach!' : 'Upload required data'}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
            {error}
          </div>
        )}
      </div>

      {/* League Settings Section */}
      <div className="space-y-3">
        <SectionHeader
          section="settings"
          title="1. League Settings"
          complete={status?.components.settings.present || false}
        />
        {expandedSection === 'settings' && (
          <div className="pl-4 space-y-4">
            {leagueSettings && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                <LeagueSettingsForm
                  initialSettings={leagueSettings}
                  onSave={async (settings) => {
                    setError(null);
                    try {
                      await apiService.uploadCoachSettings(settings);
                      setLeagueSettings(settings);
                      await refreshStatus();
                    } catch (err) {
                      setError('Failed to save league settings');
                      console.error(err);
                    }
                  }}
                />
              </div>
            )}

            <ImageUploadZone
              title="Or Upload League Settings Screenshot"
              description="Optional: Upload a screenshot of your league settings to auto-fill the form"
              onUpload={handleSettingsUpload}
              isUploading={settingsUploading}
              isComplete={status?.components.settings.present || false}
            />
          </div>
        )}
      </div>

      {/* Roster Section */}
      <div className="space-y-3">
        <SectionHeader
          section="roster"
          title="2. Your Roster"
          complete={status?.components.roster.present || false}
        />
        {expandedSection === 'roster' && (
          <div className="pl-4 space-y-4">
            {roster.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-6">
                <div className="flex flex-col gap-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-bold text-[var(--ci-white)]">
                        Your Roster
                      </h4>
                      <p className="text-xs text-[var(--ci-muted)] mt-0.5">
                        {roster.length} {roster.length === 1 ? 'player' : 'players'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          setError(null);
                          try {
                            await apiService.uploadCoachRoster({ roster });
                            await refreshStatus();
                          } catch (err) {
                            setError('Failed to save roster changes');
                            console.error(err);
                          }
                        }}
                        className="px-4 py-2 bg-[var(--laser-cyan)] text-black rounded-lg text-sm font-medium hover:bg-[var(--laser-cyan)]/90 transition"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleClearRoster}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 border border-red-400/30 transition"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <CoachPlayerSearchPanel
                    onPlayerSelect={handleAddPlayerToRoster}
                    mode="roster"
                  />
                </div>

                {/* Duplicate player warning */}
                {(() => {
                  const playerIds = roster.map(p => p.id);
                  const duplicates = playerIds.filter((id, index) => playerIds.indexOf(id) !== index);
                  const uniqueDuplicates = [...new Set(duplicates)];
                  if (uniqueDuplicates.length > 0) {
                    const duplicateNames = uniqueDuplicates.map(id => {
                      const player = roster.find(p => p.id === id);
                      return player?.full_name || id;
                    });
                    return (
                      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 mb-3">
                        <strong>Warning:</strong> The following player(s) appear multiple times in your roster: {duplicateNames.join(', ')}.
                        A player can only be in one roster spot.
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3">
                  {/* Helper function to render a player card */}
                  {(() => {
                    // Helper to get fantasy points per game - ALWAYS calculate using YOUR league settings
                    const getFppg = (player: Player): number => {
                      const isGoalie = player.positions?.includes('G');

                      // For goalies, use blendedFppg from cache as fallback since we don't have full goalie stats in roster
                      if (isGoalie) {
                        if (player.blendedFppg != null && player.blendedFppg > 0) {
                          return player.blendedFppg;
                        }
                        return 0;
                      }

                      // For skaters: ALWAYS calculate using YOUR league settings (ignore cached blendedFppg)
                      if (!player.stats || !player.games_played || player.games_played === 0) return 0;

                      const weights = leagueSettings?.skater_scoring || {
                        goals: 1.3,
                        assists: 1.3,
                        shots_on_goal: 0.1,
                        blocks: 0.1,
                        powerplay_points: 1,
                        hits: 0.1
                      };

                      const totalPoints =
                        (player.stats.goals || 0) * (weights.goals || 0) +
                        (player.stats.assists || 0) * (weights.assists || 0) +
                        (player.stats.shots_on_goal || 0) * (weights.shots_on_goal || 0) +
                        (player.stats.blocks || 0) * (weights.blocks || 0) +
                        (player.stats.power_play_points || 0) * (weights.powerplay_points || 0);

                      return totalPoints / player.games_played;
                    };

                    const renderPlayerCard = (player: Player | null, posLabel: string, slotIndex: number) => {
                      if (!player) {
                        return (
                          <div className="flex flex-col items-center">
                            <div className="w-full h-16 bg-black/30 rounded border-2 border-dashed border-white/5 flex items-center justify-center hover:border-[var(--laser-cyan)]/30 transition-colors">
                              <span className="text-[10px] font-medium text-white/20 uppercase">{posLabel}</span>
                            </div>
                          </div>
                        );
                      }
                      const i = roster.indexOf(player);
                      const fppg = getFppg(player);
                      return (
                        <div className="group relative flex flex-col items-center">
                          <div className="relative w-full h-16 bg-gradient-to-br from-slate-700/40 to-slate-800/40 rounded border border-white/20 hover:border-[var(--laser-cyan)] hover:shadow-lg hover:shadow-[var(--laser-cyan)]/20 transition-all duration-200 flex flex-row items-center gap-1.5 px-2 py-1">
                            {/* Team Logo */}
                            <div className="flex-shrink-0">
                              <img
                                src={`https://assets.nhle.com/logos/nhl/svg/${player.team}_light.svg`}
                                alt={player.team}
                                className="w-10 h-10 object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                              <div className="hidden w-10 h-10 flex items-center justify-center text-sm font-bold text-white/40">{player.team || '??'}</div>
                            </div>

                            {/* Player Info */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <div className="text-[10px] font-bold text-white truncate leading-tight">
                                {player.full_name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-semibold text-[var(--laser-cyan)] bg-[var(--laser-cyan)]/10 px-1.5 py-0.5 rounded">
                                  {player.positions?.join('/')}
                                </span>
                                <span className="text-[9px] font-bold text-emerald-400">
                                  {fppg > 0 ? fppg.toFixed(1) : '0.0'}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => setRoster(roster.filter((_, idx) => idx !== i))}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded bg-red-500 text-white hover:bg-red-600 flex items-center justify-center text-[10px] font-bold shadow-md"
                              title="Remove player"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    };

                    // Organize players by position and fantasy PPG
                    // Separate players by position type
                    const forwards = roster.filter(p =>
                      p.positions?.includes('LW') ||
                      p.positions?.includes('C') ||
                      p.positions?.includes('RW')
                    ).sort((a, b) => getFppg(b) - getFppg(a));

                    const defensemen = roster.filter(p =>
                      p.positions?.includes('D') &&
                      !p.positions?.includes('LW') &&
                      !p.positions?.includes('RW')
                    ).sort((a, b) => getFppg(b) - getFppg(a));

                    const goalies = roster.filter(p => p.positions?.includes('G')).sort((a, b) => getFppg(b) - getFppg(a));

                    // Assign top players to active spots, rest to bench
                    // Ensure each player is only assigned to one position
                    const usedPlayers = new Set();
                    const lw = forwards.filter(p => p.positions?.includes('LW') && !usedPlayers.has(p.id)).slice(0, 2);
                    lw.forEach(p => usedPlayers.add(p.id));

                    const c = forwards.filter(p => p.positions?.includes('C') && !p.positions?.includes('LW') && !p.positions?.includes('RW') && !usedPlayers.has(p.id)).slice(0, 2);
                    c.forEach(p => usedPlayers.add(p.id));

                    const rw = forwards.filter(p => p.positions?.includes('RW') && !usedPlayers.has(p.id)).slice(0, 2);
                    rw.forEach(p => usedPlayers.add(p.id));
                    const d = defensemen.slice(0, 4);
                    const g = goalies.slice(0, 2);

                    // Everyone else goes to bench
                    const activeRoster = [...lw, ...c, ...rw, ...d, ...g];
                    const bench = roster.filter(p => !activeRoster.includes(p) && !p.positions?.includes('IR'));
                    const ir = roster.filter(p => p.positions?.includes('IR'));

                    const bn = bench;

                    // For display purposes
                    const lwDisplay = [lw[0] || null, lw[1] || null];
                    const cDisplay = [c[0] || null, c[1] || null];
                    const rwDisplay = [rw[0] || null, rw[1] || null];
                    const dDisplay = [d[0] || null, d[1] || null, d[2] || null, d[3] || null];
                    const gDisplay = [g[0] || null, g[1] || null];
                    const bnDisplay = [bn[0] || null, bn[1] || null, bn[2] || null, bn[3] || null];
                    const irDisplay = [ir[0] || null, ir[1] || null];

                    return (
                      <>
                        {/* Forwards Section */}
                        <div>
                          <h5 className="text-xs font-bold text-[var(--ci-white)] mb-1.5 uppercase tracking-wide border-b border-white/10 pb-1">Forwards</h5>

                          {/* Forward Line 1 */}
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {renderPlayerCard(lwDisplay[0], 'LW', 0)}
                            {renderPlayerCard(cDisplay[0], 'C', 0)}
                            {renderPlayerCard(rwDisplay[0], 'RW', 0)}
                          </div>

                          {/* Forward Line 2 */}
                          <div className="grid grid-cols-3 gap-2">
                            {renderPlayerCard(lwDisplay[1], 'LW', 1)}
                            {renderPlayerCard(cDisplay[1], 'C', 1)}
                            {renderPlayerCard(rwDisplay[1], 'RW', 1)}
                          </div>
                        </div>

                        {/* Defense Section */}
                        <div>
                          <h5 className="text-xs font-bold text-[var(--ci-white)] mb-1.5 uppercase tracking-wide border-b border-white/10 pb-1">Defensive Pairings</h5>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            {renderPlayerCard(dDisplay[0], 'D', 0)}
                            {renderPlayerCard(dDisplay[1], 'D', 1)}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {renderPlayerCard(dDisplay[2], 'D', 2)}
                            {renderPlayerCard(dDisplay[3], 'D', 3)}
                          </div>
                        </div>

                        {/* Goalies Section */}
                        <div>
                          <h5 className="text-xs font-bold text-[var(--ci-white)] mb-1.5 uppercase tracking-wide border-b border-white/10 pb-1">Goalies</h5>
                          <div className="grid grid-cols-2 gap-2">
                            {renderPlayerCard(gDisplay[0], 'G', 0)}
                            {renderPlayerCard(gDisplay[1], 'G', 1)}
                          </div>
                        </div>

                        {/* Bench Section */}
                        <div>
                          <h5 className="text-xs font-bold text-[var(--ci-white)] mb-1.5 uppercase tracking-wide border-b border-white/10 pb-1">Bench</h5>
                          <div className="grid grid-cols-4 gap-2">
                            {bnDisplay.map((player, idx) => renderPlayerCard(player, 'BN', idx))}
                            {bn.slice(4).map((player, idx) => renderPlayerCard(player, 'BN', idx + 4))}
                          </div>
                        </div>

                        {/* Injured Reserve Section */}
                        <div>
                          <h5 className="text-xs font-bold text-[var(--ci-white)] mb-1.5 uppercase tracking-wide border-b border-white/10 pb-1">Injured Reserve</h5>
                          <div className="grid grid-cols-2 gap-2">
                            {irDisplay.map((player, idx) => renderPlayerCard(player, idx === 0 ? 'IR' : 'IR+', idx))}
                            {ir.slice(2).map((player, idx) => renderPlayerCard(player, 'IR+', idx + 2))}
                          </div>
                        </div>

                        {/* Unassigned Players */}
                        {(() => {
                          const assigned = [...lw, ...c, ...rw, ...d, ...g, ...bn, ...ir];
                          const unassigned = roster.filter(p => !assigned.includes(p));
                          if (unassigned.length > 0) {
                            return (
                              <div>
                                <h5 className="text-sm font-bold text-amber-400 mb-3 uppercase tracking-wider border-b border-amber-400/30 pb-2">Unassigned Players</h5>
                                <div className="grid grid-cols-4 gap-3">
                                  {unassigned.map((player, idx) => renderPlayerCard(player, '?', idx))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    );
                  })()}
                </div>
                {unmatchedRoster.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                      <p className="text-xs font-semibold text-amber-400 mb-1">Unmatched Players</p>
                      <p className="text-xs text-amber-300/80">{unmatchedRoster.map(p => p.name).join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <ImageUploadZone
              title={roster.length > 0 ? "Upload Another Roster Screenshot" : "Upload Roster Screenshot"}
              description={roster.length > 0 ? `${roster.length} players uploaded so far. Add more if your roster spans multiple screens.` : "Screenshot of your current roster (typically 16 players)"}
              onUpload={handleRosterUpload}
              isUploading={rosterUploading}
              isComplete={false}
            />
          </div>
        )}
      </div>

      {/* Free Agents Section */}
      <div className="space-y-3">
        <SectionHeader
          section="free-agents"
          title="3. Available Free Agents"
          complete={status?.components.free_agents.present || false}
        />
        {expandedSection === 'free-agents' && (
          <div className="pl-4 space-y-4">
            {freeAgents.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-[var(--ci-white)]">
                    {freeAgents.length} free agents uploaded
                  </h4>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        setError(null);
                        try {
                          await apiService.uploadCoachFreeAgents({ free_agents: freeAgents });
                          await refreshStatus();
                        } catch (err) {
                          setError('Failed to save free agents changes');
                          console.error(err);
                        }
                      }}
                      className="text-xs text-[var(--laser-cyan)] hover:text-[#6ef7ff] transition font-semibold"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={handleClearFreeAgents}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {freeAgents.map((p, i) => {
                    // Helper to get fantasy points per game for free agents
                    const getFppg = (): number => {
                      const isGoalie = p.positions?.includes('G');
                      if (isGoalie) {
                        if (p.blendedFppg != null && p.blendedFppg > 0) {
                          return p.blendedFppg;
                        }
                        return 0;
                      }
                      if (p.blendedFppg != null && p.blendedFppg > 0) {
                        return p.blendedFppg;
                      }
                      if (!p.stats || !p.games_played || p.games_played === 0) return 0;
                      const weights = leagueSettings?.skater_scoring || {
                        goals: 1, assists: 1, shots_on_goal: 0.1, blocks: 0.1, powerplay_points: 0.5
                      };
                      const totalPoints =
                        (p.stats.goals || 0) * (weights.goals || 0) +
                        (p.stats.assists || 0) * (weights.assists || 0) +
                        (p.stats.shots_on_goal || 0) * (weights.shots_on_goal || 0) +
                        (p.stats.blocks || 0) * (weights.blocks || 0) +
                        (p.stats.power_play_points || 0) * (weights.powerplay_points || 0);
                      return totalPoints / p.games_played;
                    };
                    const fppg = getFppg();

                    return (
                      <div key={p.id} className="group relative flex items-center gap-2 rounded-lg border border-white/10 bg-gradient-to-br from-slate-700/40 to-slate-800/40 hover:border-[var(--laser-cyan)] hover:shadow-lg hover:shadow-[var(--laser-cyan)]/20 transition-all duration-200 px-3 py-2">
                        {/* Team Logo */}
                        <div className="flex-shrink-0">
                          <img
                            src={`https://assets.nhle.com/logos/nhl/svg/${p.team}_light.svg`}
                            alt={p.team}
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden w-10 h-10 flex items-center justify-center text-sm font-bold text-white/40">{p.team || '??'}</div>
                        </div>

                        {/* Player Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-[var(--ci-white)] truncate">
                            {p.full_name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[var(--ci-muted)]">{p.team}</span>
                            <span className="text-xs text-[var(--ci-muted)]">-</span>
                            <div className="flex items-center gap-1">
                              {(p.positions || []).map((pos: string, idx: number) => (
                                <span key={idx} className="text-[9px] font-semibold text-[var(--laser-cyan)] bg-[var(--laser-cyan)]/10 px-1.5 py-0.5 rounded">
                                  {pos}
                                </span>
                              ))}
                            </div>
                            <span className="text-xs font-bold text-emerald-400 ml-1">
                              {fppg > 0 ? fppg.toFixed(1) : '0.0'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setFreeAgents(freeAgents.filter((_, idx) => idx !== i));
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 text-xs px-2 py-1"
                          title="Remove player"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
                {unmatchedFreeAgents.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-xs text-amber-300">
                      {unmatchedFreeAgents.length} could not be matched automatically
                    </p>
                  </div>
                )}
              </div>
            )}
            <ImageUploadZone
              title={freeAgents.length > 0 ? "Upload Another Free Agents Screenshot" : "Upload Free Agents Screenshot"}
              description={freeAgents.length > 0 ? `${freeAgents.length} free agents uploaded so far. Add more if your list spans multiple screens.` : "Screenshot of available free agents in your league"}
              onUpload={handleFreeAgentsUpload}
              isUploading={freeAgentsUploading}
              isComplete={false}
            />
            <div className="mt-4">
              <CoachPlayerSearchPanel
                onPlayerSelect={handleAddPlayerToFreeAgents}
                mode="free_agents"
              />
            </div>
          </div>
        )}
      </div>

      {/* Conflicts Section */}
      {status?.components.roster.present && (
        <div className="space-y-3">
          <SectionHeader
            section="conflicts"
            title="4. Schedule Analysis"
            complete={conflicts !== null}
          />
          {expandedSection === 'conflicts' && (
            <div className="pl-4">
              <ConflictDashboard conflicts={conflicts} loading={conflictsLoading} />
              <button
                onClick={fetchConflicts}
                disabled={conflictsLoading}
                className="mt-4 w-full rounded-lg bg-[var(--laser-cyan)] px-4 py-2 text-sm font-semibold text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)]"
              >
                {conflictsLoading ? 'Analyzing...' : 'Refresh Analysis'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recommendations Section */}
      {status?.contextReady && (
        <div className="space-y-3">
          <SectionHeader
            section="recommendations"
            title="5. AI Recommendations"
            complete={recommendations !== null}
          />
          {expandedSection === 'recommendations' && (
            <div className="pl-4 space-y-4">
              {/* Window Selection */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h4 className="text-sm font-semibold text-[var(--ci-white)] mb-3">Time Window</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(['rest-of-week', '7d', '14d', '30d', 'rest-of-season', 'custom'] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setWindowPreset(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        windowPreset === preset
                          ? 'bg-[var(--laser-cyan)] text-[#001024]'
                          : 'bg-black/30 text-[var(--ci-muted)] border border-white/10 hover:border-[var(--laser-cyan)]'
                      }`}
                    >
                      {preset === 'rest-of-week' ? 'Rest of Week' :
                       preset === '7d' ? 'Next 7 Days' :
                       preset === '14d' ? 'Next 14 Days' :
                       preset === '30d' ? 'Next 30 Days' :
                       preset === 'rest-of-season' ? 'Rest of Season' :
                       'Custom'}
                    </button>
                  ))}
                </div>

                {windowPreset === 'custom' && (
                  <div className="flex gap-3 text-sm">
                    <input
                      type="date"
                      value={window.start}
                      onChange={(e) => setWindow({ ...window, start: e.target.value })}
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[var(--ci-white)]"
                    />
                    <input
                      type="date"
                      value={window.end}
                      onChange={(e) => setWindow({ ...window, end: e.target.value })}
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[var(--ci-white)]"
                    />
                  </div>
                )}

                <button
                  onClick={fetchRecommendations}
                  disabled={recommendationsLoading}
                  className="mt-3 w-full rounded-lg bg-[var(--laser-cyan)] px-4 py-2 text-sm font-semibold text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)]"
                >
                  {recommendationsLoading ? 'Generating...' : 'Get Recommendations'}
                </button>
              </div>

              {/* Recommendations List */}
              {recommendations && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-[var(--ci-muted)]">
                      Baseline: <span className="font-semibold text-[var(--ci-white)]">{recommendations.baseline_points.toFixed(2)} pts</span>
                    </p>
                  </div>

                  {recommendations.recommendations.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center">
                      <p className="text-sm text-[var(--ci-muted)]">
                        No improvements found in this window. Your roster looks solid!
                      </p>
                    </div>
                  ) : (
                    recommendations.recommendations.map((rec, index) => (
                      <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--laser-cyan)]">
                                #{index + 1}
                              </span>
                              {rec.badges.map((badge, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded-full bg-[var(--laser-cyan)]/20 text-[var(--laser-cyan)]"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                            <h4 className="text-base font-bold text-[var(--ci-white)]">
                              Add {rec.player.name}
                            </h4>
                            <p className="text-sm text-[var(--ci-muted)]">
                              {rec.player.team} - {rec.player.pos.join('/')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[var(--laser-cyan)]">
                              +{rec.deltaPoints.toFixed(2)}
                            </p>
                            <p className="text-xs text-[var(--ci-muted)]">
                              {rec.deltaGp >= 0 ? '+' : ''}{rec.deltaGp} GP
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/10 text-sm">
                          <p className="text-[var(--ci-muted)]">
                            Drop: <span className="text-[var(--ci-white)] font-medium">{rec.bestDrop.player.name}</span>
                            {' '}({rec.bestDrop.player.team}) - {rec.bestDrop.lostPoints.toFixed(2)} pts
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Chat - Always visible at bottom */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
        <div className="h-[500px]">
          <CoachChat window={window} contextReady={status?.contextReady || false} />
        </div>
      </div>
    </div>
  );
}
