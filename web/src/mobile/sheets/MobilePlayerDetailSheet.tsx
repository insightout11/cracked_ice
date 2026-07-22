import { useState, useEffect, useMemo } from 'react';
import { mugshotSeason, SEASON_ID } from '../../lib/season';
import { X, Star, StarOff, Flame, Snowflake, AlertTriangle, Calendar, TrendingUp, TrendingDown, BarChart3, User, Loader2, Clock, List } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MobileBottomSheet } from '../MobileBottomSheet';
import { FppgTrendCard } from '../components/FppgTrendCard';
import { StreakBanner } from '../components/StreakBanner';
import { RoleTrendCard } from '../components/RoleTrendCard';
import { MobileCareerChart } from '../components/MobileCareerChart';
import { ConsistencyCard } from '../components/ConsistencyCard';
import { apiService } from '../../services/api';
import type { RosterPlayer, PlayerProjection, LeagueProfile } from '../../lib/coachSchemas';
import type { TimeWindowState } from '../../types/timeWindow';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobilePlayerDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  player: RosterPlayer | null;
  projection?: PlayerProjection;
  timeWindow?: TimeWindowState;
  leagueProfile?: LeagueProfile;
  isOnRoster?: boolean;
  isWatched?: boolean;
  onAddToSlot?: () => void;
  onCompare?: () => void;
  onToggleWatch?: () => void;
  onRemove?: () => void;
}

type DetailTab = 'overview' | 'stats' | 'gamelog' | 'schedule' | 'career';

interface ScheduleGame {
  date: string;
  opponent: string;
  isHome: boolean;
  isOffNight?: boolean;
  opponentGaPer60?: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format season string from "20262027" to "2025-26"
 */
function formatSeason(season: string): string {
  if (season.length === 8) {
    return `${season.slice(0, 4)}-${season.slice(6, 8)}`;
  }
  return season;
}

/**
 * Format time on ice from seconds to MM:SS
 */
function formatToi(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds === 0) {
    return '-';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get ICE score color based on value
 */
function getIceScoreColor(score: number): { bg: string; border: string; text: string } {
  if (score >= 85) return { bg: 'bg-positive-muted', border: 'border-positive', text: 'text-positive' };
  if (score >= 70) return { bg: 'bg-warning-muted', border: 'border-warning', text: 'text-warning' };
  if (score >= 55) return { bg: 'bg-warning-muted', border: 'border-warning', text: 'text-warning' };
  return { bg: 'bg-negative-muted', border: 'border-negative', text: 'text-negative' };
}

/**
 * Get headshot URL for NHL player
 */
function getHeadshotUrl(playerId: string, team: string): string {
  const numericId = playerId.replace(/^nhl:/, '');
  return `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${team}/${numericId}.png`;
}

/**
 * Get strength of schedule label
 */
function getSosLabel(sos: number | undefined): string {
  if (sos === undefined) return '-';
  if (sos >= 1.1) return 'Hard';
  if (sos >= 0.95) return 'Avg';
  return 'Easy';
}

/**
 * MobilePlayerDetailSheet - Full player information bottom sheet
 *
 * Features:
 * - Full-screen expandable sheet
 * - Player header with headshot, name, team, ICE score
 * - Tabbed content (Overview, Stats, Schedule, Career)
 * - Sticky action bar at bottom
 * - Fetches schedule data for players without projection data
 */
export function MobilePlayerDetailSheet({
  isOpen,
  onClose,
  player,
  projection,
  timeWindow,
  leagueProfile,
  isOnRoster = false,
  isWatched = false,
  onAddToSlot,
  onCompare,
  onToggleWatch,
  onRemove,
}: MobilePlayerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [scheduleData, setScheduleData] = useState<ScheduleGame[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Fetch schedule data when sheet opens and we don't have gamesByDate
  useEffect(() => {
    const hasProjectionSchedule = projection?.gamesByDate && Object.keys(projection.gamesByDate).length > 0;

    if (isOpen && player?.team && timeWindow && !hasProjectionSchedule) {
      setIsLoadingSchedule(true);
      apiService.getPlayerSchedule(player.team, {
        start: timeWindow.config.startUtc,
        end: timeWindow.config.endUtc,
      })
        .then((response: any) => {
          // Handle various response formats
          const games = response.games || response.schedule || [];
          const formattedGames: ScheduleGame[] = games.map((g: any) => ({
            date: g.date || g.gameDate,
            opponent: g.opponent || g.opposingTeam?.abbrev || 'TBD',
            isHome: g.isHome ?? g.homeRoad === 'H',
            isOffNight: g.isOffNight ?? false,
            opponentGaPer60: g.opponentGaPer60,
          }));
          setScheduleData(formattedGames);
        })
        .catch((err) => {
          console.error('Failed to fetch schedule:', err);
          setScheduleData([]);
        })
        .finally(() => {
          setIsLoadingSchedule(false);
        });
    } else if (!isOpen) {
      // Reset schedule data when closing
      setScheduleData([]);
    }
  }, [isOpen, player?.id, player?.team, timeWindow, projection?.gamesByDate]);

  // Calculate derived values
  const iceScore = projection?.iceScore ?? 0;
  const iceColors = getIceScoreColor(iceScore);

  // Get FPPG values - matches desktop PlayerDetailModal.tsx lines 93-95
  const seasonFppg = player?.seasonFppg ?? projection?.fppg ?? 0;
  const last30Fppg = player?.last30Fppg ?? seasonFppg;
  const last7Fppg = player?.last7Fppg ?? seasonFppg;

  // Calculate trend
  const trendPercent = seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;
  const isHot = trendPercent > 10;
  const isCold = trendPercent < -10;

  // Injury check
  const hasInjury = player?.injuryStatus && player.injuryStatus !== 'Active';

  // Get player name - handle both formats
  const playerName = player?.full_name || (player as any)?.name || 'Unknown Player';

  // Get positions - handle both formats
  const positions = player?.positions || [(player as any)?.position].filter(Boolean);

  // Role trend data
  const roleTrend = player?.roleTrend;
  const hasRoleTrend = roleTrend && roleTrend.last7Games >= 3;
  const toiChangePercent = hasRoleTrend ? Math.round(roleTrend.toiChange * 100) : 0;
  const isRoleUp = toiChangePercent > 5;
  const isRoleDown = toiChangePercent < -5;

  const tabs: { id: DetailTab; label: string; icon: typeof User }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'gamelog', label: 'Game Log', icon: List },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'career', label: 'Career', icon: TrendingUp },
  ];

  if (!player) return null;

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={['90%']}
      initialSnap={0}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-2 border-b border-line">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-surface-2 z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-ink-dim" />
          </button>

          {/* Player Header */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-4">
              {/* Headshot */}
              <div className="relative flex-shrink-0">
                <img
                  src={getHeadshotUrl(player.id, player.team)}
                  alt={playerName}
                  className="w-20 h-20 rounded-full bg-surface-2 object-cover border-2 border-line"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-player.png';
                  }}
                />
                {/* Team Logo */}
                <img
                  src={getTeamLogoUrl(player.team)}
                  alt={player.team}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface-2 border border-line p-0.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-ink truncate">
                  {playerName}
                </h2>
                <div className="flex items-center gap-2 text-sm text-ink-dim">
                  <span>{player.team}</span>
                  <span>•</span>
                  <span>{positions.join(', ') || 'N/A'}</span>
                  {player.bio?.sweaterNumber && (
                    <>
                      <span>•</span>
                      <span>#{player.bio.sweaterNumber}</span>
                    </>
                  )}
                </div>

                {/* Status Row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Hot/Cold Trend */}
                  {(isHot || isCold) && (
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      isHot ? 'bg-warning-muted text-warning' : 'bg-accent-muted text-accent'
                    }`}>
                      {isHot ? <Flame className="w-3 h-3" /> : <Snowflake className="w-3 h-3" />}
                      {isHot ? '+' : ''}{trendPercent}%
                    </span>
                  )}

                  {/* ICE Score Badge */}
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${iceColors.bg} ${iceColors.border} border`}>
                    <span className={`text-[10px] font-bold ${iceColors.text}`}>ICE</span>
                    <span className="text-sm font-bold text-ink">{iceScore.toFixed(1)}</span>
                  </div>

                  {/* Role Trend Badge */}
                  {hasRoleTrend && (isRoleUp || isRoleDown) && (
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      isRoleUp ? 'bg-positive-muted text-positive' : 'bg-negative-muted text-negative'
                    }`}>
                      {isRoleUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      Role
                    </span>
                  )}

                  {/* Injury */}
                  {hasInjury && (
                    <span className="flex items-center gap-1 text-xs text-negative bg-negative-muted px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      {player.injuryStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex px-4 gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-surface-2 text-accent border-b-2 border-accent'
                      : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === 'overview' && (
            <OverviewTab
              player={player}
              projection={projection}
              seasonFppg={seasonFppg}
              last30Fppg={last30Fppg}
              last7Fppg={last7Fppg}
            />
          )}
          {activeTab === 'stats' && (
            <StatsTab player={player} projection={projection} />
          )}
          {activeTab === 'gamelog' && (
            <GameLogTab player={player} />
          )}
          {activeTab === 'schedule' && (
            <ScheduleTab
              player={player}
              projection={projection}
              scheduleData={scheduleData}
              isLoading={isLoadingSchedule}
            />
          )}
          {activeTab === 'career' && (
            <CareerTab player={player} />
          )}

          {/* Bottom padding for action bar */}
          <div className="h-24" />
        </div>

        {/* Sticky Action Bar */}
        <div className="sticky bottom-0 bg-surface-2 border-t border-line px-4 py-3 safe-area-bottom">
          <div className="flex items-center gap-2">
            {/* Compare Button */}
            <button
              onClick={onCompare}
              className="flex-1 py-3 px-4 bg-surface-2 rounded-xl text-ink-dim font-medium text-sm hover:bg-surface-2 active:bg-surface-2 transition-colors"
            >
              Compare
            </button>

            {/* Add/Remove Button */}
            {isOnRoster ? (
              <button
                onClick={onRemove}
                className="flex-1 py-3 px-4 bg-negative-muted rounded-xl text-negative font-medium text-sm hover:bg-negative-muted active:bg-negative-muted transition-colors"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={onAddToSlot}
                className="flex-1 py-3 px-4 bg-accent rounded-xl text-ink font-medium text-sm hover:bg-accent active:bg-accent transition-colors"
              >
                Add to Slot
              </button>
            )}

            {/* Watch Button */}
            <button
              onClick={onToggleWatch}
              className={`p-3 rounded-xl transition-colors ${
                isWatched
                  ? 'bg-warning-muted text-warning'
                  : 'bg-surface-2 text-ink-dim hover:bg-surface-2'
              }`}
              aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {isWatched ? (
                <Star className="w-5 h-5 fill-current" />
              ) : (
                <StarOff className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </MobileBottomSheet>
  );
}

/**
 * Overview Tab - Key metrics and projection summary
 */
function OverviewTab({
  player,
  projection,
  seasonFppg,
  last30Fppg,
  last7Fppg,
}: {
  player: RosterPlayer;
  projection?: PlayerProjection;
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
}) {
  const advStats = player.advancedStats;
  const roleTrend = player.roleTrend;

  // Get average TOI
  const avgToi = advStats?.avgToiPerGame;
  const ppToi = advStats?.ppTimeOnIcePerGame;

  return (
    <div className="space-y-4">
      {/* Hot/Cold Streak Banner - Shows when > 10% variance */}
      <StreakBanner
        seasonFppg={seasonFppg}
        last7Fppg={last7Fppg}
        threshold={10}
      />

      {/* Key Metrics Grid - Row 1 */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Games" value={projection?.gamesAvailable ?? '-'} />
        <MetricCard label="Starts" value={projection?.starts ?? '-'} />
        <MetricCard label="FPPG" value={seasonFppg > 0 ? seasonFppg.toFixed(2) : '-'} />
      </div>

      {/* Key Metrics Grid - Row 2 */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="TOI"
          value={formatToi(avgToi)}
          icon={<Clock className="w-3 h-3 text-ink-dim" />}
        />
        <MetricCard
          label="PP Time"
          value={formatToi(ppToi)}
          highlight={ppToi && ppToi > 120}
        />
        <MetricCard
          label="SoS"
          value={getSosLabel(projection?.strengthOfSchedule)}
          subvalue={projection?.strengthOfSchedule?.toFixed(2)}
        />
      </div>

      {/* FPPG Trend Card - Desktop-style with large values */}
      <FppgTrendCard
        seasonFppg={seasonFppg}
        last30Fppg={last30Fppg}
        last7Fppg={last7Fppg}
        gameLog={player.gameLog}
      />

      {/* Role Trend Card - TOI visualization */}
      {roleTrend && <RoleTrendCard roleTrend={roleTrend} />}

      {/* Fantasy Impact */}
      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3">Fantasy Impact</h3>
        <div className="flex items-center justify-between">
          <span className="text-ink-dim text-sm">Projected FP</span>
          <span className="text-xl font-bold text-accent">
            {projection?.projectedPoints?.toFixed(1) ?? ((seasonFppg) * (projection?.gamesAvailable ?? 0)).toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Stats Tab - Season statistics
 */
function StatsTab({ player, projection }: { player: RosterPlayer; projection?: PlayerProjection }) {
  const stats = player.stats;
  const advStats = player.advancedStats;
  const isGoalie = player.positions?.includes('G');
  const gamesPlayed = player.games_played ?? 0;

  // Get stat values
  const goals = stats?.goals ?? 0;
  const assists = stats?.assists ?? 0;
  const points = goals + assists;
  const shotsOnGoal = stats?.shots_on_goal ?? 0;
  const powerPlayPoints = stats?.power_play_points ?? 0;
  const blocks = stats?.blocks ?? 0;
  const hits = stats?.hits ?? 0;
  const plusMinus = (stats as any)?.plus_minus ?? (stats as any)?.plusMinus;

  // Calculate per-game and shooting %
  const goalsPerGame = gamesPlayed > 0 ? (goals / gamesPlayed).toFixed(2) : '-';
  const assistsPerGame = gamesPlayed > 0 ? (assists / gamesPlayed).toFixed(2) : '-';
  const pointsPerGame = gamesPlayed > 0 ? (points / gamesPlayed).toFixed(2) : '-';
  const pppPerGame = gamesPlayed > 0 ? (powerPlayPoints / gamesPlayed).toFixed(2) : '-';
  const shootingPct = shotsOnGoal > 0 ? ((goals / shotsOnGoal) * 100).toFixed(1) : '-';
  const sogPerGame = gamesPlayed > 0 ? (shotsOnGoal / gamesPlayed).toFixed(1) : '-';
  const hitsPerGame = gamesPlayed > 0 ? (hits / gamesPlayed).toFixed(1) : '-';
  const blocksPerGame = gamesPlayed > 0 ? (blocks / gamesPlayed).toFixed(1) : '-';

  if (isGoalie) {
    return (
      <div className="space-y-4">
        <div className="bg-surface-2 rounded-xl p-4">
          <h3 className="text-sm font-bold text-ink mb-3">Season Stats</h3>
          <GoalieStatsGrid player={player} gamesPlayed={gamesPlayed} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scoring */}
      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3">Scoring</h3>
        <div className="space-y-2">
          <StatRowWithPerGame label="Goals" total={goals} perGame={goalsPerGame} />
          <StatRowWithPerGame label="Assists" total={assists} perGame={assistsPerGame} />
          <StatRowWithPerGame label="Points" total={points} perGame={pointsPerGame} highlight />
          <StatRowWithPerGame label="PPP" total={powerPlayPoints} perGame={pppPerGame} />
        </div>
      </div>

      {/* Ice Time */}
      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3">Ice Time</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-ink">{formatToi(advStats?.avgToiPerGame)}</div>
            <div className="text-[10px] text-ink-dim uppercase">Avg TOI</div>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-accent">{formatToi(advStats?.ppTimeOnIcePerGame)}</div>
            <div className="text-[10px] text-ink-dim uppercase">PP TOI</div>
          </div>
        </div>
        {advStats?.shTimeOnIcePerGame !== undefined && advStats.shTimeOnIcePerGame > 0 && (
          <div className="mt-2 pt-2 border-t border-line">
            <div className="flex justify-between items-center">
              <span className="text-xs text-ink-dim">PK TOI</span>
              <span className="text-sm text-ink">{formatToi(advStats.shTimeOnIcePerGame)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Shooting */}
      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3">Shooting</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatRow label="SOG" value={shotsOnGoal} />
          <StatRow label="SOG/G" value={sogPerGame} />
          <StatRow label="SH%" value={shootingPct !== '-' ? `${shootingPct}%` : '-'} />
          <StatRow label="Games" value={gamesPlayed} />
        </div>
      </div>

      {/* Physical */}
      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3">Physical</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatRow label="Hits" value={hits} />
          <StatRow label="Hits/G" value={hitsPerGame} />
          <StatRow label="Blocks" value={blocks} />
          <StatRow label="Blocks/G" value={blocksPerGame} />
          {plusMinus !== undefined && (
            <>
              <StatRow
                label="+/-"
                value={plusMinus > 0 ? `+${plusMinus}` : plusMinus.toString()}
                highlight={plusMinus > 0}
                negative={plusMinus < 0}
              />
              <div /> {/* Empty cell for grid alignment */}
            </>
          )}
        </div>
      </div>

      {/* Possession (if available) */}
      {(advStats?.giveaways !== undefined || advStats?.takeaways !== undefined) && (
        <div className="bg-surface-2 rounded-xl p-4">
          <h3 className="text-sm font-bold text-ink mb-3">Possession</h3>
          <div className="grid grid-cols-2 gap-3">
            {advStats.takeaways !== undefined && (
              <StatRow label="Takeaways" value={advStats.takeaways} />
            )}
            {advStats.giveaways !== undefined && (
              <StatRow label="Giveaways" value={advStats.giveaways} />
            )}
          </div>
        </div>
      )}

      {/* FPPG Breakdown */}
      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3">Fantasy Points</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatRow label="Season" value={(player.seasonFppg ?? projection?.fppg ?? 0).toFixed(2)} />
          <StatRow label="L30" value={(player.last30Fppg ?? 0).toFixed(2)} />
          <StatRow label="L7" value={(player.last7Fppg ?? 0).toFixed(2)} />
        </div>
      </div>
    </div>
  );
}

/**
 * Goalie-specific stats grid
 */
function GoalieStatsGrid({ player, gamesPlayed }: { player: RosterPlayer; gamesPlayed: number }) {
  const stats = player.stats as any;

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatRow label="Games" value={gamesPlayed} />
      <StatRow label="Wins" value={stats?.wins ?? '-'} />
      <StatRow label="Losses" value={stats?.losses ?? '-'} />
      <StatRow label="OTL" value={stats?.overtimeLosses ?? '-'} />
      <StatRow label="Save %" value={stats?.savePct ? (stats.savePct * 100).toFixed(1) + '%' : '-'} />
      <StatRow label="GAA" value={stats?.goalsAgainstAverage?.toFixed(2) ?? '-'} />
      <StatRow label="Saves" value={stats?.saves ?? '-'} />
      <StatRow label="Shutouts" value={stats?.shutouts ?? '-'} />
    </div>
  );
}

/**
 * Schedule Tab - Upcoming games
 */
function ScheduleTab({
  player,
  projection,
  scheduleData,
  isLoading,
}: {
  player: RosterPlayer;
  projection?: PlayerProjection;
  scheduleData: ScheduleGame[];
  isLoading: boolean;
}) {
  // Prefer projection's gamesByDate, fall back to fetched schedule
  const gamesByDate = projection?.gamesByDate ?? {};
  const hasProjectionGames = Object.keys(gamesByDate).length > 0;

  // Build unified game list
  const games: ScheduleGame[] = useMemo(() => {
    if (hasProjectionGames) {
      return Object.entries(gamesByDate)
        .map(([date, game]) => ({
          date,
          opponent: game.opponent,
          isHome: game.isHome,
          isOffNight: game.isOffNight,
          opponentGaPer60: game.opponentGaPer60,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
    return scheduleData.sort((a, b) => a.date.localeCompare(b.date));
  }, [hasProjectionGames, gamesByDate, scheduleData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-ink-dim">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No upcoming games in the time window</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-dim mb-3">{games.length} games in window</p>
      {games.map((game) => (
        <div
          key={game.date}
          className="flex items-center justify-between p-3 bg-surface-2 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="text-center min-w-[40px]">
              <div className="text-xs text-ink-dim">
                {format(parseISO(game.date), 'EEE')}
              </div>
              <div className="text-sm font-bold text-ink">
                {format(parseISO(game.date), 'M/d')}
              </div>
            </div>
            <div>
              <span className="text-sm text-ink-dim">
                {game.isHome ? 'vs' : '@'}
              </span>
              <span className="text-sm font-medium text-ink ml-1">
                {game.opponent}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {game.opponentGaPer60 !== undefined && (
              <span className="text-xs text-ink-dim">
                GA/60: {game.opponentGaPer60.toFixed(2)}
              </span>
            )}
            {game.isOffNight && (
              <span className="text-xs text-warning bg-warning-muted px-2 py-0.5 rounded">
                Off-Night
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Game Log Tab - Recent game-by-game performance
 */
function GameLogTab({ player }: { player: RosterPlayer }) {
  const [visibleCount, setVisibleCount] = useState(10);
  const gameLog = player.gameLog;
  const isGoalie = player.positions?.includes('G');

  if (!gameLog || gameLog.length === 0) {
    return (
      <div className="text-center py-8 text-ink-dim">
        <List className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No game log data available</p>
      </div>
    );
  }

  const visibleGames = gameLog.slice(0, visibleCount);

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-dim mb-3">{gameLog.length} games played</p>
      {visibleGames.map((game, idx) => {
        const dateStr = (() => {
          try { return format(parseISO(game.gameDate), 'M/d'); } catch { return game.gameDate; }
        })();
        const dayStr = (() => {
          try { return format(parseISO(game.gameDate), 'EEE'); } catch { return ''; }
        })();
        const homeAway = game.isHome === true ? 'vs' : game.isHome === false ? '@' : '';

        return (
          <div key={`${game.gameDate}-${idx}`} className="bg-surface-2 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="text-center min-w-[36px]">
                  <div className="text-[10px] text-ink-dim">{dayStr}</div>
                  <div className="text-xs font-bold text-ink">{dateStr}</div>
                </div>
                {game.opponent && (
                  <span className="text-xs text-ink-dim">
                    <span className="text-ink-dim">{homeAway} </span>
                    {game.opponent}
                  </span>
                )}
              </div>
              {game.teamResult && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  game.teamResult === 'W' ? 'bg-positive-muted text-positive' : 'bg-negative-muted text-negative'
                }`}>
                  {game.teamResult}
                  {game.teamScore ? ` ${game.teamScore}` : ''}
                </span>
              )}
            </div>
            {isGoalie ? (
              <div className="flex items-center gap-3 text-xs">
                {game.decision && (
                  <span className={`font-bold ${game.decision === 'W' ? 'text-positive' : 'text-negative'}`}>
                    {game.decision}
                  </span>
                )}
                <span className="text-ink-dim">SV <span className="text-ink">{game.saves ?? '-'}</span></span>
                <span className="text-ink-dim">SA <span className="text-ink">{game.shotsAgainst ?? '-'}</span></span>
                <span className="text-ink-dim">SV% <span className="text-ink">{game.savePct != null ? (game.savePct * 100).toFixed(1) + '%' : '-'}</span></span>
                <span className="text-ink-dim">GAA <span className="text-ink">{game.gaa?.toFixed(2) ?? '-'}</span></span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-ink-dim">G <span className="text-ink font-bold">{game.goals}</span></span>
                <span className="text-ink-dim">A <span className="text-ink font-bold">{game.assists}</span></span>
                <span className="text-ink-dim">P <span className="text-accent font-bold">{game.points}</span></span>
                <span className="text-ink-dim">SOG <span className="text-ink">{game.shots}</span></span>
                {game.plusMinus != null && (
                  <span className="text-ink-dim">+/- <span className={game.plusMinus > 0 ? 'text-positive' : game.plusMinus < 0 ? 'text-negative' : 'text-ink'}>{game.plusMinus > 0 ? `+${game.plusMinus}` : game.plusMinus}</span></span>
                )}
                {game.toi && (
                  <span className="text-ink-dim">TOI <span className="text-ink">{game.toi}</span></span>
                )}
              </div>
            )}
          </div>
        );
      })}
      {visibleCount < gameLog.length && (
        <button
          onClick={() => setVisibleCount((c) => c + 10)}
          className="w-full py-2.5 text-sm text-accent bg-surface-2 rounded-xl hover:bg-surface-2 transition-colors"
        >
          Load More ({gameLog.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

/**
 * Career Tab - Career history and summary
 */
function CareerTab({ player }: { player: RosterPlayer }) {
  const careerHistory = player.careerHistory;
  const careerSummary = player.careerSummary;
  const hasCareerData = careerHistory && Object.keys(careerHistory).length > 0;

  return (
    <div className="space-y-4">
      {/* Career Summary */}
      {careerSummary && (
        <div className="bg-surface-2 rounded-xl p-4">
          <h3 className="text-sm font-bold text-ink mb-3">Career Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatRow label="Seasons" value={careerSummary.totalSeasons ?? '-'} />
            <StatRow label="Total Games" value={careerSummary.totalGames ?? '-'} />
            <StatRow label="Career PPG" value={careerSummary.careerAvgPPG?.toFixed(2) ?? '-'} />
            <StatRow
              label="Best Season"
              value={careerSummary.bestSeason ? formatSeason(careerSummary.bestSeason) : '-'}
            />
          </div>
        </div>
      )}

      {/* Career PPG Line Chart */}
      {hasCareerData && Object.keys(careerHistory).length >= 2 && (
        <MobileCareerChart
          careerHistory={careerHistory}
          currentSeason={SEASON_ID}
          metric="ppg"
        />
      )}

      {/* Consistency Card */}
      {hasCareerData && (
        <ConsistencyCard careerHistory={careerHistory} />
      )}

      {/* Season-by-Season */}
      {hasCareerData ? (
        <div className="bg-surface-2 rounded-xl p-4">
          <h3 className="text-sm font-bold text-ink mb-3">Season History</h3>
          <div className="space-y-2">
            {Object.entries(careerHistory)
              .sort(([a], [b]) => b.localeCompare(a)) // Most recent first
              .slice(0, 5) // Show last 5 seasons
              .map(([season, stats]) => (
                <div key={season} className="flex items-center justify-between p-2 bg-surface-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-dim font-medium w-14">
                      {formatSeason(season)}
                    </span>
                    {stats.team && (
                      <span className="text-xs text-ink-dim">{stats.team}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-ink-dim">
                      GP: <span className="text-ink">{stats.gamesPlayed}</span>
                    </span>
                    {stats.goals !== undefined && (
                      <span className="text-ink-dim">
                        G: <span className="text-ink">{stats.goals}</span>
                      </span>
                    )}
                    {stats.assists !== undefined && (
                      <span className="text-ink-dim">
                        A: <span className="text-ink">{stats.assists}</span>
                      </span>
                    )}
                    {stats.points !== undefined && (
                      <span className="text-ink-dim">
                        P: <span className="text-ink">{stats.points}</span>
                      </span>
                    )}
                    {stats.fppg !== undefined && (
                      <span className="text-ink-dim">
                        FPPG: <span className="text-accent">{stats.fppg.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="bg-surface-2 rounded-xl p-4">
          <h3 className="text-sm font-bold text-ink mb-3">Career Overview</h3>
          <p className="text-ink-dim text-sm">
            Detailed career history is not available for this player.
          </p>
        </div>
      )}

      {/* Player Bio Info */}
      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3">Player Info</h3>
        <div className="space-y-2">
          <InfoRow label="Team" value={player.team || 'N/A'} />
          <InfoRow label="Positions" value={player.positions?.join(', ') || 'N/A'} />
          {player.bio?.sweaterNumber && (
            <InfoRow label="Number" value={`#${player.bio.sweaterNumber}`} />
          )}
          {player.bio?.birthCity && (
            <InfoRow
              label="Birthplace"
              value={`${player.bio.birthCity}${player.bio.birthStateProvince ? `, ${player.bio.birthStateProvince}` : ''}${player.bio.birthCountry ? `, ${player.bio.birthCountry}` : ''}`}
            />
          )}
          {player.bio?.heightInInches && (
            <InfoRow
              label="Height"
              value={`${Math.floor(player.bio.heightInInches / 12)}'${player.bio.heightInInches % 12}"`}
            />
          )}
          {player.bio?.weightInPounds && (
            <InfoRow label="Weight" value={`${player.bio.weightInPounds} lbs`} />
          )}
          {player.bio?.draftYear && (
            <InfoRow
              label="Draft"
              value={`${player.bio.draftYear} R${player.bio.draftRound} #${player.bio.draftOverallPick}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function MetricCard({
  label,
  value,
  icon,
  highlight,
  subvalue,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  highlight?: boolean;
  subvalue?: string;
}) {
  return (
    <div className="bg-surface-2 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className={`text-xl font-bold ${highlight ? 'text-accent' : 'text-ink'}`}>
          {value}
        </span>
      </div>
      <div className="text-[10px] text-ink-dim uppercase tracking-wide">{label}</div>
      {subvalue && (
        <div className="text-[9px] text-ink-dim">{subvalue}</div>
      )}
    </div>
  );
}

function StatRowWithPerGame({
  label,
  total,
  perGame,
  highlight,
}: {
  label: string;
  total: number;
  perGame: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-ink-dim">{label}</span>
      <div className="flex items-center gap-4">
        <span className={`text-sm font-bold ${highlight ? 'text-accent' : 'text-ink'}`}>
          {total}
        </span>
        <span className="text-xs text-ink-dim w-12 text-right">{perGame}/G</span>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-2 bg-surface-2 rounded-lg">
      <span className="text-xs text-ink-dim">{label}</span>
      <span
        className={`text-sm font-bold ${
          highlight ? 'text-positive' : negative ? 'text-negative' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-dim">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}
