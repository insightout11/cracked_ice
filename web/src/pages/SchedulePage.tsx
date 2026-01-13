import { useState, useEffect, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { ScoreboardBanner } from '../components/ScoreboardBanner';
import { WeeklyScheduleGrid } from '../components/WeeklyScheduleGrid';
import { PlayerScheduleHeatMap } from '../components/schedule/PlayerScheduleHeatMap';
import { getCurrentWeekIso, getPrevWeekIso, getNextWeekIso, fetchWeeklyScheduleData, sortTeams, calculateWeeklyStats, calculateSeasonAverage, type WeeklySchedule, type SortMode, type DayId } from '../lib/schedule';
import { apiService } from '../services/api';
import type { RosterPlayer } from '../lib/coachSchemas';
import { useScheduleOverlaySettings } from '../hooks/useScheduleOverlaySettings';


// Season average cache constants
const SEASON_AVERAGE_CACHE_KEY = 'schedule-season-average-2025-26';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper types for PRO features
interface DayConflictInfo {
  rosteredPlayersPlaying: number;
  activeSlots: number;
  conflictLevel: 'free' | 'tight' | 'conflict';
  color: string;
}

interface TeamStreamingValue {
  team: string;
  extraUsableStarts: number;
  gapDatesCovered: string[];
}

/**
 * Calculate daily roster conflicts
 * Shows how many rostered players have games vs available active slots per day
 */
function calculateDayConflicts(
  scheduleData: WeeklySchedule,
  projections: Record<string, any>,
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
      color = '#FF4444'; // Red
    } else if (overflow >= -2) {
      conflictLevel = 'tight';
      color = '#FFC857'; // Yellow
    } else {
      conflictLevel = 'free';
      color = '#00FF00'; // Green
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

/**
 * Calculate streaming value for each team
 * Shows how many extra starts a team would create by filling gap dates
 */
function calculateStreamingValues(
  scheduleData: WeeklySchedule,
  unusedSlotsByDate: Record<string, Record<string, number>>,
  userRoster: RosterPlayer[]
): Record<string, TeamStreamingValue> {
  const teamValues: Record<string, TeamStreamingValue> = {};
  const ownedTeams = new Set(userRoster.map(p => p.team));

  scheduleData.teams.forEach(team => {
    // Skip teams user already owns
    if (ownedTeams.has(team.team)) {
      teamValues[team.team] = { team: team.team, extraUsableStarts: 0, gapDatesCovered: [] };
      return;
    }

    let totalValue = 0;
    const gapDatesCovered: string[] = [];

    // For each day, check if this team plays on a gap date
    scheduleData.days.forEach((day, index) => {
      const hasGame = (team.gamesByDay[day.id]?.length ?? 0) > 0;
      if (!hasGame) return;

      // Convert to date string
      const dateStr = format(addDays(new Date(scheduleData.weekOf), index), 'yyyy-MM-dd');
      const unusedSlots = unusedSlotsByDate[dateStr];

      if (unusedSlots && Object.keys(unusedSlots).length > 0) {
        const totalUnused = Object.values(unusedSlots).reduce((sum, n) => sum + n, 0);
        totalValue += totalUnused;
        gapDatesCovered.push(dateStr);
      }
    });

    teamValues[team.team] = { team: team.team, extraUsableStarts: totalValue, gapDatesCovered };
  });

  return teamValues;
}

export function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekIso());
  const [scheduleData, setScheduleData] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [selectedDay, setSelectedDay] = useState<DayId | null>(null);

  // View toggle state: 'teams' for team grid, 'players' for player schedule
  const [scheduleView, setScheduleView] = useState<'teams' | 'players'>('teams');
  const [playerViewWeekRange, setPlayerViewWeekRange] = useState<number>(8);

  // User roster state for personalized overlays
  const [userRoster, setUserRoster] = useState<RosterPlayer[] | null>(null);
  const [userTeamCodes, setUserTeamCodes] = useState<Set<string>>(new Set());
  const [playerCountsByTeam, setPlayerCountsByTeam] = useState<Record<string, number>>({});
  const { settings, updateSettings } = useScheduleOverlaySettings();

  // Season average for week intensity classification
  const [seasonAverage, setSeasonAverage] = useState<number>(90); // Default fallback

  // PRO Features: Projections data for conflict overlay and streaming value
  const [projections, setProjections] = useState<Record<string, any>>({});
  const [leagueProfile, setLeagueProfile] = useState<any>(null);
  const [unusedSlotsByDate, setUnusedSlotsByDate] = useState<Record<string, Record<string, number>>>({});
  const [isLoadingProjections, setIsLoadingProjections] = useState(false);

  // Load user roster for personalized features
  useEffect(() => {
    const loadUserRoster = async () => {
      try {
        const response = await apiService.getCoachRoster();
        setUserRoster(response.roster);

        // Extract team codes
        const codes = new Set(response.roster.map(p => p.team));
        setUserTeamCodes(codes);

        // Count players per team
        const counts: Record<string, number> = {};
        response.roster.forEach(player => {
          counts[player.team] = (counts[player.team] || 0) + 1;
        });
        setPlayerCountsByTeam(counts);
      } catch (err) {
        console.error('Failed to load user roster:', err);
        // Don't show error to user - personalization is optional
      }
    };

    loadUserRoster();
  }, []);

  // Load projections data for PRO features
  useEffect(() => {
    const loadProjections = async () => {
      if (!userRoster || userRoster.length === 0 || !scheduleData) return;

      setIsLoadingProjections(true);
      try {
        // Get league profile
        const context = await apiService.getCoachContext();
        setLeagueProfile(context.league_profile);

        // Build roster lineup for API
        const rosterLineup = userRoster.map(p => ({
          playerId: p.id,
          slot: p.current_slot || 'BN'
        }));

        // Get current week's date range
        const weekStart = scheduleData.weekOf;
        const weekEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd');

        // Call projections API
        const response = await apiService.applyRosterLineup({
          league: context.league_profile,
          window: { start: weekStart, end: weekEnd },
          roster: rosterLineup
        });

        setProjections(response.projections);
        setUnusedSlotsByDate(response.meta?.simulation?.unusedSlotsByDate || {});
      } catch (err) {
        console.error('Failed to load projections for PRO features:', err);
      } finally {
        setIsLoadingProjections(false);
      }
    };

    loadProjections();
  }, [userRoster, scheduleData?.weekOf]);

  // Calculate season average once on mount with caching
  useEffect(() => {
    const loadSeasonAverage = async () => {
      // Check cache first
      const cached = localStorage.getItem(SEASON_AVERAGE_CACHE_KEY);
      if (cached) {
        try {
          const { value, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < CACHE_DURATION_MS) {
            setSeasonAverage(value);
            console.log(`Using cached season average: ${value.toFixed(1)} games/week`);
            return;
          }
        } catch (err) {
          console.error('Failed to parse cached season average:', err);
        }
      }

      // Calculate fresh if cache miss or expired
      try {
        const avg = await calculateSeasonAverage();
        setSeasonAverage(avg);

        // Cache the result
        localStorage.setItem(SEASON_AVERAGE_CACHE_KEY, JSON.stringify({
          value: avg,
          timestamp: Date.now()
        }));

        console.log(`Season average calculated and cached: ${avg.toFixed(1)} games/week`);
      } catch (err) {
        console.error('Failed to calculate season average:', err);
        // Keep default of 90
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
  }, [currentWeek]);

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

  // Filter teams if user only wants to see their teams
  const displayScheduleData = useMemo(() => {
    if (!sortedScheduleData) return null;

    if (settings.filterUserTeamsOnly && userTeamCodes.size > 0) {
      const filteredTeams = sortedScheduleData.teams.filter(team =>
        userTeamCodes.has(team.team)
      );
      return { ...sortedScheduleData, teams: filteredTeams };
    }

    return sortedScheduleData;
  }, [sortedScheduleData, settings.filterUserTeamsOnly, userTeamCodes]);

  // Calculate day conflicts for PRO conflict overlay
  const dayConflicts = useMemo(() => {
    if (!scheduleData || !projections || !leagueProfile || !userRoster) return {};
    return calculateDayConflicts(scheduleData, projections, userRoster, leagueProfile.lineup_slots);
  }, [scheduleData, projections, userRoster, leagueProfile]);

  // Calculate streaming values for PRO streaming heatmap
  const streamingValues = useMemo(() => {
    if (!scheduleData || !unusedSlotsByDate || !userRoster) return {};
    return calculateStreamingValues(scheduleData, unusedSlotsByDate, userRoster);
  }, [scheduleData, unusedSlotsByDate, userRoster]);

  return (
    <main className="min-h-screen ice-rink-bg">
      {/* Faint ice overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('/textures/ice-noise.png')] bg-cover" />
      
      <div className="relative container mx-auto px-4 py-6 space-y-6">
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
          userHasRoster={userRoster !== null && userRoster.length > 0}
          playerViewWeekRange={playerViewWeekRange}
          onPlayerViewWeekRangeChange={setPlayerViewWeekRange}
        />

        <section
          className="glass glow-border p-4 md:p-6 space-y-4 relative"
          style={{
            minHeight: '800px',
            height: 'auto',
            overflow: 'visible',
            display: 'block',
            width: '100%',
            background: 'linear-gradient(135deg, var(--glass-bg), var(--glass-fill-hover))',
            backdropFilter: 'var(--frost-blur)',
            WebkitBackdropFilter: 'var(--frost-blur)'
          }}
        >
          {/* Schedule Grid or Player Schedule */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--laser-cyan)] mb-4"></div>
                <p className="text-[var(--ci-muted)]">Loading schedule...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          ) : scheduleView === 'teams' && displayScheduleData ? (
            <div style={{ minHeight: '600px', height: 'auto', overflow: 'visible' }}>
              <WeeklyScheduleGrid
                data={displayScheduleData}
                sortMode={sortMode}
                overlaySettings={settings}
                offNightDays={dailyGameStats.offNightDays}
                gamesPerDay={dailyGameStats.gamesPerDay}
                userTeamCodes={userTeamCodes}
                playerCountsByTeam={playerCountsByTeam}
                onDayClick={handleDayClick}
                selectedDay={selectedDay}
                dayConflicts={dayConflicts}
                streamingValues={streamingValues}
              />
            </div>
          ) : scheduleView === 'players' && userRoster && userRoster.length > 0 ? (
            <div style={{ minHeight: '600px', height: 'auto', overflow: 'visible' }}>
              <PlayerScheduleHeatMap
                rosterPlayers={userRoster}
                weekRange={playerViewWeekRange}
                startWeek={currentWeek}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--ci-muted)]">
                {scheduleView === 'players' ? 'No roster data available' : 'No schedule data available'}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}