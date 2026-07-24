import { useState, useEffect, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, Sparkles } from 'lucide-react';
import { ScoreboardBanner } from '../components/ScoreboardBanner';
import { WeeklyScheduleGrid } from '../components/WeeklyScheduleGrid';
import { PlayerScheduleHeatMap } from '../components/schedule/PlayerScheduleHeatMap';
import { getCurrentWeekIso, getPrevWeekIso, getNextWeekIso, fetchWeeklyScheduleData, sortTeams, calculateWeeklyStats, getSeasonAverageGames, type WeeklySchedule, type SortMode, type DayId } from '../lib/schedule';
import { apiService } from '../services/api';
import type { PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import { useScheduleOverlaySettings } from '../hooks/useScheduleOverlaySettings';
import { SeasonSectionNav } from '../components/season/SeasonSectionNav';
import { useLeagueWorkspace } from '../contexts/LeagueWorkspaceContext';
import { toLeagueProfile } from '../lib/leagueWorkspace';
import { SeasonAnalysisPanel } from '../components/season/SeasonAnalysisPanel';
import { calculateTeamStreamingValues, getGapDayLabels, selectScheduleTeams, type ScheduleTeamOrder, type ScheduleTeamScope } from '../lib/scheduleOpportunity';
import { track } from '../lib/analytics';
import { ScheduleTeamDrawer } from '../components/season/ScheduleTeamDrawer';
import { calculateRangeStreamingValues, loadSeasonSchedule, planningIntentFromWorkspace, resolvePlanningWindow, workspaceWindowPreset, type PlanningIntent, type SeasonScheduleData } from '../lib/schedulePlanning';


// Helper types for PRO features
interface DayConflictInfo {
  rosteredPlayersPlaying: number;
  activeSlots: number;
  conflictLevel: 'free' | 'tight' | 'conflict';
  color: string;
}

/**
 * Calculate daily roster conflicts
 * Shows how many rostered players have games vs available active slots per day
 */
function calculateDayConflicts(
  scheduleData: WeeklySchedule,
  projections: Record<string, PlayerProjection>,
  userRoster: RosterPlayer[],
  lineupSlots: Record<string, number>
): Partial<Record<DayId, DayConflictInfo>> {
  const conflicts: Partial<Record<DayId, DayConflictInfo>> = {};

  // Calculate total active slots (exclude BN, IR, IR+)
  const activeSlots = Object.entries(lineupSlots)
    .filter(([pos]) => !['BN', 'IR', 'IR+', 'IR-LT'].includes(pos))
    .reduce((sum, [_, count]) => sum + count, 0);

  // For each day in the schedule
  scheduleData.days.forEach(day => {
    // Convert day to date string for projection lookup
    const dayDate = format(addDays(new Date(scheduleData.weekOf), scheduleData.days.indexOf(day)), 'yyyy-MM-dd');

    // Count rostered players with games on this date
    let playersPlaying = 0;
    userRoster.forEach(rosterPlayer => {
      const projection = projections[rosterPlayer.id];
      if (projection?.gamesByDate?.[dayDate]) {
        playersPlaying++;
      }
    });

    // Determine conflict level
    const overflow = playersPlaying - activeSlots;

    let conflictLevel: 'free' | 'tight' | 'conflict';
    let color: string;

    if (overflow >= 1) {
      conflictLevel = 'conflict';
      color = 'var(--negative)'; // Red
    } else if (overflow >= -2) {
      conflictLevel = 'tight';
      color = 'var(--warning)'; // Yellow
    } else {
      conflictLevel = 'free';
      color = 'var(--positive)'; // Green
    }

    conflicts[day.id] = {
      rosteredPlayersPlaying: playersPlaying,
      activeSlots,
      conflictLevel,
      color
    };
  });

  return conflicts;
}

export function SchedulePage() {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const [searchParams] = useSearchParams();
  const pageView = searchParams.get('view') === 'season' ? 'season' : 'week';
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekIso());
  const [scheduleData, setScheduleData] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [selectedDay, setSelectedDay] = useState<DayId | null>(null);

  // View toggle state: 'teams' for team grid, 'players' for player schedule
  const [scheduleView, setScheduleView] = useState<'teams' | 'players'>('teams');
  const [playerViewWeekRange, setPlayerViewWeekRange] = useState<number>(8);
  const [teamOrder, setTeamOrder] = useState<ScheduleTeamOrder>('schedule');
  const [selectedTeamCode, setSelectedTeamCode] = useState<string | null>(null);
  const [planningIntent, setPlanningIntent] = useState<PlanningIntent>(() => planningIntentFromWorkspace(activeLeague));
  const [planningLeagueId, setPlanningLeagueId] = useState(activeLeague.id);
  const [seasonSchedule, setSeasonSchedule] = useState<SeasonScheduleData | null>(null);

  const { settings, updateSettings } = useScheduleOverlaySettings();

  // Season average for week intensity classification
  const [seasonAverage, setSeasonAverage] = useState<number>(90); // Default fallback

  // PRO Features: Projections data for conflict overlay and streaming value
  const [projections, setProjections] = useState<Record<string, any>>({});
  const [unusedSlotsByDate, setUnusedSlotsByDate] = useState<Record<string, Record<string, number>>>({});
  const [isLoadingProjections, setIsLoadingProjections] = useState(false);
  const [projectionError, setProjectionError] = useState(false);

  useEffect(() => {
    track(pageView === 'season' ? 'season_view' : 'schedule_week_view', { source: 'season-page' });
  }, [pageView]);

  const userRoster = useMemo<RosterPlayer[]>(() => activeLeague.roster.map((entry) => ({
    id: entry.playerId,
    full_name: entry.fullName,
    team: entry.team,
    positions: entry.positions,
    current_slot: entry.slot,
    games_played: 0,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
  })), [activeLeague.roster]);
  const userTeamCodes = useMemo(() => new Set(userRoster.map((player) => player.team)), [userRoster]);
  const playerCountsByTeam = useMemo(() => userRoster.reduce<Record<string, number>>((counts, player) => {
    counts[player.team] = (counts[player.team] ?? 0) + 1;
    return counts;
  }, {}), [userRoster]);
  const leagueProfile = useMemo(() => toLeagueProfile(activeLeague), [activeLeague]);
  const planningWindow = useMemo(() => resolvePlanningWindow(planningIntent, currentWeek, activeLeague), [activeLeague, currentWeek, planningIntent]);

  useEffect(() => {
    if (planningLeagueId === activeLeague.id) return;
    setPlanningLeagueId(activeLeague.id);
    setPlanningIntent(planningIntentFromWorkspace(activeLeague));
  }, [activeLeague, planningLeagueId]);

  useEffect(() => {
    let cancelled = false;
    loadSeasonSchedule()
      .then((data) => { if (!cancelled) setSeasonSchedule(data); })
      .catch((loadError) => console.warn('Season schedule could not be loaded for planning.', loadError));
    return () => { cancelled = true; };
  }, []);

  // Load projections data for PRO features
  useEffect(() => {
    const loadProjections = async () => {
      if (pageView !== 'week' || userRoster.length === 0 || !scheduleData) return;

      setIsLoadingProjections(true);
      setProjectionError(false);
      try {
        // Build roster lineup for API
        const rosterLineup = userRoster.map(p => ({
          playerId: p.id,
          slot: p.current_slot || 'BN'
        }));

        // Call projections API
        const response = await apiService.applyRosterLineup({
          league: leagueProfile,
          window: { start: planningWindow.start, end: planningWindow.end },
          roster: rosterLineup
        });

        setProjections(response.projections);
        setUnusedSlotsByDate(response.meta?.simulation?.unusedSlotsByDate || {});
      } catch (err) {
        console.warn('Schedule lineup opportunities are temporarily unavailable.', err);
        setProjectionError(true);
      } finally {
        setIsLoadingProjections(false);
      }
    };

    loadProjections();
  }, [leagueProfile, pageView, planningWindow.end, planningWindow.start, scheduleData?.weekOf, userRoster]);

  // Derived data is season-keyed by the shared season configuration.
  useEffect(() => {
    const loadSeasonAverage = async () => {
      try {
        const avg = await getSeasonAverageGames();
        setSeasonAverage(avg);
      } catch (err) {
        console.error('Failed to calculate season average:', err);
      }
    };

    loadSeasonAverage();
  }, []);

  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle global navigation when not focused on interactive elements
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'BUTTON' ||
          document.activeElement?.tagName === 'SELECT') {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentWeek(prev => getPrevWeekIso(prev));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCurrentWeek(prev => getNextWeekIso(prev));
      } else if (event.key === 'h' || event.key === 'H') {
        // H for Help - show keyboard shortcuts
        event.preventDefault();
        alert('Keyboard shortcuts:\n← → Navigate weeks\nTab: Move between elements\nEnter: Activate focused element\nH: Show this help');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const loadScheduleData = async () => {
      if (pageView !== 'week') return;
      setLoading(true);
      setError(null);
      
      try {
        // Fetch real schedule data from API
        const data = await fetchWeeklyScheduleData(currentWeek);
        setScheduleData(data);
      } catch (err) {
        console.error('Failed to load schedule data:', err);
        setError('Failed to load schedule data');
      } finally {
        setLoading(false);
      }
    };

    loadScheduleData();
  }, [currentWeek, pageView]);

  const handleWeekChange = (newWeek: string) => {
    setCurrentWeek(newWeek);
  };

  const handleDayClick = (dayId: DayId) => {
    // Toggle day selection: click same day to deselect, click different day to select
    setSelectedDay(prev => prev === dayId ? null : dayId);
  };

  // Create sorted schedule data based on selected sort mode and selected day
  const sortedScheduleData = useMemo(() => {
    if (!scheduleData) return null;
    const sortedTeams = sortTeams(scheduleData.teams, sortMode, selectedDay);
    return { ...scheduleData, teams: sortedTeams };
  }, [scheduleData, sortMode, selectedDay]);

  // Calculate daily game stats (off-nights and game counts per day)
  const dailyGameStats = useMemo((): {
    offNightDays: Partial<Record<DayId, boolean>>;
    gamesPerDay: Partial<Record<DayId, number>>;
  } => {
    if (!sortedScheduleData) return { offNightDays: {}, gamesPerDay: {} };

    const offNightDays: Partial<Record<DayId, boolean>> = {};
    const gamesPerDay: Partial<Record<DayId, number>> = {};

    sortedScheduleData.days.forEach(day => {
      let totalGames = 0;
      sortedScheduleData.teams.forEach(team => {
        totalGames += (team.gamesByDay[day.id]?.length ?? 0);
      });
      // Divide by 2 since each game has 2 teams
      const actualGames = totalGames / 2;
      gamesPerDay[day.id] = actualGames;
      offNightDays[day.id] = actualGames <= 8;
    });

    return { offNightDays, gamesPerDay };
  }, [sortedScheduleData]);

  // Calculate weekly stats for intensity classification
  const weeklyStats = useMemo(() => {
    if (!sortedScheduleData) return null;
    return calculateWeeklyStats(sortedScheduleData, seasonAverage);
  }, [sortedScheduleData, seasonAverage]);

  // Calculate day conflicts for PRO conflict overlay
  const dayConflicts = useMemo(() => {
    if (!scheduleData || !projections || !leagueProfile || !userRoster) return {};
    return calculateDayConflicts(scheduleData, projections, userRoster, leagueProfile.lineup_slots);
  }, [scheduleData, projections, userRoster, leagueProfile]);

  // Calculate streaming values for PRO streaming heatmap
  const streamingValues = useMemo(() => {
    if (!scheduleData || !unusedSlotsByDate || !userRoster) return {};
    if (seasonSchedule) return calculateRangeStreamingValues(seasonSchedule, planningWindow, unusedSlotsByDate, userRoster.map((player) => player.team));
    return calculateTeamStreamingValues(scheduleData, unusedSlotsByDate, userRoster.map((player) => player.team));
  }, [planningWindow, scheduleData, seasonSchedule, unusedSlotsByDate, userRoster]);

  const teamScope: ScheduleTeamScope = settings.filterUserTeamsOnly && userTeamCodes.size > 0 ? 'roster' : 'league';
  const displayScheduleData = useMemo(() => sortedScheduleData ? {
    ...sortedScheduleData,
    teams: selectScheduleTeams(sortedScheduleData.teams, teamScope, teamOrder, userTeamCodes, streamingValues),
  } : null, [sortedScheduleData, streamingValues, teamOrder, teamScope, userTeamCodes]);
  const selectedTeam = useMemo(() => scheduleData?.teams.find((team) => team.team === selectedTeamCode) ?? null, [scheduleData, selectedTeamCode]);

  const handleTeamScopeChange = (scope: ScheduleTeamScope) => {
    updateSettings({ filterUserTeamsOnly: scope === 'roster' });
  };

  const handleTeamOrderChange = (order: ScheduleTeamOrder) => {
    setTeamOrder(order);
    if (order === 'opportunity') updateSettings({ showStreamingValue: true });
  };

  const handlePlanningIntentChange = (intent: PlanningIntent) => {
    const nextWindow = resolvePlanningWindow(intent, currentWeek, activeLeague);
    const now = new Date().toISOString();
    setPlanningIntent(intent);
    updateLeague({
      ...activeLeague,
      schedule: { ...activeLeague.schedule, defaultWindow: workspaceWindowPreset(nextWindow) },
      updatedAt: now,
    });
  };

  const gapDayLabels = useMemo(() => {
    if (!scheduleData) return [];
    return getGapDayLabels(scheduleData, unusedSlotsByDate);
  }, [scheduleData, unusedSlotsByDate]);

  const bestFills = useMemo(() => Object.values(streamingValues)
    .filter((value) => value.extraUsableStarts > 0 && !value.representedOnRoster)
    .sort((a, b) => b.extraUsableStarts - a.extraUsableStarts || a.team.localeCompare(b.team))
    .slice(0, 3), [streamingValues]);

  return (
    <main className="min-h-screen ice-rink-bg">
      {/* Faint ice overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('/textures/ice-noise.png')] bg-cover" />
      <div className="relative container mx-auto px-4 py-6 space-y-6">
        {pageView === 'season' ? <><SeasonSectionNav /><SeasonAnalysisPanel /></> : <>
        <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
          <SeasonSectionNav />
          <ScoreboardBanner
          weekIso={currentWeek}
          onWeekChange={handleWeekChange}
          sortMode={sortMode}
          onSortChange={setSortMode}
          overlaySettings={settings}
          onOverlaySettingsChange={updateSettings}
          userTeamCount={userTeamCodes.size}
          weeklyStats={weeklyStats}
          selectedDay={selectedDay}
          onClearDayFilter={() => setSelectedDay(null)}
          scheduleView={scheduleView}
          onScheduleViewChange={setScheduleView}
          userHasRoster={userRoster.length > 0}
          playerViewWeekRange={playerViewWeekRange}
          onPlayerViewWeekRangeChange={setPlayerViewWeekRange}
          />
        </div>

        <section className="rounded-xl border border-line-strong bg-surface-glass p-3 shadow-card" aria-labelledby="schedule-answer-title">
          {userRoster.length === 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="scoreboard-text text-accent">YOUR WEEK</p>
                <h1 id="schedule-answer-title" className="mt-0.5 text-lg font-semibold text-ink">Find the nights your roster can actually use</h1>
                <p className="mt-1 text-sm text-ink-dim">Add your roster once to reveal open lineup nights and teams that cover them.</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
                  Planning window
                  <select value={planningIntent} onChange={(event) => handlePlanningIntentChange(event.target.value as PlanningIntent)} className="min-h-11 rounded-md border border-line bg-surface-0 px-3 text-sm font-semibold normal-case tracking-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <option value="week">Selected week</option>
                    <option value="14d">Next 14 days</option>
                    <option value="30d">Next 30 days</option>
                    <option value="playoffs">Fantasy playoffs</option>
                    <option value="rest-of-season">Rest of season</option>
                  </select>
                </label>
                <Link to="/team" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Set up My Team <ChevronRight size={16} aria-hidden="true" /></Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="scoreboard-text flex items-center gap-2 text-accent"><Sparkles size={14} aria-hidden="true" />ROSTER OPPORTUNITY</p>
                <h1 id="schedule-answer-title" className="mt-0.5 text-lg font-semibold text-ink">
                  {isLoadingProjections ? 'Calculating your usable nights…' : projectionError ? 'Schedule loaded; lineup fit is temporarily unavailable' : gapDayLabels.length ? `You have lineup room ${gapDayLabels.join(', ')}` : 'Your active lineup is full on every game night'}
                </h1>
                <p className="mt-1 text-sm text-ink-dim">
                  {bestFills.length > 0 ? <>Best team fits: {bestFills.map((fill) => `${fill.team} (+${fill.extraUsableStarts})`).join(' · ')}</> : 'Usable starts account for the active slots saved in League Settings.'}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2 text-xs text-ink-dim">
                <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
                  Planning window
                  <select value={planningIntent} onChange={(event) => handlePlanningIntentChange(event.target.value as PlanningIntent)} className="min-h-11 rounded-md border border-line bg-surface-0 px-3 text-sm font-semibold normal-case tracking-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <option value="week">Selected week</option>
                    <option value="14d">Next 14 days</option>
                    <option value="30d">Next 30 days</option>
                    <option value="playoffs">Fantasy playoffs</option>
                    <option value="rest-of-season">Rest of season</option>
                  </select>
                </label>
                <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface-1 px-3"><CalendarDays size={13} className="text-accent" aria-hidden="true" />{activeLeague.name}</span>
                <span className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface-1 px-3">{activeLeague.scoring.label}</span>
              </div>
            </div>
          )}
        </section>

        <section
          className="relative w-full rounded-xl border border-line bg-surface-glass p-2 shadow-card md:p-4">
          {/* Schedule Grid or Player Schedule */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mb-4"></div>
                <p className="text-[var(--ink-mute)]">Loading schedule...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-negative-muted border border-negative text-negative px-4 py-3 rounded mb-4">
              {error}
            </div>
          ) : scheduleView === 'teams' && displayScheduleData ? (
            <div>
              <WeeklyScheduleGrid
                data={displayScheduleData}
                overlaySettings={settings}
                offNightDays={dailyGameStats.offNightDays}
                gamesPerDay={dailyGameStats.gamesPerDay}
                userTeamCodes={userTeamCodes}
                playerCountsByTeam={playerCountsByTeam}
                onDayClick={handleDayClick}
                selectedDay={selectedDay}
                dayConflicts={dayConflicts}
                streamingValues={streamingValues}
                teamScope={teamScope}
                teamOrder={teamOrder}
                canPersonalize={userRoster.length > 0}
                selectedTeam={selectedTeamCode}
                onTeamScopeChange={handleTeamScopeChange}
                onTeamOrderChange={handleTeamOrderChange}
                onTeamSelect={setSelectedTeamCode}
              />
            </div>
          ) : scheduleView === 'players' && userRoster.length > 0 ? (
            <div>
              <PlayerScheduleHeatMap
                rosterPlayers={userRoster}
                weekRange={playerViewWeekRange}
                startWeek={currentWeek}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--ink-mute)]">
                {scheduleView === 'players' ? 'No roster data available' : 'No schedule data available'}
              </p>
            </div>
          )}
        </section>
        <ScheduleTeamDrawer open={selectedTeam !== null} team={selectedTeam} opportunity={selectedTeam ? streamingValues[selectedTeam.team] : undefined} leagueProfile={leagueProfile} planningWindow={planningWindow} onOpenChange={(open) => { if (!open) setSelectedTeamCode(null); }} />
        </>}
      </div>
    </main>
  );
}
