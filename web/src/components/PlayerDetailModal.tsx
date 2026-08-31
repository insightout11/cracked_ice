// @ts-nocheck
import { TooltipLabel } from './ui/tooltip';
import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { X, Calendar, Rocket, Moon, Flame, Snowflake, TrendingUp, Target, Zap, Activity, BarChart3, GitCompare, User } from 'lucide-react';
import type { RosterPlayer, PlayerProjection, LeagueProfile } from '../lib/coachSchemas';
import type { TeamTierData } from '../types/teamTiers';
import type { TimeWindowState } from '../types/timeWindow';
import { getTeamLogoUrl, getTeamColor } from '../lib/teamLogos';
import { buildFallbackIceRating } from '../lib/iceRating';
import { CareerTrendChart } from './charts/CareerTrendChart';
import { CareerSummaryCard } from './player/CareerSummaryCard';
import { InjuryBadge } from './player/InjuryBadge';
import { GoalsAssistsSplitChart } from './charts/GoalsAssistsSplitChart';
import { GamesPlayedTrendChart } from './charts/GamesPlayedTrendChart';
import { ConsistencyMetricChart } from './charts/ConsistencyMetricChart';
import { GoalieSavePercentageTrendChart } from './charts/GoalieSavePercentageTrendChart';
import { GoalieGAATrendChart } from './charts/GoalieGAATrendChart';
import { GoalieWinsShutoutsChart } from './charts/GoalieWinsShutoutsChart';
import { AdvancedStatsTab } from './player/AdvancedStatsTab';
import { GameLogTab } from './player/GameLogTab';
import { IceRatingBadge, IceRatingGauge } from './player-detail/IceRatingGauge';
import { PlayerFormChart } from './player-detail/PlayerFormChart';
import { PlayerScheduleStrip } from './player-detail/PlayerScheduleStrip';
import { ScoringContributionBar } from './player-detail/ScoringContributionBar';
import { GoalieSeasonSummary } from './player-detail/GoalieSeasonSummary';
import { PlayerDataContext, performanceSeasonLabel } from './player-detail/PlayerDataContext';
import { goalieStatView } from '../lib/goalieStats';
import { mugshotSeason, SEASON_LABEL } from '../lib/season';

interface DraftProfileContext {
  crackedIceRank?: number;
  yahooAdp?: number;
  valueVsAdp?: number;
  draftScore: number;
  projectedFppg: number;
  valueOverReplacement: number;
  replacementFppg: number;
  replacementPosition: string | null;
  playoffStarts: number;
  tier?: string;
  projectionLabel?: string;
}

interface PlayerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: RosterPlayer;
  projection?: PlayerProjection;
  teamTier?: TeamTierData;
  timeWindow: TimeWindowState;
  leagueProfile: LeagueProfile;
  draftContext?: DraftProfileContext;
  onCompare?: () => void;
  footerActions?: ReactNode;
}

type TabType = 'fantasy' | 'form' | 'games' | 'career';

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  isOpen,
  onClose,
  player,
  projection,
  teamTier,
  timeWindow,
  leagueProfile,
  draftContext,
  onCompare,
  footerActions,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('fantasy');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const selectTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsHeaderCollapsed(false);
    contentRef.current?.scrollTo({ top: 0 });
  };

  // Reset to the primary decision view when player changes
  useEffect(() => {
    setActiveTab('fantasy');
    setIsHeaderCollapsed(false);
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
    return `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${team}/${numericId}.png`;
  };
  const headshotUrl = getHeadshotUrl(player.id, player.team);

  // Calculate FPPG metrics
  const seasonFppg = projection?.fppg ?? player.seasonFppg ?? 0;
  const last30Fppg = projection?.last30Fppg ?? player.last30Fppg ?? 0;
  const last7Fppg = projection?.last7Fppg ?? player.last7Fppg ?? 0;
  const recentGameCount = (days: number) => {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return player.gameLog?.filter((game) => new Date(game.gameDate).getTime() >= cutoff).length ?? 0;
  };
  const hasLast30Sample = recentGameCount(30) > 0;
  const hasLast7Sample = recentGameCount(7) > 0;
  const performanceSeason = performanceSeasonLabel(player.statsSeason);
  const iceRating = buildFallbackIceRating(player, projection);

  // Determine hot/cold streak
  const isHot = hasLast7Sample && last7Fppg > seasonFppg && seasonFppg > 0;
  const isCold = hasLast7Sample && last7Fppg < seasonFppg * 0.8 && seasonFppg > 0;
  const trendPercent = hasLast7Sample && seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;

  // SoS info
  const getSosInfo = (sos?: number): { label: string; color: string; dotColor: string } => {
    if (sos === undefined) return { label: 'N/A', color: 'text-ink-dim', dotColor: 'bg-surface-2' };
    if (sos >= 7) return { label: 'Easy', color: 'text-positive', dotColor: 'bg-positive' };
    if (sos <= 3) return { label: 'Tough', color: 'text-negative', dotColor: 'bg-negative' };
    return { label: 'Moderate', color: 'text-ink-dim', dotColor: 'bg-surface-2' };
  };
  const sosInfo = getSosInfo(projection?.strengthOfSchedule);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-surface-glass backdrop-blur-sm sm:items-center sm:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-title"
    >
      <div className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-surface-1 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-line-strong">
        {/* Header */}
        <div className={`relative border-b border-line bg-surface-2 transition-[padding] ${isHeaderCollapsed ? 'p-2 sm:p-6' : 'p-4 sm:p-6'}`}>
          {/* Team color accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ backgroundColor: teamColor }}
          />

          {/* Action buttons */}
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1 sm:right-4 sm:top-4 sm:gap-2">
            {/* Compare button */}
            {onCompare && (
              <TooltipLabel label='Compare with another player'><button
                  onClick={onCompare}
                  className="hidden rounded-lg p-2 text-ink-dim transition-colors hover:bg-surface-2 hover:text-accent sm:inline-flex"
                  aria-label="Compare player">
                  <GitCompare className="w-5 h-5" />
                </button></TooltipLabel>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-2 transition-colors text-ink-dim hover:text-ink"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-3 pr-10 sm:items-start sm:gap-6 sm:pr-12">
            {/* Left: Player image and identity */}
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              {/* Headshot */}
              <div className="relative flex-shrink-0">
                <img
                  src={headshotUrl}
                  alt={player.full_name}
                  className={`${isHeaderCollapsed ? 'h-10 w-10' : 'h-14 w-14'} rounded-full border-2 border-line bg-surface-2 object-cover transition-[width,height] sm:h-20 sm:w-20`}
                  onError={(e) => {
                    e.currentTarget.src = '/player-placeholder.png';
                  }}
                />
                {/* Team logo overlay */}
                <img
                  src={teamLogo}
                  alt={player.team}
                  className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full border border-line bg-surface-1/10 p-0.5 sm:h-8 sm:w-8 ${isHeaderCollapsed ? 'max-sm:hidden' : ''}`}
                />
              </div>

              {/* Player info */}
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 id="player-detail-title" className={`break-words pr-1 font-bold leading-tight text-ink sm:text-2xl ${isHeaderCollapsed ? 'text-base' : 'text-xl'}`}>
                  {player.full_name}
                </h2>
                <div className={`mt-1 flex items-center gap-2 ${isHeaderCollapsed ? 'max-sm:hidden' : ''}`}>
                  <span className="text-accent font-semibold">{player.team}</span>
                  <span className="text-ink-dim">•</span>
                  <span className="text-ink-dim">{positions}</span>
                  {(player.injuryStatus || player.isActive !== undefined) && (
                    <>
                      <span className="text-ink-dim">•</span>
                      <InjuryBadge
                        injuryStatus={player.injuryStatus}
                        isActive={player.isActive}
                        size="lg"
                      />
                    </>
                  )}
                </div>
                {player.current_slot && (
                  <div className={`mt-1 text-xs text-ink-dim ${isHeaderCollapsed ? 'max-sm:hidden' : ''}`}>
                    Current Slot: <span className="text-accent font-semibold">{player.current_slot}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: ICE Score and stats snapshot */}
            <div className="ml-auto flex flex-shrink-0 items-center gap-3 sm:gap-6">
              {/* Hot/Cold Indicator */}
              {(isHot || isCold) && (
                <div className="hidden flex-col items-center sm:flex">
                  {isHot ? (
                    <>
                      <Flame className="w-6 h-6 text-warning" />
                      <span className="text-xs text-warning font-semibold mt-1">Hot +{trendPercent}%</span>
                    </>
                  ) : (
                    <>
                      <Snowflake className="w-6 h-6 text-accent" />
                      <span className="text-xs text-accent font-semibold mt-1">Cold {trendPercent}%</span>
                    </>
                  )}
                </div>
              )}

              <div className="sm:hidden"><IceRatingBadge rating={iceRating} size="sm" /></div>
              <div className="hidden sm:block"><IceRatingBadge rating={iceRating} /></div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        {/* Four fixed tabs share the width instead of scrolling, so none clip. */}
        <div className="flex border-b border-line bg-surface-0/70 px-2 sm:px-6">
          {[
            { id: 'fantasy', label: 'Fantasy', icon: Target },
            { id: 'form', label: 'Form & Role', icon: TrendingUp },
            { id: 'games', label: 'Games', icon: Calendar },
            { id: 'career', label: 'Career', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id as TabType)}
                className={`
                  flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap
                  px-1 py-2.5 text-xs font-semibold transition-all sm:gap-2 sm:px-4 sm:py-3 sm:text-sm
                  border-b-2
                  ${isActive
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-transparent text-ink-dim hover:bg-surface-2 hover:text-ink'
                  }
                `}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Area */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto bg-surface-1 p-3 sm:p-6"
          onScroll={(event) => {
            const nextCollapsed = event.currentTarget.scrollTop > 48;
            setIsHeaderCollapsed((current) => current === nextCollapsed ? current : nextCollapsed);
          }}
        >
          {draftContext && <DraftMarketStrip context={draftContext} />}
          {onCompare && (
            <button
              type="button"
              onClick={onCompare}
              className="mt-2 grid min-h-11 w-full grid-cols-[1rem_auto_1rem] items-center justify-center gap-2 rounded-lg border border-accent bg-accent-muted px-3 text-sm font-semibold text-accent sm:hidden"
            >
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              <span>Compare with another player</span>
              <span className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {activeTab === 'fantasy' && (
            <div className={`${draftContext ? 'mt-3' : ''} space-y-6`}>
              {draftContext && <DraftProfileSnapshot context={draftContext} />}
              <PlayerDataContext player={player} />
              <IceRatingGauge rating={iceRating} />
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
                hasLast30Sample={hasLast30Sample}
                hasLast7Sample={hasLast7Sample}
                performanceSeason={performanceSeason}
              />
              {isGoalie && <GoalieSeasonSummary player={player} />}
              <ScoringContributionBar player={player} leagueProfile={leagueProfile} />
              <details className="rounded-xl border border-line bg-surface-0 open:border-line-strong">
                <summary className="cursor-pointer px-5 py-4 font-semibold text-ink">Full season stat table</summary>
                <div className="border-t border-line p-5"><StatsTab player={player} leagueProfile={leagueProfile} /></div>
              </details>
            </div>
          )}

          {activeTab === 'form' && (
            <div className="space-y-6">
              <PlayerFormChart games={player.gameLog || []} leagueProfile={leagueProfile} isGoalie={isGoalie} />
              <TrendsTab
                player={player}
                seasonFppg={seasonFppg}
                last30Fppg={last30Fppg}
                last7Fppg={last7Fppg}
                isHot={isHot}
                isCold={isCold}
                trendPercent={trendPercent}
                hasLast30Sample={hasLast30Sample}
                hasLast7Sample={hasLast7Sample}
              />
              {/* PP/PK deployment and per-60 rates describe skater usage; a goalie
                  has none of it, so the section would only ever show blanks. */}
              {!isGoalie && (
                <details className="rounded-xl border border-line bg-surface-0 open:border-line-strong">
                  <summary className="cursor-pointer px-5 py-4 font-semibold text-ink">Advanced deployment and rate statistics</summary>
                  <div className="border-t border-line p-5"><AdvancedStatsTab advancedStats={player.advancedStats} positions={player.positions} /></div>
                </details>
              )}
            </div>
          )}

          {activeTab === 'games' && (
            <div className="space-y-6">
              {projection?.gamesByDate && Object.keys(projection.gamesByDate).length > 0 && (
                <PlayerScheduleStrip projection={projection} />
              )}
              <ScheduleTab player={player} projection={projection} timeWindow={timeWindow} />
              <div className="rounded-xl border border-line bg-surface-0 p-5">
                <GameLogTab games={player.gameLog || []} isGoalie={isGoalie} />
              </div>
            </div>
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
                  <BarChart3 className="w-16 h-16 text-ink-dim mx-auto mb-4" />
                  <p className="text-ink-dim text-lg mb-2">No Career Data Available</p>
                  <p className="text-ink-dim text-sm">
                    Career history will be available after the next data sync.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'career' && (
            <details className="mt-6 max-w-3xl rounded-xl border border-line bg-surface-0 open:border-line-strong">
              <summary className="cursor-pointer px-5 py-4 font-semibold text-ink">
                Player profile and biography
              </summary>
              <div className="space-y-6 border-t border-line p-5">
              {player.bio ? (
                <>
                  {/* Jersey Number & Basic Info */}
                  <div className="flex items-center gap-6">
                    {player.bio.sweaterNumber && (
                      <div className="min-w-[120px] rounded-lg border-2 border-line bg-surface-2 p-6 text-center">
                        <div className="text-4xl font-bold text-ink mb-1">#{player.bio.sweaterNumber}</div>
                        <div className="text-xs text-ink-dim uppercase tracking-wide">Jersey</div>
                      </div>
                    )}

                    {player.bio.shootsCatches && (
                      <div className="flex-1 bg-surface-2 border border-line rounded-lg p-4">
                        <div className="text-ink-dim text-sm mb-1">Shoots/Catches</div>
                        <div className="text-2xl font-bold text-accent">
                          {player.bio.shootsCatches === 'L' ? 'Left' : player.bio.shootsCatches === 'R' ? 'Right' : player.bio.shootsCatches}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Draft Card */}
                  {player.bio.draftYear && player.bio.draftTeam && (
                    <div className="rounded-lg border border-warning/40 bg-surface-1 p-6">
                      <div className="flex items-center gap-4">
                        <img
                          src={`https://assets.nhle.com/logos/nhl/svg/${player.bio.draftTeam}_light.svg`}
                          alt={player.bio.draftTeam}
                          className="w-16 h-16"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="flex-1">
                          <div className="text-sm text-warning font-semibold mb-1">
                            {player.bio.draftYear} NHL Draft
                          </div>
                          <div className="text-2xl font-bold text-ink mb-1">
                            {player.bio.draftRound && player.bio.draftPickInRound
                              ? `Round ${player.bio.draftRound}, Pick ${player.bio.draftPickInRound}`
                              : player.bio.draftOverallPick
                              ? `${player.bio.draftOverallPick}${player.bio.draftOverallPick === 1 ? 'st' : player.bio.draftOverallPick === 2 ? 'nd' : player.bio.draftOverallPick === 3 ? 'rd' : 'th'} Overall`
                              : 'Drafted'}
                          </div>
                          {player.bio.draftOverallPick && (
                            <div className="text-ink-dim">
                              {player.bio.draftOverallPick === 1 ? '1st Overall Pick' : `Overall Pick #${player.bio.draftOverallPick}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Birth Info */}
                  {(player.bio.birthDate || player.bio.birthCity || player.bio.birthCountry) && (
                    <div className="bg-surface-2 border border-line rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-ink mb-4">Birth Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {player.bio.birthDate && (
                          <div>
                            <div className="text-ink-dim text-sm mb-1">Date of Birth</div>
                            <div className="text-ink font-medium">
                              {new Date(player.bio.birthDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="text-ink-dim text-sm mt-1">
                              Age {Math.floor((new Date().getTime() - new Date(player.bio.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}
                            </div>
                          </div>
                        )}

                        {(player.bio.birthCity || player.bio.birthStateProvince || player.bio.birthCountry) && (
                          <div>
                            <div className="text-ink-dim text-sm mb-1">Birthplace</div>
                            <div className="text-ink font-medium">
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
                    <div className="bg-surface-2 border border-line rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-ink mb-4">Physical Stats</h4>
                      <div className="space-y-4">
                        {player.bio.heightInInches && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-ink-dim text-sm">Height</span>
                              <span className="text-ink font-bold">
                                {Math.floor(player.bio.heightInInches / 12)}'{player.bio.heightInInches % 12}"
                                <span className="text-ink-dim text-sm ml-2">
                                  ({Math.round(player.bio.heightInInches * 2.54)} cm)
                                </span>
                              </span>
                            </div>
                            <div className="relative h-2 bg-surface-2 rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-accent to-accent rounded-full"
                                style={{ width: `${Math.min(100, ((player.bio.heightInInches - 60) / 24) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-ink-dim mt-1">
                              <span>5'0"</span>
                              <span>7'0"</span>
                            </div>
                          </div>
                        )}

                        {player.bio.weightInPounds && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-ink-dim text-sm">Weight</span>
                              <span className="text-ink font-bold">
                                {player.bio.weightInPounds} lbs
                                <span className="text-ink-dim text-sm ml-2">
                                  ({Math.round(player.bio.weightInPounds * 0.453592)} kg)
                                </span>
                              </span>
                            </div>
                            <div className="relative h-2 bg-surface-2 rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-positive to-accent rounded-full"
                                style={{ width: `${Math.min(100, ((player.bio.weightInPounds - 140) / 120) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-ink-dim mt-1">
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
                  <User className="w-16 h-16 text-ink-dim mx-auto mb-4" />
                  <p className="text-ink-dim text-lg mb-2">No Bio Data Available</p>
                  <p className="text-ink-dim text-sm">
                    Player biographical information will be available after the next data sync.
                  </p>
                </div>
              )}
              </div>
            </details>
          )}
        </div>
        {footerActions && (
          <div className="shrink-0 border-t border-line bg-surface-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
};

function DraftProfileSnapshot({ context }: { context: DraftProfileContext }) {
  const metrics = [
    ['Draft score', context.draftScore.toFixed(1)],
    [`${context.projectionLabel ?? 'Cracked Ice'} projected FPPG`, context.projectedFppg.toFixed(2)],
    [`Above ${context.replacementPosition ?? 'replacement'}`, `${context.valueOverReplacement >= 0 ? '+' : ''}${context.valueOverReplacement.toFixed(2)} FPPG`],
    ['Playoff starts', String(context.playoffStarts)],
  ] as const;
  return <section className="rounded-xl border border-accent/40 bg-accent-muted p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent">Draft context</p><h3 className="mt-0.5 font-semibold text-ink">League-specific draft snapshot</h3></div>
      {context.tier && <span className="rounded-full border border-accent/50 bg-surface-1 px-2.5 py-1 text-xs font-semibold text-accent">{context.tier}</span>}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-lg border border-line bg-surface-1 p-3"><strong className="block font-mono text-lg text-ink">{value}</strong><span className="mt-1 block text-[10px] text-ink-mute">{label}</span></div>)}</div>
  </section>;
}

function DraftMarketStrip({ context }: { context: DraftProfileContext }) {
  const marketValue = context.valueVsAdp;
  const valueLabel = marketValue == null
    ? '—'
    : `${marketValue > 0 ? '+' : ''}${marketValue.toFixed(1)}`;
  const valueTone = marketValue == null
    ? 'text-ink-mute'
    : marketValue > 0
      ? 'text-positive'
      : marketValue < 0
        ? 'text-warning'
        : 'text-ink';

  return (
    <section aria-label="Draft market context" className="grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-surface-0">
      <DraftMarketMetric label="CI rank" value={context.crackedIceRank ? `#${context.crackedIceRank}` : '—'} />
      <DraftMarketMetric label="Yahoo ADP" value={context.yahooAdp?.toFixed(1) ?? '—'} />
      <DraftMarketMetric
        label="Value vs ADP"
        value={valueLabel}
        valueClassName={valueTone}
        explanation="Yahoo ADP minus Cracked Ice rank. Positive means Yahoo drafts the player later than Cracked Ice ranks him."
      />
    </section>
  );
}

function DraftMarketMetric({ label, value, valueClassName = 'text-ink', explanation }: { label: string; value: string; valueClassName?: string; explanation?: string }) {
  const content = (
    <>
      <strong className={`block truncate font-mono text-base sm:text-lg ${valueClassName}`}>{value}</strong>
      <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-wide text-ink-mute sm:text-[10px]">{label}</span>
    </>
  );

  const metricClassName = "min-w-0 border-r border-line px-2 py-2.5 text-center last:border-r-0 sm:px-4 sm:py-3";
  return explanation
    ? <TooltipLabel label={explanation}><button type="button" className={metricClassName} aria-label={`${label}: ${value}. ${explanation}`}>{content}</button></TooltipLabel>
    : <div className={metricClassName}>{content}</div>;
}

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
  hasLast30Sample: boolean;
  hasLast7Sample: boolean;
  performanceSeason: string;
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
  hasLast30Sample,
  hasLast7Sample,
  performanceSeason,
}) => {
  const isGoalie = player.positions.includes('G');
  return (
    <div className="space-y-6">
      {/* Projection Summary */}
      {projection && (
        <div className="relative overflow-hidden rounded-xl border border-accent-muted bg-surface-0 p-5 shadow-inner">
          <div className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 text-lg font-bold text-accent">
              <Rocket className="w-5 h-5" />
              Window Projection
            </h3>
            <p className="text-xs text-ink-dim">{SEASON_LABEL} schedule · {performanceSeason} performance baseline</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-accent">{projection.projectedPoints.toFixed(1)}</span>
              <span className="text-sm text-ink-dim">Projected Points</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-ink">{projection.gamesAvailable}</span>
              <span className="text-sm text-ink-dim">Games Available</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-ink">{projection.starts}</span>
              <span className="text-sm text-ink-dim">Projected Starts</span>
            </div>
            <div className="flex flex-col">
              <span className={`text-3xl font-bold ${projection.gamesAvailable > 0 ? sosInfo.color : 'text-ink-mute'}`}>{projection.gamesAvailable > 0 ? sosInfo.label : '—'}</span>
              <span className="text-sm text-ink-dim">{projection.gamesAvailable > 0 ? `Schedule (SoS ${projection.strengthOfSchedule}/10)` : 'No games in this window'}</span>
            </div>
          </div>
          {projection.offNightRate > 0 && (
            <div className="mt-4 flex items-center gap-2 text-accent">
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
        <h3 className="text-lg font-bold text-ink mb-4">Fantasy Points Per Game</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Season */}
          <div className="bg-surface-2 border border-line rounded-lg p-4">
            <div className="text-sm text-ink-dim mb-1">{performanceSeason} average</div>
            <div className="text-3xl font-bold text-ink">{seasonFppg.toFixed(2)}</div>
            <div className="text-xs text-ink-dim mt-1">{player.games_played} GP</div>
          </div>

          {/* Last 30 */}
          <div className="bg-surface-2 border border-line rounded-lg p-4">
            <div className="text-sm text-ink-dim mb-1">Last 30 Days</div>
            <div className="text-3xl font-bold text-ink">{hasLast30Sample ? last30Fppg.toFixed(2) : '—'}</div>
            <div className="text-xs text-ink-dim mt-1">
              {!hasLast30Sample ? (
                <span>No games in the last 30 days</span>
              ) : last30Fppg > seasonFppg ? (
                <span className="text-positive">↑ {((last30Fppg - seasonFppg) / seasonFppg * 100).toFixed(0)}%</span>
              ) : (
                <span className="text-negative">↓ {((seasonFppg - last30Fppg) / seasonFppg * 100).toFixed(0)}%</span>
              )}
            </div>
          </div>

          {/* Last 7 */}
          <div className="bg-surface-2 border border-line rounded-lg p-4">
            <div className="text-sm text-ink-dim mb-1">Last 7 Days</div>
            <div className="text-3xl font-bold text-ink">{hasLast7Sample ? last7Fppg.toFixed(2) : '—'}</div>
            <div className="text-xs text-ink-dim mt-1 flex items-center gap-1">
              {!hasLast7Sample && <span className="text-ink-dim">No games in the last 7 days</span>}
              {isHot && <Flame className="w-3 h-3 text-warning" />}
              {isCold && <Snowflake className="w-3 h-3 text-accent" />}
              {isHot && <span className="text-warning">+{trendPercent}%</span>}
              {isCold && <span className="text-accent">{trendPercent}%</span>}
              {hasLast7Sample && !isHot && !isCold && <span className="text-ink-dim">Steady</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      {!isGoalie && <div>
        <h3 className="text-lg font-bold text-ink">{performanceSeason} NHL stats</h3>
        <p className="mb-4 mt-1 text-[11px] text-ink-dim sm:text-xs">Season totals · per-game rates are shown in parentheses.</p>
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
      </div>}

      {/* Power Play Time (if available) */}
      {!isGoalie && player.advancedStats?.ppTimeOnIcePerGame && player.advancedStats.ppTimeOnIcePerGame > 0 && (
        <div className="rounded-xl border border-accent-muted bg-surface-0 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-muted bg-accent-muted">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-accent mb-1">Power Play Time on Ice</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-accent">
                  {Math.floor(player.advancedStats.ppTimeOnIcePerGame / 60)}:{String(Math.floor(player.advancedStats.ppTimeOnIcePerGame % 60)).padStart(2, '0')}
                </span>
                <span className="text-sm text-ink-dim">per game</span>
              </div>
              {player.advancedStats.ppGoalsForPer60 !== undefined && (
                <div className="text-xs text-ink-dim mt-1">
                  {player.advancedStats.ppGoalsForPer60.toFixed(2)} goals per 60 min
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  perGame: number;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, perGame }) => (
  <div className="bg-surface-0 border border-line rounded-lg p-3">
    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-dim sm:text-xs">{label}</div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-ink">{value}</span>
      <span className="text-sm text-ink-dim">({perGame.toFixed(1)}/GP)</span>
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
  const goalieStats = goalieStatView(player);

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
    return goalieStats.savePercentage;
  };

  const getGoalieGAA = () => {
    return goalieStats.goalsAgainstAverage;
  };

  const getGoalieSaves = () => {
    return goalieStats.saves;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-ink mb-4">Comprehensive Statistics</h3>

      {!isGoalie ? (
        <>
          {/* Skater Stats Table */}
          <div className="bg-surface-2 border border-line rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 border-b border-line">
                    <th className="text-left py-3 px-4 text-ink-dim font-semibold">Statistic</th>
                    <th className="text-right py-3 px-4 text-ink-dim font-semibold">Total</th>
                    <th className="text-right py-3 px-4 text-ink-dim font-semibold">Per Game</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {/* Games Played */}
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Games Played</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{gp}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">—</td>
                  </tr>

                  {/* Scoring */}
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Goals</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.goals)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.goals) / gp).toFixed(2)}</td>
                  </tr>
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Assists</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.assists)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.assists) / gp).toFixed(2)}</td>
                  </tr>
                  <tr className="hover:bg-surface-2 bg-accent-muted">
                    <td className="py-3 px-4 text-ink-dim font-semibold">Points</td>
                    <td className="text-right py-3 px-4 text-accent font-bold">
                      {getStat(player.stats.goals) + getStat(player.stats.assists)}
                    </td>
                    <td className="text-right py-3 px-4 text-accent">
                      {((getStat(player.stats.goals) + getStat(player.stats.assists)) / gp).toFixed(2)}
                    </td>
                  </tr>

                  {/* Plus/Minus */}
                  {(getStat((player.stats as any).plus_minus) !== 0 || (player.stats as any).plus_minus !== undefined) && (
                    <tr className="hover:bg-surface-2">
                      <td className="py-3 px-4 text-ink-dim">Plus/Minus</td>
                      <td className="text-right py-3 px-4 text-ink font-semibold">
                        {getStat((player.stats as any).plus_minus) > 0 && '+'}
                        {getStat((player.stats as any).plus_minus)}
                      </td>
                      <td className="text-right py-3 px-4 text-ink-dim">—</td>
                    </tr>
                  )}

                  {/* Shooting */}
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Shots on Goal</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.shots_on_goal)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.shots_on_goal) / gp).toFixed(2)}</td>
                  </tr>
                  {(getStat((player.stats as any).shooting_percentage) > 0 || (player.stats as any).shooting_percentage !== undefined) && (
                    <tr className="hover:bg-surface-2">
                      <td className="py-3 px-4 text-ink-dim">Shooting %</td>
                      <td className="text-right py-3 px-4 text-ink font-semibold">
                        {getStat((player.stats as any).shooting_percentage).toFixed(1)}%
                      </td>
                      <td className="text-right py-3 px-4 text-ink-dim">—</td>
                    </tr>
                  )}

                  {/* Power Play */}
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Power Play Points</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.power_play_points)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.power_play_points) / gp).toFixed(2)}</td>
                  </tr>
                  {getStat((player.stats as any).powerplay_goals) > 0 && (
                    <tr className="hover:bg-surface-2">
                      <td className="py-3 px-4 text-ink-dim pl-8">PP Goals</td>
                      <td className="text-right py-3 px-4 text-ink-dim">{getStat((player.stats as any).powerplay_goals)}</td>
                      <td className="text-right py-3 px-4 text-ink-dim">{(getStat((player.stats as any).powerplay_goals) / gp).toFixed(2)}</td>
                    </tr>
                  )}
                  {getStat((player.stats as any).powerplay_assists) > 0 && (
                    <tr className="hover:bg-surface-2">
                      <td className="py-3 px-4 text-ink-dim pl-8">PP Assists</td>
                      <td className="text-right py-3 px-4 text-ink-dim">{getStat((player.stats as any).powerplay_assists)}</td>
                      <td className="text-right py-3 px-4 text-ink-dim">{(getStat((player.stats as any).powerplay_assists) / gp).toFixed(2)}</td>
                    </tr>
                  )}

                  {/* Shorthanded */}
                  {(getStat(player.stats.shorthanded_goals) > 0 || getStat(player.stats.shorthanded_assists) > 0) && (
                    <>
                      <tr className="hover:bg-surface-2">
                        <td className="py-3 px-4 text-ink-dim">Shorthanded Goals</td>
                        <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.shorthanded_goals)}</td>
                        <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.shorthanded_goals) / gp).toFixed(2)}</td>
                      </tr>
                      <tr className="hover:bg-surface-2">
                        <td className="py-3 px-4 text-ink-dim">Shorthanded Assists</td>
                        <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.shorthanded_assists)}</td>
                        <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.shorthanded_assists) / gp).toFixed(2)}</td>
                      </tr>
                      <tr className="hover:bg-surface-2">
                        <td className="py-3 px-4 text-ink-dim">Shorthanded Points</td>
                        <td className="text-right py-3 px-4 text-ink font-semibold">
                          {getStat(player.stats.shorthanded_goals) + getStat(player.stats.shorthanded_assists)}
                        </td>
                        <td className="text-right py-3 px-4 text-ink-dim">
                          {((getStat(player.stats.shorthanded_goals) + getStat(player.stats.shorthanded_assists)) / gp).toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}

                  {/* Special Goals */}
                  {getStat(player.stats.game_winning_goals) > 0 && (
                    <tr className="hover:bg-surface-2">
                      <td className="py-3 px-4 text-ink-dim">Game Winning Goals</td>
                      <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.game_winning_goals)}</td>
                      <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.game_winning_goals) / gp).toFixed(2)}</td>
                    </tr>
                  )}

                  {/* Physical */}
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Blocks</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.blocks)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.blocks) / gp).toFixed(2)}</td>
                  </tr>
                  {getStat(player.stats.hits) > 0 && (
                    <tr className="hover:bg-surface-2">
                      <td className="py-3 px-4 text-ink-dim">Hits</td>
                      <td className="text-right py-3 px-4 text-ink font-semibold">{getStat(player.stats.hits)}</td>
                      <td className="text-right py-3 px-4 text-ink-dim">{(getStat(player.stats.hits) / gp).toFixed(2)}</td>
                    </tr>
                  )}

                  {/* Faceoffs (for centers) */}
                  {(getStat((player.stats as any).faceoff_wins) > 0 || getStat((player.stats as any).faceoff_percentage) > 0) && (
                    <>
                      {getStat((player.stats as any).faceoff_percentage) > 0 && (
                        <tr className="hover:bg-surface-2">
                          <td className="py-3 px-4 text-ink-dim">Faceoff Win %</td>
                          <td className="text-right py-3 px-4 text-ink font-semibold">
                            {(getStat((player.stats as any).faceoff_percentage) * 100).toFixed(1)}%
                          </td>
                          <td className="text-right py-3 px-4 text-ink-dim">—</td>
                        </tr>
                      )}
                      {getStat((player.stats as any).faceoff_wins) > 0 && (
                        <tr className="hover:bg-surface-2">
                          <td className="py-3 px-4 text-ink-dim pl-8">Faceoff Wins</td>
                          <td className="text-right py-3 px-4 text-ink-dim">{getStat((player.stats as any).faceoff_wins)}</td>
                          <td className="text-right py-3 px-4 text-ink-dim">
                            {(getStat((player.stats as any).faceoff_wins) / gp).toFixed(1)}
                          </td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* Time on Ice */}
                  {(getStat((player.stats as any).time_on_ice) > 0 || (player.stats as any).time_on_ice) && (
                    <tr className="hover:bg-surface-2">
                      <td className="py-3 px-4 text-ink-dim">Avg Time on Ice</td>
                      <td className="text-right py-3 px-4 text-ink font-semibold" colSpan={2}>
                        {formatToi((player.stats as any).time_on_ice)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fantasy Context */}
          <div className="bg-surface-0 border border-accent-muted rounded-lg p-4">
            <h4 className="text-sm font-bold text-accent mb-2">Fantasy Context</h4>
            <p className="text-ink-dim text-sm">
              In your <span className="text-accent font-semibold">{leagueProfile.league_name}</span> league
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
          <div className="bg-surface-2 border border-line rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 border-b border-line">
                    <th className="text-left py-3 px-4 text-ink-dim font-semibold">Statistic</th>
                    <th className="text-right py-3 px-4 text-ink-dim font-semibold">Total</th>
                    <th className="text-right py-3 px-4 text-ink-dim font-semibold">Per Game</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {/* Games & Starts */}
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Games Played</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{gp}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">—</td>
                  </tr>
                  {getStat((player.stats as any).games_started) > 0 && (
                    <tr className="hover:bg-surface-2">
                      <td className="py-3 px-4 text-ink-dim">Games Started</td>
                      <td className="text-right py-3 px-4 text-ink font-semibold">{getStat((player.stats as any).games_started)}</td>
                      <td className="text-right py-3 px-4 text-ink-dim">—</td>
                    </tr>
                  )}

                  {/* Record */}
                  <tr className="hover:bg-surface-2 bg-positive-muted">
                    <td className="py-3 px-4 text-ink-dim font-semibold">Wins</td>
                    <td className="text-right py-3 px-4 text-positive font-bold">
                      {getStat((player.stats as any).wins)}
                    </td>
                    <td className="text-right py-3 px-4 text-positive">
                      {(getStat((player.stats as any).wins) / gp).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Losses</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat((player.stats as any).losses)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">
                      {(getStat((player.stats as any).losses) / gp).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">OT Losses</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat((player.stats as any).overtime_losses)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">
                      {(getStat((player.stats as any).overtime_losses) / gp).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Record (W-L-OTL)</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold" colSpan={2}>
                      {getStat((player.stats as any).wins)}-
                      {getStat((player.stats as any).losses)}-
                      {getStat((player.stats as any).overtime_losses)}
                    </td>
                  </tr>

                  {/* Key Performance */}
                  <tr className="hover:bg-surface-2 bg-accent-muted">
                    <td className="py-3 px-4 text-ink-dim font-semibold">Save Percentage</td>
                    <td className="text-right py-3 px-4 text-accent font-bold">
                      {(getGoalieSavePct() * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 text-ink-dim">—</td>
                  </tr>
                  <tr className="hover:bg-surface-2 bg-accent-muted">
                    <td className="py-3 px-4 text-ink-dim font-semibold">Goals Against Avg</td>
                    <td className="text-right py-3 px-4 text-accent font-bold">
                      {getGoalieGAA().toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4 text-ink-dim">—</td>
                  </tr>
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Shutouts</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat((player.stats as any).shutouts)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">—</td>
                  </tr>

                  {/* Shot Metrics */}
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Saves</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getGoalieSaves()}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">
                      {(getGoalieSaves() / gp).toFixed(1)}
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Shots Against</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat((player.stats as any).shots_against)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">
                      {(getStat((player.stats as any).shots_against) / gp).toFixed(1)}
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-2">
                    <td className="py-3 px-4 text-ink-dim">Goals Against</td>
                    <td className="text-right py-3 px-4 text-ink font-semibold">{getStat((player.stats as any).goals_against)}</td>
                    <td className="text-right py-3 px-4 text-ink-dim">
                      {(getStat((player.stats as any).goals_against) / gp).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Fantasy Context for Goalies */}
          <div className="bg-surface-0 border border-accent-muted rounded-lg p-4">
            <h4 className="text-sm font-bold text-accent mb-2">Fantasy Context</h4>
            <p className="text-ink-dim text-sm">
              In your <span className="text-accent font-semibold">{leagueProfile.league_name}</span> league
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
          opponentGoalsAgainstPerGame: gameDetail.opponentGoalsAgainstPerGame,
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
          opponentGoalsAgainstPerGame: undefined,
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
          opponentGoalsAgainstPerGame: gameDetail.opponentGoalsAgainstPerGame,
          starts: 1, // Assume player starts in all games for non-roster players
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];


  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-ink">Schedule Information</h3>
        <p className="mt-1 text-[11px] text-ink-dim sm:text-xs">
          {formatDate(timeWindow.config.startUtc)}–{formatDate(timeWindow.config.endUtc)} · based on your selected fantasy window
        </p>
      </div>

      {/* Window Summary */}
      {(projection || scheduleData) && !isLoadingSchedule && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-lg border border-line bg-surface-2 p-3 sm:p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-dim sm:text-sm">Team games</div>
            <div className="text-2xl font-bold text-ink sm:text-3xl">
              {projection?.gamesAvailable ?? scheduleData?.gamesAvailable ?? 0}
            </div>
            <div className="mt-1 text-[10px] leading-tight text-ink-dim sm:text-xs">
              {player.team} games in this window
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface-2 p-3 sm:p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-dim sm:text-sm">Usable starts</div>
            <div className="text-2xl font-bold text-accent sm:text-3xl">
              {projection?.starts ?? scheduleData?.gamesAvailable ?? 0}
            </div>
            <div className="mt-1 text-[10px] leading-tight text-ink-dim sm:text-xs">
              Games your lineup can use
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface-2 p-3 sm:p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-dim sm:text-sm">Off-night games</div>
            <div className="text-2xl font-bold text-accent sm:text-3xl">
              {projection
                ? Math.round(projection.gamesAvailable * projection.offNightRate)
                : scheduleData
                ? Object.values(scheduleData.gamesByDate).filter((g: any) => g.isOffNight).length
                : 0}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] leading-tight text-ink-dim sm:text-xs">
              <Moon className="w-3 h-3" />
              {projection
                ? `${Math.round(projection.offNightRate * 100)}% · ≤8 NHL games`
                : scheduleData
                ? `${Math.round((Object.values(scheduleData.gamesByDate).filter((g: any) => g.isOffNight).length / (scheduleData.gamesAvailable || 1)) * 100)}% · ≤8 NHL games`
                : '0% · ≤8 NHL games'}
            </div>
          </div>
        </div>
      )}

      {isLoadingSchedule && (
        <div className="text-center py-8 text-ink-dim">
          Loading schedule data...
        </div>
      )}

      {/* Calendar View of Games */}
      {gameSchedule.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-ink mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            Upcoming Games
          </h4>
          <div className="rounded-lg bg-transparent sm:border sm:border-line sm:bg-surface-2 sm:p-4">
            <div className="space-y-2 sm:max-h-96 sm:overflow-y-auto">
              {gameSchedule.map((game, idx) => (
                <div
                  key={game.date}
                  className={`grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border p-3 transition-all hover:border-accent sm:grid-cols-[5rem_minmax(0,1fr)_auto] ${
                    game.isOffNight
                      ? 'bg-accent-muted border-accent'
                      : 'bg-surface-2 border-line'
                  }`}
                >
                  {/* Date */}
                  <div className="row-span-2 flex flex-col items-center justify-center rounded-lg bg-surface-2 px-2 py-2 sm:min-w-[80px] sm:px-3">
                      <div className="text-xs text-ink-dim uppercase">{getDayOfWeek(game.date)}</div>
                      <div className="text-lg font-bold text-ink">{new Date(game.date).getDate()}</div>
                      <div className="text-xs text-ink-dim">
                        {new Date(game.date).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <img
                        src={getTeamLogoUrl(game.opponent)}
                        alt=""
                        className="h-8 w-8 flex-shrink-0 object-contain sm:h-10 sm:w-10"
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-ink sm:text-base">
                          {game.isHome ? 'vs' : '@'} {game.opponent}
                        </div>
                        <div className="text-xs text-ink-dim">{game.isHome ? 'Home game' : 'Away game'}</div>
                      </div>
                    </div>
                    <div className="mt-1 min-w-0">
                      {game.opponentGoalsAgainstPerGame && (
                        <div className="text-xs text-ink-dim">
                          Opponent allows {game.opponentGoalsAgainstPerGame.toFixed(2)} GA/GP
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:justify-end sm:self-center">
                    {game.isOffNight && (
                      <div className="flex items-center gap-1 rounded-full border border-accent bg-accent-muted px-2 py-1">
                        <Moon className="w-3 h-3 text-accent" />
                        <span className="text-[10px] font-semibold text-accent sm:text-xs">Off-Night</span>
                      </div>
                    )}
                    {game.starts > 0 ? (
                      <div className="flex items-center gap-1 rounded-full border border-positive/60 bg-positive-muted px-2 py-1">
                        <Activity className="w-3 h-3 text-positive" />
                        <span className="text-[10px] font-semibold text-positive sm:text-xs">Usable start</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 rounded-full border border-warning/60 bg-warning-muted px-2 py-1">
                        <span className="text-[10px] font-semibold text-warning sm:text-xs">Blocked by lineup</span>
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
        <h4 className="text-md font-semibold text-ink mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent" />
          Window Details
        </h4>

        <div className="bg-surface-2 border border-line rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-ink-dim text-sm">Time Window:</span>
            <span className="text-ink font-semibold text-sm">
              {formatDate(timeWindow.config.startUtc)} - {formatDate(timeWindow.config.endUtc)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-ink-dim text-sm">Mode:</span>
            <span className="text-accent font-semibold text-sm capitalize">
              {timeWindow.mode.replace('-', ' ')}
            </span>
          </div>

          {projection && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-ink-dim text-sm">Strength of Schedule:</span>
                <span className={`font-semibold text-sm ${
                  projection.strengthOfSchedule >= 7 ? 'text-positive' :
                  projection.strengthOfSchedule <= 3 ? 'text-negative' :
                  'text-ink-dim'
                }`}>
                  {projection.strengthOfSchedule.toFixed(1)}/10
                  {projection.strengthOfSchedule >= 7 && ' (Easy)'}
                  {projection.strengthOfSchedule <= 3 && ' (Tough)'}
                  {projection.strengthOfSchedule > 3 && projection.strengthOfSchedule < 7 && ' (Moderate)'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-line">
                <span className="text-ink-dim text-sm">Projected Total Points:</span>
                <span className="text-accent font-bold text-lg">
                  {projection.projectedPoints.toFixed(1)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Schedule Note */}
      <div className="bg-accent-muted border border-accent rounded-lg p-4">
        <p className="text-accent text-sm">
          <strong className="text-accent">Note:</strong> Schedule projections are based on the current time window and
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
  hasLast30Sample: boolean;
  hasLast7Sample: boolean;
}

const TrendsTab: React.FC<TrendsTabProps> = ({
  player,
  seasonFppg,
  last30Fppg,
  last7Fppg,
  isHot,
  isCold,
  trendPercent,
  hasLast30Sample,
  hasLast7Sample,
}) => {
  // Calculate additional trend metrics
  const last30vsSeasonChange = seasonFppg > 0 ? ((last30Fppg - seasonFppg) / seasonFppg) * 100 : 0;
  const last7vsLast30Change = last30Fppg > 0 ? ((last7Fppg - last30Fppg) / last30Fppg) * 100 : 0;

  // Determine trend status
  const getTrendStatus = () => {
    if (!hasLast7Sample) return {
      label: 'Recent sample unavailable',
      color: 'text-ink-dim',
      bgColor: 'bg-surface-2/20',
      borderColor: 'border-line',
      icon: Activity
    };
    if (isHot) return {
      label: 'Hot Streak',
      color: 'text-warning',
      bgColor: 'bg-warning-muted',
      borderColor: 'border-warning',
      icon: Flame
    };
    if (isCold) return {
      label: 'Cold Streak',
      color: 'text-accent',
      bgColor: 'bg-accent-muted',
      borderColor: 'border-accent',
      icon: Snowflake
    };
    return {
      label: 'Steady Performance',
      color: 'text-ink-dim',
      bgColor: 'bg-surface-2/20',
      borderColor: 'border-line',
      icon: TrendingUp
    };
  };

  const trendStatus = getTrendStatus();
  const TrendIcon = trendStatus.icon;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-ink mb-4">Performance Trends</h3>

      {/* Current Trend Status */}
      <div className={`${trendStatus.bgColor} border ${trendStatus.borderColor} rounded-xl p-6`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full ${trendStatus.bgColor} border-2 ${trendStatus.borderColor} flex items-center justify-center`}>
            <TrendIcon className={`w-8 h-8 ${trendStatus.color}`} />
          </div>
          <div className="flex-1">
            <h4 className={`text-xl font-bold ${trendStatus.color} mb-1`}>{trendStatus.label}</h4>
            <p className="text-ink-dim text-sm">
              {!hasLast7Sample && `No games are available for a reliable last-7 trend.`}
              {hasLast7Sample && isHot && `${player.full_name} is performing ${Math.abs(trendPercent)}% above their season average over the last 7 days.`}
              {hasLast7Sample && isCold && `${player.full_name} is performing ${Math.abs(trendPercent)}% below their season average over the last 7 days.`}
              {hasLast7Sample && !isHot && !isCold && `${player.full_name} is maintaining consistent performance close to their season average.`}
            </p>
          </div>
        </div>
      </div>

      {/* FPPG Trend Comparison */}
      <div>
        <h4 className="text-md font-semibold text-ink mb-3">FPPG Trend Analysis</h4>
        {!hasLast30Sample && !hasLast7Sample ? (
          <div className="rounded-lg border border-line bg-surface-2 p-4 text-sm text-ink-dim">
            Recent FPPG comparisons will appear after the player has games in these windows.
          </div>
        ) : <div className="space-y-3">
          {/* Season to Last 30 */}
          {hasLast30Sample && (
          <div className="bg-surface-0 border border-line rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-dim text-sm">Season → Last 30 Days</span>
              <span className={`font-semibold text-sm ${
                last30vsSeasonChange > 5 ? 'text-positive' :
                last30vsSeasonChange < -5 ? 'text-negative' :
                'text-ink-dim'
              }`}>
                {last30vsSeasonChange > 0 ? '+' : ''}{last30vsSeasonChange.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    last30vsSeasonChange > 5 ? 'bg-positive' :
                    last30vsSeasonChange < -5 ? 'bg-negative' :
                    'bg-surface-2'
                  }`}
                  style={{ width: `${Math.min(Math.abs(last30vsSeasonChange) * 2, 100)}%` }}
                />
              </div>
              <div className="text-xs text-ink-dim w-24 text-right">
                {seasonFppg.toFixed(2)} → {last30Fppg.toFixed(2)}
              </div>
            </div>
          </div>
          )}

          {/* Last 30 to Last 7 */}
          {hasLast30Sample && hasLast7Sample && (
          <div className="bg-surface-0 border border-line rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-dim text-sm">Last 30 → Last 7 Days</span>
              <span className={`font-semibold text-sm ${
                last7vsLast30Change > 5 ? 'text-positive' :
                last7vsLast30Change < -5 ? 'text-negative' :
                'text-ink-dim'
              }`}>
                {last7vsLast30Change > 0 ? '+' : ''}{last7vsLast30Change.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    last7vsLast30Change > 5 ? 'bg-positive' :
                    last7vsLast30Change < -5 ? 'bg-negative' :
                    'bg-surface-2'
                  }`}
                  style={{ width: `${Math.min(Math.abs(last7vsLast30Change) * 2, 100)}%` }}
                />
              </div>
              <div className="text-xs text-ink-dim w-24 text-right">
                {last30Fppg.toFixed(2)} → {last7Fppg.toFixed(2)}
              </div>
            </div>
          </div>
          )}

          {/* Season to Last 7 (Overall) */}
          {hasLast7Sample && (
          <div className="bg-surface-0 border border-line rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-dim text-sm font-semibold">Season → Last 7 Days (Overall)</span>
              <span className={`font-bold text-sm ${
                trendPercent > 10 ? 'text-warning' :
                trendPercent < -10 ? 'text-accent' :
                'text-ink-dim'
              }`}>
                {trendPercent > 0 ? '+' : ''}{trendPercent}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    trendPercent > 10 ? 'bg-warning' :
                    trendPercent < -10 ? 'bg-accent' :
                    'bg-surface-2'
                  }`}
                  style={{ width: `${Math.min(Math.abs(trendPercent) * 2, 100)}%` }}
                />
              </div>
              <div className="text-xs text-ink-dim w-24 text-right">
                {seasonFppg.toFixed(2)} → {last7Fppg.toFixed(2)}
              </div>
            </div>
          </div>
          )}
        </div>}
      </div>

      {/* Performance Insight */}
      <div className="bg-surface-0 border border-accent-muted rounded-lg p-4">
        <h4 className="text-sm font-bold text-accent mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Performance Insight
        </h4>
        <p className="text-ink-dim text-sm">
          {!hasLast7Sample && (
            <>There is no reliable last-7 production sample yet. Season production and NHL role data remain available in the other tabs.</>
          )}
          {hasLast7Sample && isHot && (
            <>
              <strong className="text-warning">{player.full_name}</strong> is currently on a hot streak,
              outperforming their season average. This could be a good time to maximize their usage or consider
              them for trade value.
            </>
          )}
          {hasLast7Sample && isCold && (
            <>
              <strong className="text-accent">{player.full_name}</strong> is experiencing a cold stretch.
              Monitor closely - this could be temporary variance or a sign of decreased role/ice time.
            </>
          )}
          {hasLast7Sample && !isHot && !isCold && (
            <>
              <strong className="text-ink-dim">{player.full_name}</strong> is maintaining steady production
              consistent with their season averages. This consistency makes them a reliable fantasy asset.
            </>
          )}
        </p>
      </div>

      {/* Position Context */}
      <div className="bg-surface-2 border border-line rounded-lg p-4">
        <h4 className="text-sm font-semibold text-ink mb-3">Context</h4>
        <div className="space-y-2 text-sm text-ink-dim">
          <div className="flex justify-between">
            <span className="text-ink-dim">Position:</span>
            <span className="font-semibold">{player.positions.join('/')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-dim">Team:</span>
            <span className="font-semibold">{player.team}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-dim">Games Played:</span>
            <span className="font-semibold">{player.games_played}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
