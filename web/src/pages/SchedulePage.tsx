import { useState, useEffect, useMemo } from 'react';
import { ScoreboardBanner } from '../components/ScoreboardBanner';
import { WeeklyScheduleGrid } from '../components/WeeklyScheduleGrid';
import { getCurrentWeekIso, getPrevWeekIso, getNextWeekIso, fetchWeeklyScheduleData, sortTeams, calculateWeeklyStats, calculateSeasonAverage, type WeeklySchedule, type SortMode, type DayId } from '../lib/schedule';
import { apiService } from '../services/api';
import type { RosterPlayer } from '../lib/coachSchemas';
import { useScheduleOverlaySettings } from '../hooks/useScheduleOverlaySettings';


// Season average cache constants
const SEASON_AVERAGE_CACHE_KEY = 'schedule-season-average-2025-26';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekIso());
  const [scheduleData, setScheduleData] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [selectedDay, setSelectedDay] = useState<DayId | null>(null);

  // User roster state for personalized overlays
  const [userRoster, setUserRoster] = useState<RosterPlayer[] | null>(null);
  const [userTeamCodes, setUserTeamCodes] = useState<Set<string>>(new Set());
  const [playerCountsByTeam, setPlayerCountsByTeam] = useState<Record<string, number>>({});
  const { settings, updateSettings } = useScheduleOverlaySettings();

  // Season average for week intensity classification
  const [seasonAverage, setSeasonAverage] = useState<number>(90); // Default fallback

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
          {/* Schedule Grid */}
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
          ) : displayScheduleData ? (
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
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--ci-muted)]">No schedule data available</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}