// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, Calendar, Rocket, Moon, Flame, Snowflake, TrendingUp, Target, Zap, Activity, BarChart3, GitCompare, User } from 'lucide-react';
import type { RosterPlayer, PlayerProjection, LeagueProfile } from '../lib/coachSchemas';
import type { TeamTierData } from '../types/teamTiers';
import type { TimeWindowState } from '../types/timeWindow';
import { getTeamLogoUrl, getTeamColor } from '../lib/teamLogos';
import { getIceCircleStyle, shouldPulse } from '../lib/iceScore';
import { CareerTrendChart } from './charts/CareerTrendChart';
import { CareerSummaryCard } from './player/CareerSummaryCard';
import { InjuryBadge } from './player/InjuryBadge';
import { GoalsAssistsSplitChart } from './charts/GoalsAssistsSplitChart';
import { GamesPlayedTrendChart } from './charts/GamesPlayedTrendChart';
import { ConsistencyMetricChart } from './charts/ConsistencyMetricChart';
import { GoalieSavePercentageTrendChart } from './charts/GoalieSavePercentageTrendChart';
import { GoalieGAATrendChart } from './charts/GoalieGAATrendChart';
import { GoalieWinsShutoutsChart } from './charts/GoalieWinsShutoutsChart';

interface PlayerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: RosterPlayer;
  projection?: PlayerProjection;
  teamTier?: TeamTierData;
  timeWindow: TimeWindowState;
  leagueProfile: LeagueProfile;
  onCompare?: () => void;
}

type TabType = 'overview' | 'stats' | 'schedule' | 'trends' | 'career' | 'about';

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  isOpen,
  onClose,
  player,
  projection,
  teamTier,
  timeWindow,
  leagueProfile,
  onCompare,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Reset to overview when player changes
  useEffect(() => {
    setActiveTab('overview');
  }, [player.id]);

  // Keyboard handler for ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Extract data
  const positions = Array.isArray(player.positions) ? player.positions.join('/') : 'N/A';
  const isGoalie = Array.isArray(player.positions) && player.positions.includes('G');
  const teamColor = getTeamColor(player.team);
  const teamLogo = getTeamLogoUrl(player.team);

  // Get headshot URL
  const getHeadshotUrl = (playerId: string, team: string) => {
    const numericId = playerId.replace(/^nhl:/, '');
    return `https://assets.nhle.com/mugs/nhl/20242025/${team}/${numericId}.png`;
  };
  const headshotUrl = getHeadshotUrl(player.id, player.team);

  // Calculate FPPG metrics
  const seasonFppg = (player as any).seasonFppg ?? projection?.fppg ?? 0;
  const last30Fppg = (player as any).last30Fppg ?? seasonFppg;
  const last7Fppg = (player as any).last7Fppg ?? seasonFppg;
  const calculatedIce = (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2);
  const iceScore = projection?.iceScore ?? calculatedIce;

  // Determine hot/cold streak
  const isHot = last7Fppg > seasonFppg && seasonFppg > 0;
  const isCold = last7Fppg < seasonFppg * 0.8 && seasonFppg > 0;
  const trendPercent = seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;

  // Get ICE score styling
  const iceCircleStyle = getIceCircleStyle(iceScore, 0, 5);
  const isPulseEnabled = shouldPulse(iceScore, 0, 5);

  // SoS info
  const getSosInfo = (sos?: number): { label: string; color: string; dotColor: string } => {
    if (sos === undefined) return { label: 'N/A', color: 'text-gray-400', dotColor: 'bg-gray-400' };
    if (sos >= 7) return { label: 'Easy', color: 'text-green-400', dotColor: 'bg-green-400' };
    if (sos <= 3) return { label: 'Tough', color: 'text-red-400', dotColor: 'bg-red-400' };
    return { label: 'Moderate', color: 'text-gray-400', dotColor: 'bg-gray-400' };
  };
  const sosInfo = getSosInfo(projection?.strengthOfSchedule);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-title"
    >
      <div className="relative bg-slate-950 rounded-2xl shadow-2xl border border-slate-800/50 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 p-6">
          {/* Team color accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ backgroundColor: teamColor }}
          />

          {/* Action buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            {/* Compare button */}
            {onCompare && (
              <button
                onClick={onCompare}
                className="p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-cyan-400 group"
                aria-label="Compare player"
                title="Compare with another player"
              >
                <GitCompare className="w-5 h-5" />
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-white"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-start gap-6 pr-12">
            {/* Left: Player image and identity */}
            <div className="flex items-center gap-4">
              {/* Headshot */}
              <div className="relative">
                <img
                  src={headshotUrl}
                  alt={player.full_name}
                  className="w-20 h-20 rounded-full bg-slate-800 object-cover border-2 border-slate-700"
                  onError={(e) => {
                    e.currentTarget.src = '/player-placeholder.png';
                  }}
                />
                {/* Team logo overlay */}
                <img
                  src={teamLogo}
                  alt={player.team}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white/10 border border-slate-700 p-0.5"
                />
              </div>

              {/* Player info */}
              <div className="flex flex-col">
                <h2 id="player-detail-title" className="text-2xl font-bold text-white">
                  {player.full_name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-cyan-400 font-semibold">{player.team}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">{positions}</span>
                  {(player.injuryStatus || player.isActive !== undefined) && (
                    <>
                      <span className="text-slate-500">•</span>
                      <InjuryBadge
                        injuryStatus={player.injuryStatus}
                        isActive={player.isActive}
                        size="lg"
                      />
                    </>
                  )}
                </div>
                {player.current_slot && (
                  <div className="mt-1 text-xs text-slate-400">
                    Current Slot: <span className="text-cyan-400 font-semibold">{player.current_slot}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: ICE Score and stats snapshot */}
            <div className="ml-auto flex items-center gap-6">
              {/* Hot/Cold Indicator */}
              {(isHot || isCold) && (
                <div className="flex flex-col items-center">
                  {isHot ? (
                    <>
                      <Flame className="w-6 h-6 text-orange-400" />
                      <span className="text-xs text-orange-400 font-semibold mt-1">Hot +{trendPercent}%</span>
                    </>
                  ) : (
                    <>
                      <Snowflake className="w-6 h-6 text-blue-400" />
                      <span className="text-xs text-blue-400 font-semibold mt-1">Cold {trendPercent}%</span>
                    </>
                  )}
                </div>
              )}

              {/* ICE Score */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-16 h-16 rounded-full flex items-center justify-center
                    border-2 font-bold text-lg
                    ${isPulseEnabled ? 'animate-pulse' : ''}
                  `}
                  style={{
                    borderColor: iceCircleStyle.borderColor,
                    backgroundColor: iceCircleStyle.backgroundColor,
                    color: iceCircleStyle.textColor,
                  }}
                >
                  {iceScore.toFixed(1)}
                </div>
                <span className="text-xs text-slate-400 mt-1 font-semibold">ICE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/50 px-6">
          {[
            { id: 'overview', label: 'Overview', icon: Target },
            { id: 'stats', label: 'Stats', icon: Activity },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
            { id: 'career', label: 'Career', icon: BarChart3 },
            { id: 'about', label: 'About', icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`
                  flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-all
                  border-b-2
                  ${isActive
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              player={player}
              projection={projection}
              seasonFppg={seasonFppg}
              last30Fppg={last30Fppg}
              last7Fppg={last7Fppg}
              sosInfo={sosInfo}
              isHot={isHot}
              isCold={isCold}
              trendPercent={trendPercent}
            />
          )}

          {activeTab === 'stats' && (
            <StatsTab player={player} leagueProfile={leagueProfile} />
          )}

          {activeTab === 'schedule' && (
            <ScheduleTab player={player} projection={projection} timeWindow={timeWindow} />
          )}

          {activeTab === 'trends' && (
            <TrendsTab
              player={player}
              seasonFppg={seasonFppg}
              last30Fppg={last30Fppg}
              last7Fppg={last7Fppg}
              isHot={isHot}
              isCold={isCold}
              trendPercent={trendPercent}
            />
          )}

          {activeTab === 'career' && (
            <div className="space-y-6">
              {player.careerHistory && player.careerSummary ? (
                <>
                  <CareerSummaryCard
                    careerHistory={player.careerHistory}
                    careerSummary={player.careerSummary}
                    currentSeason={timeWindow.season || undefined}
                  />

                  {/* Only show skater-specific charts for non-goalies */}
                  {!isGoalie && (
                    <>
                      <CareerTrendChart
                        careerHistory={player.careerHistory}
                        careerSummary={player.careerSummary}
                        currentSeason={timeWindow.season || undefined}
                      />

                      {/* NEW: 2-column grid for Goals/Assists and Games Played charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <GoalsAssistsSplitChart
                          careerHistory={player.careerHistory}
                          currentSeason={timeWindow.season || undefined}
                        />

                        <GamesPlayedTrendChart
                          careerHistory={player.careerHistory}
                          currentSeason={timeWindow.season || undefined}
                        />
                      </div>

                      {/* NEW: Full-width consistency chart */}
                      <ConsistencyMetricChart
                        careerHistory={player.careerHistory}
                        currentSeason={timeWindow.season || undefined}
                      />
                    </>
                  )}

                  {/* Show goalie-specific charts for goalies */}
                  {isGoalie && (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <GoalieSavePercentageTrendChart careerHistory={player.careerHistory} />
                        <GoalieGAATrendChart careerHistory={player.careerHistory} />
                      </div>
                      <GoalieWinsShutoutsChart careerHistory={player.careerHistory} />
                      <GamesPlayedTrendChart
                        careerHistory={player.careerHistory}
                        currentSeason={timeWindow.season || undefined}
                      />
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg mb-2">No Career Data Available</p>
                  <p className="text-slate-500 text-sm">
                    Career history will be available after the next data sync.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-6 max-w-3xl">
              {player.bio ? (
                <>
                  {/* Jersey Number & Basic Info */}
                  <div className="flex items-center gap-6">
                    {player.bio.sweaterNumber && (
                      <div className="bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 rounded-lg p-6 text-center min-w-[120px]">
                        <div className="text-4xl font-bold text-white mb-1">#{player.bio.sweaterNumber}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wide">Jersey</div>
                      </div>
                    )}

                    {player.bio.shootsCatches && (
                      <div className="flex-1 bg-slate-800/30 border border-slate-700 rounded-lg p-4">
                        <div className="text-slate-400 text-sm mb-1">Shoots/Catches</div>
                        <div className="text-2xl font-bold text-cyan-400">
                          {player.bio.shootsCatches === 'L' ? 'Left' : player.bio.shootsCatches === 'R' ? 'Right' : player.bio.shootsCatches}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Draft Card */}
                  {player.bio.draftYear && player.bio.draftTeam && (
                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-6">
                      <div className="flex items-center gap-4">
                        <img
                          src={`https://assets.nhle.com/logos/nhl/svg/${player.bio.draftTeam}_light.svg`}
                          alt={player.bio.draftTeam}
                          className="w-16 h-16"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="flex-1">
                          <div className="text-sm text-amber-400 font-semibold mb-1">
                            {player.bio.draftYear} NHL Draft
                          </div>
                          <div className="text-2xl font-bold text-white mb-1">
                            {player.bio.draftRound && player.bio.draftPickInRound
                              ? `Round ${player.bio.draftRound}, Pick ${player.bio.draftPickInRound}`
                              : player.bio.draftOverallPick
                              ? `${player.bio.draftOverallPick}${player.bio.draftOverallPick === 1 ? 'st' : player.bio.draftOverallPick === 2 ? 'nd' : player.bio.draftOverallPick === 3 ? 'rd' : 'th'} Overall`
                              : 'Drafted'}
                          </div>
                          {player.bio.draftOverallPick && (
                            <div className="text-slate-400">
                              {player.bio.draftOverallPick === 1 ? '1st Overall Pick' : `Overall Pick #${player.bio.draftOverallPick}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Birth Info */}
                  {(player.bio.birthDate || player.bio.birthCity || player.bio.birthCountry) && (
                    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-white mb-4">Birth Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {player.bio.birthDate && (
                          <div>
                            <div className="text-slate-400 text-sm mb-1">Date of Birth</div>
                            <div className="text-white font-medium">
                              {new Date(player.bio.birthDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="text-slate-500 text-sm mt-1">
                              Age {Math.floor((new Date().getTime() - new Date(player.bio.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}
                            </div>
                          </div>
                        )}

                        {(player.bio.birthCity || player.bio.birthStateProvince || player.bio.birthCountry) && (
                          <div>
                            <div className="text-slate-400 text-sm mb-1">Birthplace</div>
                            <div className="text-white font-medium">
                              {[player.bio.birthCity, player.bio.birthStateProvince, player.bio.birthCountry]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Physical Stats */}
                  {(player.bio.heightInInches || player.bio.weightInPounds) && (
                    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-white mb-4">Physical Stats</h4>
                      <div className="space-y-4">
                        {player.bio.heightInInches && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-slate-400 text-sm">Height</span>
                              <span className="text-white font-bold">
                                {Math.floor(player.bio.heightInInches / 12)}'{player.bio.heightInInches % 12}"
                                <span className="text-slate-400 text-sm ml-2">
                                  ({Math.round(player.bio.heightInInches * 2.54)} cm)
                                </span>
                              </span>
                            </div>
                            <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, ((player.bio.heightInInches - 60) / 24) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                              <span>5'0"</span>
                              <span>7'0"</span>
                            </div>
                          </div>
                        )}

                        {player.bio.weightInPounds && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-slate-400 text-sm">Weight</span>
                              <span className="text-white font-bold">
                                {player.bio.weightInPounds} lbs
                                <span className="text-slate-400 text-sm ml-2">
                                  ({Math.round(player.bio.weightInPounds * 0.453592)} kg)
                                </span>
                              </span>
                            </div>
                            <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                style={{ width: `${Math.min(100, ((player.bio.weightInPounds - 140) / 120) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                              <span>140 lbs</span>
                              <span>260 lbs</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg mb-2">No Bio Data Available</p>
                  <p className="text-slate-500 text-sm">
                    Player biographical information will be available after the next data sync.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
interface OverviewTabProps {
  player: RosterPlayer;
  projection?: PlayerProjection;
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  sosInfo: { label: string; color: string; dotColor: string };
  isHot: boolean;
  isCold: boolean;
  trendPercent: number;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  player,
  projection,
  seasonFppg,
  last30Fppg,
  last7Fppg,
  sosInfo,
  isHot,
  isCold,
  trendPercent,
}) => {
  return (
    <div className="space-y-6">
      {/* Projection Summary */}
      {projection && (
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Window Projection
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-white">{projection.projectedPoints.toFixed(1)}</span>
              <span className="text-sm text-slate-400">Projected Points</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-white">{projection.gamesAvailable}</span>
              <span className="text-sm text-slate-400">Games Available</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-white">{projection.starts}</span>
              <span className="text-sm text-slate-400">Projected Starts</span>
            </div>
            <div className="flex flex-col">
              <span className={`text-3xl font-bold ${sosInfo.color}`}>{sosInfo.label}</span>
              <span className="text-sm text-slate-400">Schedule (SoS {projection.strengthOfSchedule}/10)</span>
            </div>
          </div>
          {projection.offNightRate > 0 && (
            <div className="mt-4 flex items-center gap-2 text-purple-300">
              <Moon className="w-4 h-4" />
              <span className="text-sm">
                {Math.round(projection.offNightRate * 100)}% of games are off-nights ({Math.round(projection.gamesAvailable * projection.offNightRate)} games)
              </span>
            </div>
          )}
        </div>
      )}

      {/* FPPG Timeline */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Fantasy Points Per Game</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Season */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Season Average</div>
            <div className="text-3xl font-bold text-white">{seasonFppg.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">{player.games_played} GP</div>
          </div>

          {/* Last 30 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Last 30 Days</div>
            <div className="text-3xl font-bold text-white">{last30Fppg.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">
              {last30Fppg > seasonFppg ? (
                <span className="text-green-400">↑ {((last30Fppg - seasonFppg) / seasonFppg * 100).toFixed(0)}%</span>
              ) : (
                <span className="text-red-400">↓ {((seasonFppg - last30Fppg) / seasonFppg * 100).toFixed(0)}%</span>
              )}
            </div>
          </div>

          {/* Last 7 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Last 7 Days</div>
            <div className="text-3xl font-bold text-white">{last7Fppg.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {isHot && <Flame className="w-3 h-3 text-orange-400" />}
              {isCold && <Snowflake className="w-3 h-3 text-blue-400" />}
              {isHot && <span className="text-orange-400">+{trendPercent}%</span>}
              {isCold && <span className="text-blue-400">{trendPercent}%</span>}
              {!isHot && !isCold && <span className="text-slate-400">Steady</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Key Stats (Season)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {player.stats.goals !== undefined && (
            <StatCard label="Goals" value={player.stats.goals} perGame={player.stats.goals / player.games_played} />
          )}
          {player.stats.assists !== undefined && (
            <StatCard label="Assists" value={player.stats.assists} perGame={player.stats.assists / player.games_played} />
          )}
          {player.stats.shots_on_goal !== undefined && (
            <StatCard label="Shots" value={player.stats.shots_on_goal} perGame={player.stats.shots_on_goal / player.games_played} />
          )}
          {player.stats.blocks !== undefined && (
            <StatCard label="Blocks" value={player.stats.blocks} perGame={player.stats.blocks / player.games_played} />
          )}
          {player.stats.hits !== undefined && player.stats.hits > 0 && (
            <StatCard label="Hits" value={player.stats.hits} perGame={player.stats.hits / player.games_played} />
          )}
          {player.stats.power_play_points !== undefined && (
            <StatCard label="PPP" value={player.stats.power_play_points} perGame={player.stats.power_play_points / player.games_played} />
          )}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  perGame: number;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, perGame }) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
    <div className="text-xs text-slate-400 mb-1">{label}</div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-sm text-slate-500">({perGame.toFixed(1)}/GP)</span>
    </div>
  </div>
);

// Stats Tab Component
interface StatsTabProps {
  player: RosterPlayer;
  leagueProfile: LeagueProfile;
}

const StatsTab: React.FC<StatsTabProps> = ({ player, leagueProfile }) => {
  const isGoalie = player.positions.includes('G');
  const gp = player.games_played || 1; // Avoid division by zero

  // Helper to safely get stat value
  const getStat = (stat: any) => (typeof stat === 'number' ? stat : 0);

  // Helper to format time on ice from seconds to MM:SS
  const formatToi = (seconds: number | string) => {
    if (!seconds || seconds === 0) return '—';
    const totalSeconds = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
    if (isNaN(totalSeconds)) return '—';

    const minutes = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate goalie stats if missing
  const getGoalieSavePct = () => {
    const savePct = getStat((player.stats as any).save_percentage);
    if (savePct > 0) return savePct;

    // Calculate from shots against and goals against
    const shotsAgainst = getStat((player.stats as any).shots_against);
    const goalsAgainst = getStat((player.stats as any).goals_against);
    if (shotsAgainst > 0) {
      const saves = shotsAgainst - goalsAgainst;
      return saves / shotsAgainst;
    }
    return 0;
  };

  const getGoalieGAA = () => {
    const gaa = getStat((player.stats as any).goals_against_average);
    if (gaa > 0) return gaa;

    // Estimate GAA from goals against and games played
    // Standard GAA calculation is (Goals Against * 60) / Minutes Played
    // As approximation, use (Goals Against / Games Played) assuming ~60 min per game
    const goalsAgainst = getStat((player.stats as any).goals_against);
    if (gp > 0) {
      return goalsAgainst / gp;
    }
    return 0;
  };

  const getGoalieSaves = () => {
    const saves = getStat((player.stats as any).saves);
    if (saves > 0) return saves;

    // Calculate from shots against and goals against
    const shotsAgainst = getStat((player.stats as any).shots_against);
    const goalsAgainst = getStat((player.stats as any).goals_against);
    return shotsAgainst - goalsAgainst;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white mb-4">Comprehensive Statistics</h3>

      {!isGoalie ? (
        <>
          {/* Skater Stats Table */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Statistic</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Total</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Per Game</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {/* Games Played */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Games Played</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{gp}</td>
                    <td className="text-right py-3 px-4 text-slate-400">—</td>
                  </tr>

                  {/* Scoring */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Goals</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.goals)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.goals) / gp).toFixed(2)}</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Assists</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.assists)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.assists) / gp).toFixed(2)}</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 bg-cyan-500/10">
                    <td className="py-3 px-4 text-slate-200 font-semibold">Points</td>
                    <td className="text-right py-3 px-4 text-cyan-400 font-bold">
                      {getStat(player.stats.goals) + getStat(player.stats.assists)}
                    </td>
                    <td className="text-right py-3 px-4 text-cyan-300">
                      {((getStat(player.stats.goals) + getStat(player.stats.assists)) / gp).toFixed(2)}
                    </td>
                  </tr>

                  {/* Plus/Minus */}
                  {(getStat((player.stats as any).plus_minus) !== 0 || (player.stats as any).plus_minus !== undefined) && (
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200">Plus/Minus</td>
                      <td className="text-right py-3 px-4 text-white font-semibold">
                        {getStat((player.stats as any).plus_minus) > 0 && '+'}
                        {getStat((player.stats as any).plus_minus)}
                      </td>
                      <td className="text-right py-3 px-4 text-slate-400">—</td>
                    </tr>
                  )}

                  {/* Shooting */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Shots on Goal</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.shots_on_goal)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.shots_on_goal) / gp).toFixed(2)}</td>
                  </tr>
                  {(getStat((player.stats as any).shooting_percentage) > 0 || (player.stats as any).shooting_percentage !== undefined) && (
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200">Shooting %</td>
                      <td className="text-right py-3 px-4 text-white font-semibold">
                        {getStat((player.stats as any).shooting_percentage).toFixed(1)}%
                      </td>
                      <td className="text-right py-3 px-4 text-slate-400">—</td>
                    </tr>
                  )}

                  {/* Power Play */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Power Play Points</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.power_play_points)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.power_play_points) / gp).toFixed(2)}</td>
                  </tr>
                  {getStat((player.stats as any).powerplay_goals) > 0 && (
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200 pl-8">PP Goals</td>
                      <td className="text-right py-3 px-4 text-slate-300">{getStat((player.stats as any).powerplay_goals)}</td>
                      <td className="text-right py-3 px-4 text-slate-400">{(getStat((player.stats as any).powerplay_goals) / gp).toFixed(2)}</td>
                    </tr>
                  )}
                  {getStat((player.stats as any).powerplay_assists) > 0 && (
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200 pl-8">PP Assists</td>
                      <td className="text-right py-3 px-4 text-slate-300">{getStat((player.stats as any).powerplay_assists)}</td>
                      <td className="text-right py-3 px-4 text-slate-400">{(getStat((player.stats as any).powerplay_assists) / gp).toFixed(2)}</td>
                    </tr>
                  )}

                  {/* Shorthanded */}
                  {(getStat(player.stats.shorthanded_goals) > 0 || getStat(player.stats.shorthanded_assists) > 0) && (
                    <>
                      <tr className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-slate-200">Shorthanded Goals</td>
                        <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.shorthanded_goals)}</td>
                        <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.shorthanded_goals) / gp).toFixed(2)}</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-slate-200">Shorthanded Assists</td>
                        <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.shorthanded_assists)}</td>
                        <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.shorthanded_assists) / gp).toFixed(2)}</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-slate-200">Shorthanded Points</td>
                        <td className="text-right py-3 px-4 text-white font-semibold">
                          {getStat(player.stats.shorthanded_goals) + getStat(player.stats.shorthanded_assists)}
                        </td>
                        <td className="text-right py-3 px-4 text-slate-400">
                          {((getStat(player.stats.shorthanded_goals) + getStat(player.stats.shorthanded_assists)) / gp).toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}

                  {/* Special Goals */}
                  {getStat(player.stats.game_winning_goals) > 0 && (
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200">Game Winning Goals</td>
                      <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.game_winning_goals)}</td>
                      <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.game_winning_goals) / gp).toFixed(2)}</td>
                    </tr>
                  )}

                  {/* Physical */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Blocks</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.blocks)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.blocks) / gp).toFixed(2)}</td>
                  </tr>
                  {getStat(player.stats.hits) > 0 && (
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200">Hits</td>
                      <td className="text-right py-3 px-4 text-white font-semibold">{getStat(player.stats.hits)}</td>
                      <td className="text-right py-3 px-4 text-slate-400">{(getStat(player.stats.hits) / gp).toFixed(2)}</td>
                    </tr>
                  )}

                  {/* Faceoffs (for centers) */}
                  {(getStat((player.stats as any).faceoff_wins) > 0 || getStat((player.stats as any).faceoff_percentage) > 0) && (
                    <>
                      {getStat((player.stats as any).faceoff_percentage) > 0 && (
                        <tr className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 text-slate-200">Faceoff Win %</td>
                          <td className="text-right py-3 px-4 text-white font-semibold">
                            {(getStat((player.stats as any).faceoff_percentage) * 100).toFixed(1)}%
                          </td>
                          <td className="text-right py-3 px-4 text-slate-400">—</td>
                        </tr>
                      )}
                      {getStat((player.stats as any).faceoff_wins) > 0 && (
                        <tr className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 text-slate-200 pl-8">Faceoff Wins</td>
                          <td className="text-right py-3 px-4 text-slate-300">{getStat((player.stats as any).faceoff_wins)}</td>
                          <td className="text-right py-3 px-4 text-slate-400">
                            {(getStat((player.stats as any).faceoff_wins) / gp).toFixed(1)}
                          </td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* Time on Ice */}
                  {(getStat((player.stats as any).time_on_ice) > 0 || (player.stats as any).time_on_ice) && (
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200">Avg Time on Ice</td>
                      <td className="text-right py-3 px-4 text-white font-semibold" colSpan={2}>
                        {formatToi((player.stats as any).time_on_ice)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fantasy Context */}
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
            <h4 className="text-sm font-bold text-purple-300 mb-2">Fantasy Context</h4>
            <p className="text-slate-300 text-sm">
              In your <span className="text-purple-400 font-semibold">{leagueProfile.league_name}</span> league
              {leagueProfile.scoring_type === 'points' && (
                <span> (Points Scoring)</span>
              )}
              {leagueProfile.scoring_type === 'categories' && (
                <span> (Category Scoring)</span>
              )}
              , this player is contributing across multiple categories.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Goalie Stats (if player is a goalie) */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Statistic</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Total</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Per Game</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {/* Games & Starts */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Games Played</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{gp}</td>
                    <td className="text-right py-3 px-4 text-slate-400">—</td>
                  </tr>
                  {getStat((player.stats as any).games_started) > 0 && (
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200">Games Started</td>
                      <td className="text-right py-3 px-4 text-white font-semibold">{getStat((player.stats as any).games_started)}</td>
                      <td className="text-right py-3 px-4 text-slate-400">—</td>
                    </tr>
                  )}

                  {/* Record */}
                  <tr className="hover:bg-slate-800/30 bg-green-500/10">
                    <td className="py-3 px-4 text-slate-200 font-semibold">Wins</td>
                    <td className="text-right py-3 px-4 text-green-400 font-bold">
                      {getStat((player.stats as any).wins)}
                    </td>
                    <td className="text-right py-3 px-4 text-green-300">
                      {(getStat((player.stats as any).wins) / gp).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Losses</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat((player.stats as any).losses)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">
                      {(getStat((player.stats as any).losses) / gp).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">OT Losses</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat((player.stats as any).overtime_losses)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">
                      {(getStat((player.stats as any).overtime_losses) / gp).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Record (W-L-OTL)</td>
                    <td className="text-right py-3 px-4 text-white font-semibold" colSpan={2}>
                      {getStat((player.stats as any).wins)}-
                      {getStat((player.stats as any).losses)}-
                      {getStat((player.stats as any).overtime_losses)}
                    </td>
                  </tr>

                  {/* Key Performance */}
                  <tr className="hover:bg-slate-800/30 bg-cyan-500/10">
                    <td className="py-3 px-4 text-slate-200 font-semibold">Save Percentage</td>
                    <td className="text-right py-3 px-4 text-cyan-400 font-bold">
                      {(getGoalieSavePct() * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 text-slate-400">—</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 bg-cyan-500/10">
                    <td className="py-3 px-4 text-slate-200 font-semibold">Goals Against Avg</td>
                    <td className="text-right py-3 px-4 text-cyan-400 font-bold">
                      {getGoalieGAA().toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4 text-slate-400">—</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Shutouts</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat((player.stats as any).shutouts)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">—</td>
                  </tr>

                  {/* Shot Metrics */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Saves</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getGoalieSaves()}</td>
                    <td className="text-right py-3 px-4 text-slate-400">
                      {(getGoalieSaves() / gp).toFixed(1)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Shots Against</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat((player.stats as any).shots_against)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">
                      {(getStat((player.stats as any).shots_against) / gp).toFixed(1)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-200">Goals Against</td>
                    <td className="text-right py-3 px-4 text-white font-semibold">{getStat((player.stats as any).goals_against)}</td>
                    <td className="text-right py-3 px-4 text-slate-400">
                      {(getStat((player.stats as any).goals_against) / gp).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Fantasy Context for Goalies */}
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
            <h4 className="text-sm font-bold text-purple-300 mb-2">Fantasy Context</h4>
            <p className="text-slate-300 text-sm">
              In your <span className="text-purple-400 font-semibold">{leagueProfile.league_name}</span> league
              {leagueProfile.scoring_type === 'points' && (
                <span> (Points Scoring)</span>
              )}
              {leagueProfile.scoring_type === 'categories' && (
                <span> (Category Scoring)</span>
              )}
              , this goalie's performance across wins, saves, and ratios contributes to your team's success.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// Schedule Tab Component
interface ScheduleTabProps {
  player: RosterPlayer;
  projection?: PlayerProjection;
  timeWindow: TimeWindowState;
}

const ScheduleTab: React.FC<ScheduleTabProps> = ({ player, projection, timeWindow }) => {
  const [scheduleData, setScheduleData] = useState<{
    gamesAvailable: number;
    gamesByDate: Record<string, any>;
  } | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Fetch schedule data if projection is not available
  useEffect(() => {
    const fetchSchedule = async () => {
      if (projection?.gamesByDate) {
        // Already have schedule data from projection
        return;
      }

      setIsLoadingSchedule(true);
      try {
        const { apiService } = await import('../services/api');
        const data = await apiService.getPlayerSchedule(player.team, {
          start: timeWindow.config.startUtc,
          end: timeWindow.config.endUtc
        });
        setScheduleData(data);
      } catch (err) {
        console.error('Failed to fetch player schedule:', err);
      } finally {
        setIsLoadingSchedule(false);
      }
    };

    fetchSchedule();
  }, [player.team, timeWindow.config.startUtc, timeWindow.config.endUtc, projection?.gamesByDate]);
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Get game schedule from projection's gamesByDate (includes opponent, home/away, GAA)
  // Fallback to startsByDate if gamesByDate is not available
  // If neither available, use fetched scheduleData
  const gameSchedule = projection?.gamesByDate
    ? Object.entries(projection.gamesByDate)
        .map(([date, gameDetail]) => ({
          date,
          opponent: gameDetail.opponent,
          isHome: gameDetail.isHome,
          isOffNight: gameDetail.isOffNight,
          opponentGaPer60: gameDetail.opponentGaPer60,
          starts: projection.startsByDate?.[date] ?? 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : projection?.startsByDate
    ? Object.entries(projection.startsByDate)
        .filter(([_, starts]) => starts > 0)
        .map(([date, starts]) => ({
          date,
          opponent: undefined, // Not available in fallback mode
          isHome: undefined,
          isOffNight: false,
          opponentGaPer60: undefined,
          starts,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : scheduleData?.gamesByDate
    ? Object.entries(scheduleData.gamesByDate)
        .map(([date, gameDetail]) => ({
          date,
          opponent: gameDetail.opponent,
          isHome: gameDetail.isHome,
          isOffNight: gameDetail.isOffNight,
          opponentGaPer60: gameDetail.opponentGaPer60,
          starts: 1, // Assume player starts in all games for non-roster players
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  console.log('PlayerDetailModal Schedule Debug:', {
    hasGamesByDate: !!projection?.gamesByDate,
    hasStartsByDate: !!projection?.startsByDate,
    gameScheduleLength: gameSchedule.length,
    gamesByDateKeys: projection?.gamesByDate ? Object.keys(projection.gamesByDate).length : 0,
    startsByDateKeys: projection?.startsByDate ? Object.keys(projection.startsByDate).length : 0,
  });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white mb-4">Schedule Information</h3>

      {/* Window Summary */}
      {(projection || scheduleData) && !isLoadingSchedule && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Total Games</div>
            <div className="text-3xl font-bold text-white">
              {projection?.gamesAvailable ?? scheduleData?.gamesAvailable ?? 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              In selected window
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Projected Starts</div>
            <div className="text-3xl font-bold text-cyan-400">
              {projection?.starts ?? scheduleData?.gamesAvailable ?? 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Expected active games
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Off-Nights</div>
            <div className="text-3xl font-bold text-purple-400">
              {projection
                ? Math.round(projection.gamesAvailable * projection.offNightRate)
                : scheduleData
                ? Object.values(scheduleData.gamesByDate).filter((g: any) => g.isOffNight).length
                : 0}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Moon className="w-3 h-3" />
              {projection
                ? `${Math.round(projection.offNightRate * 100)}% of games`
                : scheduleData
                ? `${Math.round((Object.values(scheduleData.gamesByDate).filter((g: any) => g.isOffNight).length / (scheduleData.gamesAvailable || 1)) * 100)}% of games`
                : '0% of games'}
            </div>
          </div>
        </div>
      )}

      {isLoadingSchedule && (
        <div className="text-center py-8 text-slate-400">
          Loading schedule data...
        </div>
      )}

      {/* Calendar View of Games */}
      {gameSchedule.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            Upcoming Games
          </h4>
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {gameSchedule.map((game, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:border-cyan-500/40 ${
                    game.isOffNight
                      ? 'bg-purple-500/10 border-purple-500/30'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Date */}
                    <div className="flex flex-col items-center justify-center bg-slate-800/80 rounded-lg px-3 py-2 min-w-[80px]">
                      <div className="text-xs text-slate-400 uppercase">{getDayOfWeek(game.date)}</div>
                      <div className="text-lg font-bold text-white">{new Date(game.date).getDate()}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(game.date).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    </div>

                    {/* Team Logos and Matchup */}
                    <div className="flex items-center gap-2">
                      {/* Player's Team Logo */}
                      <div className="flex flex-col items-center">
                        <img
                          src={getTeamLogoUrl(player.team)}
                          alt={player.team}
                          className="w-10 h-10 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span className="text-xs font-semibold text-white mt-1">{player.team}</span>
                      </div>

                      {/* vs / @ */}
                      <span className="text-slate-400 font-bold text-sm px-1">
                        {game.isHome ? 'vs' : '@'}
                      </span>

                      {/* Opponent Logo */}
                      <div className="flex flex-col items-center">
                        <img
                          src={getTeamLogoUrl(game.opponent)}
                          alt={game.opponent}
                          className="w-10 h-10 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span className="text-xs font-semibold text-white mt-1">{game.opponent}</span>
                      </div>
                    </div>

                    {/* Game Info */}
                    <div className="flex flex-col ml-2">
                      <div className="text-sm font-semibold text-white">
                        {game.isHome ? 'Home' : 'Away'} Game
                      </div>
                      {game.opponentGaPer60 && (
                        <div className="text-xs text-slate-400">
                          Opp GAA: {game.opponentGaPer60.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2">
                    {game.isOffNight && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-400/40">
                        <Moon className="w-3 h-3 text-purple-400" />
                        <span className="text-xs text-purple-300 font-semibold">Off-Night</span>
                      </div>
                    )}
                    {game.starts > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40">
                        <Activity className="w-3 h-3 text-cyan-400" />
                        <span className="text-xs text-cyan-300 font-semibold">Start</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Details */}
      <div>
        <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-400" />
          Window Details
        </h4>

        <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Time Window:</span>
            <span className="text-white font-semibold text-sm">
              {formatDate(timeWindow.config.startUtc)} - {formatDate(timeWindow.config.endUtc)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Mode:</span>
            <span className="text-cyan-400 font-semibold text-sm capitalize">
              {timeWindow.mode.replace('-', ' ')}
            </span>
          </div>

          {projection && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Strength of Schedule:</span>
                <span className={`font-semibold text-sm ${
                  projection.strengthOfSchedule >= 7 ? 'text-green-400' :
                  projection.strengthOfSchedule <= 3 ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {projection.strengthOfSchedule.toFixed(1)}/10
                  {projection.strengthOfSchedule >= 7 && ' (Easy)'}
                  {projection.strengthOfSchedule <= 3 && ' (Tough)'}
                  {projection.strengthOfSchedule > 3 && projection.strengthOfSchedule < 7 && ' (Moderate)'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-slate-400 text-sm">Projected Total Points:</span>
                <span className="text-cyan-400 font-bold text-lg">
                  {projection.projectedPoints.toFixed(1)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Schedule Note */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          <strong className="text-blue-300">Note:</strong> Schedule projections are based on the current time window and
          the team's ({player.team}) scheduled games. Off-night percentage indicates games when fewer teams are playing,
          potentially offering streaming advantages.
        </p>
      </div>
    </div>
  );
};

// Trends Tab Component
interface TrendsTabProps {
  player: RosterPlayer;
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  isHot: boolean;
  isCold: boolean;
  trendPercent: number;
}

const TrendsTab: React.FC<TrendsTabProps> = ({
  player,
  seasonFppg,
  last30Fppg,
  last7Fppg,
  isHot,
  isCold,
  trendPercent,
}) => {
  // Calculate additional trend metrics
  const last30vsSeasonChange = seasonFppg > 0 ? ((last30Fppg - seasonFppg) / seasonFppg) * 100 : 0;
  const last7vsLast30Change = last30Fppg > 0 ? ((last7Fppg - last30Fppg) / last30Fppg) * 100 : 0;

  // Determine trend status
  const getTrendStatus = () => {
    if (isHot) return {
      label: 'Hot Streak',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/40',
      icon: Flame
    };
    if (isCold) return {
      label: 'Cold Streak',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/40',
      icon: Snowflake
    };
    return {
      label: 'Steady Performance',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-500/40',
      icon: TrendingUp
    };
  };

  const trendStatus = getTrendStatus();
  const TrendIcon = trendStatus.icon;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white mb-4">Performance Trends</h3>

      {/* Current Trend Status */}
      <div className={`${trendStatus.bgColor} border ${trendStatus.borderColor} rounded-xl p-6`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full ${trendStatus.bgColor} border-2 ${trendStatus.borderColor} flex items-center justify-center`}>
            <TrendIcon className={`w-8 h-8 ${trendStatus.color}`} />
          </div>
          <div className="flex-1">
            <h4 className={`text-xl font-bold ${trendStatus.color} mb-1`}>{trendStatus.label}</h4>
            <p className="text-slate-300 text-sm">
              {isHot && `${player.full_name} is performing ${Math.abs(trendPercent)}% above their season average over the last 7 days.`}
              {isCold && `${player.full_name} is performing ${Math.abs(trendPercent)}% below their season average over the last 7 days.`}
              {!isHot && !isCold && `${player.full_name} is maintaining consistent performance close to their season average.`}
            </p>
          </div>
        </div>
      </div>

      {/* FPPG Trend Comparison */}
      <div>
        <h4 className="text-md font-semibold text-white mb-3">FPPG Trend Analysis</h4>
        <div className="space-y-3">
          {/* Season to Last 30 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm">Season → Last 30 Days</span>
              <span className={`font-semibold text-sm ${
                last30vsSeasonChange > 5 ? 'text-green-400' :
                last30vsSeasonChange < -5 ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {last30vsSeasonChange > 0 ? '+' : ''}{last30vsSeasonChange.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    last30vsSeasonChange > 5 ? 'bg-green-400' :
                    last30vsSeasonChange < -5 ? 'bg-red-400' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${Math.min(Math.abs(last30vsSeasonChange) * 2, 100)}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 w-24 text-right">
                {seasonFppg.toFixed(2)} → {last30Fppg.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Last 30 to Last 7 */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm">Last 30 → Last 7 Days</span>
              <span className={`font-semibold text-sm ${
                last7vsLast30Change > 5 ? 'text-green-400' :
                last7vsLast30Change < -5 ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {last7vsLast30Change > 0 ? '+' : ''}{last7vsLast30Change.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    last7vsLast30Change > 5 ? 'bg-green-400' :
                    last7vsLast30Change < -5 ? 'bg-red-400' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${Math.min(Math.abs(last7vsLast30Change) * 2, 100)}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 w-24 text-right">
                {last30Fppg.toFixed(2)} → {last7Fppg.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Season to Last 7 (Overall) */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm font-semibold">Season → Last 7 Days (Overall)</span>
              <span className={`font-bold text-sm ${
                trendPercent > 10 ? 'text-orange-400' :
                trendPercent < -10 ? 'text-blue-400' :
                'text-gray-400'
              }`}>
                {trendPercent > 0 ? '+' : ''}{trendPercent}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    trendPercent > 10 ? 'bg-orange-400' :
                    trendPercent < -10 ? 'bg-blue-400' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${Math.min(Math.abs(trendPercent) * 2, 100)}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 w-24 text-right">
                {seasonFppg.toFixed(2)} → {last7Fppg.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Insight */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg p-4">
        <h4 className="text-sm font-bold text-cyan-300 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Performance Insight
        </h4>
        <p className="text-slate-300 text-sm">
          {isHot && (
            <>
              <strong className="text-orange-400">{player.full_name}</strong> is currently on a hot streak,
              outperforming their season average. This could be a good time to maximize their usage or consider
              them for trade value.
            </>
          )}
          {isCold && (
            <>
              <strong className="text-blue-400">{player.full_name}</strong> is experiencing a cold stretch.
              Monitor closely - this could be temporary variance or a sign of decreased role/ice time.
            </>
          )}
          {!isHot && !isCold && (
            <>
              <strong className="text-gray-300">{player.full_name}</strong> is maintaining steady production
              consistent with their season averages. This consistency makes them a reliable fantasy asset.
            </>
          )}
        </p>
      </div>

      {/* Position Context */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Context</h4>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Position:</span>
            <span className="font-semibold">{player.positions.join('/')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Team:</span>
            <span className="font-semibold">{player.team}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Games Played:</span>
            <span className="font-semibold">{player.games_played}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
