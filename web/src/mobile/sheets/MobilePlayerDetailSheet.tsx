import { useState, useMemo } from 'react';
import { X, Star, StarOff, Flame, Snowflake, AlertTriangle, Calendar, TrendingUp, BarChart3, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MobileBottomSheet } from '../MobileBottomSheet';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobilePlayerDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  player: RosterPlayer | null;
  projection?: PlayerProjection;
  isOnRoster?: boolean;
  isWatched?: boolean;
  onAddToSlot?: () => void;
  onCompare?: () => void;
  onToggleWatch?: () => void;
  onRemove?: () => void;
}

type DetailTab = 'overview' | 'stats' | 'schedule' | 'career';

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
 */
export function MobilePlayerDetailSheet({
  isOpen,
  onClose,
  player,
  projection,
  isOnRoster = false,
  isWatched = false,
  onAddToSlot,
  onCompare,
  onToggleWatch,
  onRemove,
}: MobilePlayerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Calculate derived values
  const iceScore = projection?.iceScore ?? 0;
  const iceColors = getIceScoreColor(iceScore);

  // Calculate trend
  const seasonFppg = (player as any)?.seasonFppg ?? projection?.fppg ?? 0;
  const last7Fppg = (player as any)?.last7Fppg ?? seasonFppg;
  const trendPercent = seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;
  const isHot = trendPercent > 10;
  const isCold = trendPercent < -10;

  // Injury check
  const hasInjury = player?.injuryStatus && player.injuryStatus !== 'Active';

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
                  alt={player.full_name}
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
                  {player.full_name}
                </h2>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{player.team}</span>
                  <span>•</span>
                  <span>{player.positions?.join(', ') || 'N/A'}</span>
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
            <OverviewTab player={player} projection={projection} />
          )}
          {activeTab === 'stats' && (
            <StatsTab player={player} projection={projection} />
          )}
          {activeTab === 'schedule' && (
            <ScheduleTab player={player} projection={projection} />
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
function OverviewTab({ player, projection }: { player: RosterPlayer; projection?: PlayerProjection }) {
  const isGoalie = player.positions?.includes('G');

  return (
    <div className="space-y-4">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Games" value={projection?.gamesAvailable ?? 0} />
        <MetricCard label="Starts" value={projection?.starts ?? 0} />
        <MetricCard label="FPPG" value={(projection?.fppg ?? 0).toFixed(2)} />
      </div>

      {/* Projection Summary */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Projection Summary</h3>
        <div className="space-y-2">
          <ProjectionRow label="Games Available" value={projection?.gamesAvailable ?? 0} />
          <ProjectionRow label="Expected Starts" value={projection?.starts ?? 0} />
          <ProjectionRow label="Off-Night Rate" value={`${((projection?.offNightRate ?? 0) * 100).toFixed(0)}%`} />
          <ProjectionRow label="Schedule Strength" value={(projection?.strengthOfSchedule ?? 0).toFixed(2)} />
        </div>
      </div>

      {/* Fantasy Impact */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Fantasy Impact</h3>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">Projected FP</span>
          <span className="text-xl font-bold text-cyan-400">
            {((projection?.fppg ?? 0) * (projection?.gamesAvailable ?? 0)).toFixed(1)}
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

  if (!stats) {
    return (
      <div className="text-center py-8 text-slate-400">
        No statistics available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Season Stats */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Season Stats</h3>
        {isGoalie ? (
          <div className="grid grid-cols-2 gap-3">
            <StatRow label="Games" value={gamesPlayed} />
            <StatRow label="Goals" value={stats.goals ?? 0} />
            <StatRow label="Assists" value={stats.assists ?? 0} />
            <StatRow label="SOG" value={stats.shots_on_goal ?? 0} />
            <StatRow label="PPP" value={stats.power_play_points ?? 0} />
            <StatRow label="Blocks" value={stats.blocks ?? 0} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatRow label="Games" value={gamesPlayed} />
            <StatRow label="Goals" value={stats.goals ?? 0} />
            <StatRow label="Assists" value={stats.assists ?? 0} />
            <StatRow label="Points" value={(stats.goals ?? 0) + (stats.assists ?? 0)} />
            <StatRow label="PPP" value={stats.power_play_points ?? 0} />
            <StatRow label="SOG" value={stats.shots_on_goal ?? 0} />
            <StatRow label="Hits" value={stats.hits ?? 0} />
            <StatRow label="Blocks" value={stats.blocks ?? 0} />
          </div>
        )}
      </div>

      {/* Per Game Averages */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Per Game Averages</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatRow label="FPPG (Season)" value={(projection?.fppg ?? 0).toFixed(2)} />
          <StatRow label="FPPG (L7)" value={(player.last7Fppg ?? 0).toFixed(2)} />
          {!isGoalie && gamesPlayed > 0 && (
            <>
              <StatRow
                label="SOG/G"
                value={((stats.shots_on_goal ?? 0) / gamesPlayed).toFixed(1)}
              />
              <StatRow
                label="Hits/G"
                value={((stats.hits ?? 0) / gamesPlayed).toFixed(1)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Schedule Tab - Upcoming games
 */
function ScheduleTab({ player, projection }: { player: RosterPlayer; projection?: PlayerProjection }) {
  // Get games from projection's gamesByDate
  const gamesByDate = projection?.gamesByDate ?? {};
  const gameEntries = Object.entries(gamesByDate).sort(([a], [b]) => a.localeCompare(b));

  if (gameEntries.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No upcoming games in the time window</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {gameEntries.map(([date, game]) => (
        <div
          key={date}
          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-xs text-slate-400">
                {format(parseISO(date), 'EEE')}
              </div>
              <div className="text-sm font-bold text-white">
                {format(parseISO(date), 'M/d')}
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
          {game.isOffNight && (
            <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded">Off-Night</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Career Tab - Career trends (simplified)
 */
function CareerTab({ player }: { player: RosterPlayer }) {
  // Simplified career tab - would have charts in full implementation
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Career Overview</h3>
        <p className="text-slate-400 text-sm">
          Career statistics and trends would be displayed here with interactive charts
          showing performance over multiple seasons.
        </p>
      </div>

      {/* Basic career info */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Player Info</h3>
        <div className="space-y-2">
          <InfoRow label="Team" value={player.team || 'N/A'} />
          <InfoRow label="Positions" value={player.positions?.join(', ') || 'N/A'} />
          {player.bio?.sweaterNumber && (
            <InfoRow label="Number" value={`#${player.bio.sweaterNumber}`} />
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
