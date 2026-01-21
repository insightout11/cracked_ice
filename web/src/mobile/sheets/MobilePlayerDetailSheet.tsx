import { useState, useEffect, useMemo } from 'react';
import { X, Star, StarOff, Flame, Snowflake, AlertTriangle, Calendar, TrendingUp, BarChart3, User, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MobileBottomSheet } from '../MobileBottomSheet';
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

type DetailTab = 'overview' | 'stats' | 'schedule' | 'career';

interface ScheduleGame {
  date: string;
  opponent: string;
  isHome: boolean;
  isOffNight?: boolean;
  opponentGaPer60?: number;
}

/**
 * Get ICE score color based on value
 */
function getIceScoreColor(score: number): { bg: string; border: string; text: string } {
  if (score >= 85) return { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400' };
  if (score >= 70) return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400' };
  if (score >= 55) return { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400' };
  return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400' };
}

/**
 * Get headshot URL for NHL player
 */
function getHeadshotUrl(playerId: string, team: string): string {
  const numericId = playerId.replace(/^nhl:/, '');
  return `https://assets.nhle.com/mugs/nhl/20252026/${team}/${numericId}.png`;
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

  const tabs: { id: DetailTab; label: string; icon: typeof User }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
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
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-slate-800 z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>

          {/* Player Header */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-4">
              {/* Headshot */}
              <div className="relative flex-shrink-0">
                <img
                  src={getHeadshotUrl(player.id, player.team)}
                  alt={playerName}
                  className="w-20 h-20 rounded-full bg-slate-700 object-cover border-2 border-slate-600"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-player.png';
                  }}
                />
                {/* Team Logo */}
                <img
                  src={getTeamLogoUrl(player.team)}
                  alt={player.team}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 border border-slate-600 p-0.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">
                  {playerName}
                </h2>
                <div className="flex items-center gap-2 text-sm text-slate-400">
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
                <div className="flex items-center gap-3 mt-2">
                  {/* Trend */}
                  {(isHot || isCold) && (
                    <span className={`flex items-center gap-1 text-sm ${isHot ? 'text-orange-400' : 'text-blue-400'}`}>
                      {isHot ? <Flame className="w-4 h-4" /> : <Snowflake className="w-4 h-4" />}
                      {isHot ? '+' : ''}{trendPercent}%
                    </span>
                  )}

                  {/* Injury */}
                  {hasInjury && (
                    <span className="flex items-center gap-1 text-sm text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      {player.injuryStatus}
                    </span>
                  )}

                  {/* ICE Score Badge */}
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${iceColors.bg} ${iceColors.border} border`}>
                    <span className={`text-[10px] font-bold ${iceColors.text}`}>ICE</span>
                    <span className="text-sm font-bold text-white">{iceScore.toFixed(1)}</span>
                  </div>
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
                      ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-slate-400 hover:text-white'
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
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-4 py-3 safe-area-bottom">
          <div className="flex items-center gap-2">
            {/* Compare Button */}
            <button
              onClick={onCompare}
              className="flex-1 py-3 px-4 bg-slate-800 rounded-xl text-slate-300 font-medium text-sm hover:bg-slate-700 active:bg-slate-600 transition-colors"
            >
              Compare
            </button>

            {/* Add/Remove Button */}
            {isOnRoster ? (
              <button
                onClick={onRemove}
                className="flex-1 py-3 px-4 bg-red-600/20 rounded-xl text-red-400 font-medium text-sm hover:bg-red-600/30 active:bg-red-600/40 transition-colors"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={onAddToSlot}
                className="flex-1 py-3 px-4 bg-cyan-600 rounded-xl text-white font-medium text-sm hover:bg-cyan-500 active:bg-cyan-700 transition-colors"
              >
                Add to Slot
              </button>
            )}

            {/* Watch Button */}
            <button
              onClick={onToggleWatch}
              className={`p-3 rounded-xl transition-colors ${
                isWatched
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
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
  const isGoalie = player.positions?.includes('G');

  return (
    <div className="space-y-4">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Games" value={projection?.gamesAvailable ?? '-'} />
        <MetricCard label="Starts" value={projection?.starts ?? '-'} />
        <MetricCard label="FPPG" value={seasonFppg > 0 ? seasonFppg.toFixed(2) : '-'} />
      </div>

      {/* FPPG Breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">FPPG Breakdown</h3>
        <div className="space-y-2">
          <FppgRow label="Season" value={seasonFppg} isHighlighted={false} />
          <FppgRow label="Last 30 Days" value={last30Fppg} isHighlighted={last30Fppg > seasonFppg} />
          <FppgRow label="Last 7 Days" value={last7Fppg} isHighlighted={last7Fppg > seasonFppg} />
        </div>
      </div>

      {/* Projection Summary */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Projection Summary</h3>
        <div className="space-y-2">
          <ProjectionRow label="Games Available" value={projection?.gamesAvailable ?? 0} />
          <ProjectionRow label="Expected Starts" value={projection?.starts ?? 0} />
          <ProjectionRow label="Off-Night Rate" value={`${((projection?.offNightRate ?? 0) * 100).toFixed(0)}%`} />
          <ProjectionRow label="Schedule Strength" value={projection?.strengthOfSchedule?.toFixed(1) ?? '-'} />
        </div>
      </div>

      {/* Fantasy Impact */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Fantasy Impact</h3>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">Projected FP</span>
          <span className="text-xl font-bold text-cyan-400">
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
  const isGoalie = player.positions?.includes('G');
  const gamesPlayed = player.games_played ?? 0;

  // Even without stats object, show what we have
  const goals = stats?.goals ?? 0;
  const assists = stats?.assists ?? 0;
  const shotsOnGoal = stats?.shots_on_goal ?? 0;
  const powerPlayPoints = stats?.power_play_points ?? 0;
  const blocks = stats?.blocks ?? 0;
  const hits = stats?.hits ?? 0;

  return (
    <div className="space-y-4">
      {/* Season Stats */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Season Stats</h3>
        {isGoalie ? (
          <GoalieStatsGrid player={player} gamesPlayed={gamesPlayed} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatRow label="Games" value={gamesPlayed} />
            <StatRow label="Goals" value={goals} />
            <StatRow label="Assists" value={assists} />
            <StatRow label="Points" value={goals + assists} />
            <StatRow label="PPP" value={powerPlayPoints} />
            <StatRow label="SOG" value={shotsOnGoal} />
            <StatRow label="Hits" value={hits} />
            <StatRow label="Blocks" value={blocks} />
          </div>
        )}
      </div>

      {/* Per Game Averages */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Per Game Averages</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatRow label="FPPG (Season)" value={(player.seasonFppg ?? projection?.fppg ?? 0).toFixed(2)} />
          <StatRow label="FPPG (L30)" value={(player.last30Fppg ?? 0).toFixed(2)} />
          <StatRow label="FPPG (L7)" value={(player.last7Fppg ?? 0).toFixed(2)} />
          {!isGoalie && gamesPlayed > 0 && (
            <StatRow
              label="PPG"
              value={((goals + assists) / gamesPlayed).toFixed(2)}
            />
          )}
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
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No upcoming games in the time window</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">{games.length} games in window</p>
      {games.map((game) => (
        <div
          key={game.date}
          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="text-center min-w-[40px]">
              <div className="text-xs text-slate-400">
                {format(parseISO(game.date), 'EEE')}
              </div>
              <div className="text-sm font-bold text-white">
                {format(parseISO(game.date), 'M/d')}
              </div>
            </div>
            <div>
              <span className="text-sm text-slate-400">
                {game.isHome ? 'vs' : '@'}
              </span>
              <span className="text-sm font-medium text-white ml-1">
                {game.opponent}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {game.opponentGaPer60 !== undefined && (
              <span className="text-xs text-slate-500">
                GA/60: {game.opponentGaPer60.toFixed(2)}
              </span>
            )}
            {game.isOffNight && (
              <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded">
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
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Career Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatRow label="Seasons" value={careerSummary.totalSeasons ?? '-'} />
            <StatRow label="Total Games" value={careerSummary.totalGames ?? '-'} />
            <StatRow label="Career PPG" value={careerSummary.careerAvgPPG?.toFixed(2) ?? '-'} />
            <StatRow label="Best Season" value={careerSummary.bestSeason ?? '-'} />
          </div>
        </div>
      )}

      {/* Season-by-Season */}
      {hasCareerData ? (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Season History</h3>
          <div className="space-y-2">
            {Object.entries(careerHistory)
              .sort(([a], [b]) => b.localeCompare(a)) // Most recent first
              .slice(0, 5) // Show last 5 seasons
              .map(([season, stats]) => (
                <div key={season} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-16">{season}</span>
                    {stats.team && (
                      <span className="text-xs text-slate-500">{stats.team}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400">GP: <span className="text-white">{stats.gamesPlayed}</span></span>
                    {stats.points !== undefined && (
                      <span className="text-slate-400">P: <span className="text-white">{stats.points}</span></span>
                    )}
                    {stats.fppg !== undefined && (
                      <span className="text-slate-400">FPPG: <span className="text-cyan-400">{stats.fppg.toFixed(2)}</span></span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Career Overview</h3>
          <p className="text-slate-400 text-sm">
            Detailed career history is not available for this player.
          </p>
        </div>
      )}

      {/* Player Bio Info */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Player Info</h3>
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

// Helper Components
function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function FppgRow({ label, value, isHighlighted }: { label: string; value: number; isHighlighted: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-medium ${isHighlighted ? 'text-green-400' : 'text-white'}`}>
        {value > 0 ? value.toFixed(2) : '-'}
      </span>
    </div>
  );
}

function ProjectionRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-white">
        {typeof value === 'number' ? value.toFixed(1) : value}
      </span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}
