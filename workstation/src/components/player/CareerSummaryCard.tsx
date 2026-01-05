import React from 'react';
import { Trophy, TrendingUp, Calendar, Shield } from 'lucide-react';

interface CareerSeasonStats {
  gamesPlayed: number;
  // Skater stats
  goals?: number;
  assists?: number;
  points?: number;
  // Goalie stats
  wins?: number;
  losses?: number;
  overtimeLosses?: number;
  goalsAgainst?: number;
  goalsAgainstAverage?: number;
  savePct?: number;
  shutouts?: number;
  // Common
  team?: string;
}

interface CareerSummary {
  totalSeasons: number;
  totalGames: number;
  // Skater summary
  careerAvgPPG?: number;
  bestSeason?: string;
  bestSeasonPPG?: number;
  // Goalie summary
  careerWinPct?: number;
  careerGAA?: number;
  careerSavePct?: number;
  totalWins?: number;
  totalShutouts?: number;
  bestSeasonGAA?: number;
  bestSeasonSavePct?: number;
}

interface CareerSummaryCardProps {
  careerHistory: Record<string, CareerSeasonStats>;
  careerSummary: CareerSummary;
  currentSeason?: string;
}

export const CareerSummaryCard: React.FC<CareerSummaryCardProps> = ({
  careerHistory,
  careerSummary,
  currentSeason
}) => {
  // Detect if this is a goalie
  const firstSeason = Object.values(careerHistory)[0];
  const isGoalie = firstSeason?.wins !== undefined;

  // Calculate current season stats for comparison
  const currentSeasonStats = currentSeason ? careerHistory[currentSeason] : null;

  let isCareerYear = false;
  let careerYearText = '';

  if (isGoalie && currentSeasonStats && currentSeasonStats.gamesPlayed > 0) {
    const currentGAA = currentSeasonStats.goalsAgainstAverage || 0;
    const careerGAA = careerSummary.careerGAA || 999;
    isCareerYear = currentGAA > 0 && currentGAA < careerGAA * 0.9;
    if (isCareerYear) {
      careerYearText = `${currentGAA.toFixed(2)} GAA this season vs ${careerGAA.toFixed(2)} career average`;
    }
  } else if (currentSeasonStats && currentSeasonStats.gamesPlayed > 0) {
    const currentPPG = (currentSeasonStats.points || 0) / currentSeasonStats.gamesPlayed;
    const careerPPG = careerSummary.careerAvgPPG || 0;
    isCareerYear = currentPPG > 0 && currentPPG > careerPPG * 1.1;
    if (isCareerYear) {
      careerYearText = `${currentPPG.toFixed(2)} PPG this season vs ${careerPPG.toFixed(2)} career average`;
    }
  }

  // Format best season for display
  const bestSeasonLabel = careerSummary.bestSeason && careerSummary.bestSeason.length === 8
    ? `${careerSummary.bestSeason.slice(2, 4)}-${careerSummary.bestSeason.slice(6, 8)}`
    : careerSummary.bestSeason || 'N/A';

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        {isGoalie ? <Shield className="w-5 h-5 text-cyan-400" /> : <Calendar className="w-5 h-5 text-emerald-400" />}
        Career Summary
      </h3>

      {/* Career Year Badge */}
      {isCareerYear && currentSeasonStats && (
        <div className="mb-4 px-3 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-semibold text-sm">Having a Career Year!</span>
          </div>
          <p className="text-slate-300 text-xs mt-1">{careerYearText}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Total Seasons */}
        <div>
          <p className="text-slate-400 text-sm mb-1">NHL Seasons</p>
          <p className="text-white text-2xl font-bold">{careerSummary.totalSeasons}</p>
        </div>

        {/* Total Games */}
        <div>
          <p className="text-slate-400 text-sm mb-1">Total Games</p>
          <p className="text-white text-2xl font-bold">{careerSummary.totalGames}</p>
        </div>

        {isGoalie ? (
          <>
            {/* Career Win % */}
            <div>
              <p className="text-slate-400 text-sm mb-1">Career Win %</p>
              <p className="text-emerald-400 text-2xl font-bold">
                {((careerSummary.careerWinPct || 0) * 100).toFixed(1)}%
              </p>
            </div>

            {/* Career GAA */}
            <div>
              <p className="text-slate-400 text-sm mb-1">Career GAA</p>
              <p className="text-white text-2xl font-bold">{(careerSummary.careerGAA || 0).toFixed(2)}</p>
            </div>

            {/* Total Wins */}
            <div>
              <p className="text-slate-400 text-sm mb-1">Career Wins</p>
              <p className="text-white text-2xl font-bold">{careerSummary.totalWins || 0}</p>
            </div>

            {/* Total Shutouts */}
            <div>
              <p className="text-slate-400 text-sm mb-1">Career Shutouts</p>
              <p className="text-white text-2xl font-bold">{careerSummary.totalShutouts || 0}</p>
            </div>
          </>
        ) : (
          <>
            {/* Career PPG */}
            <div>
              <p className="text-slate-400 text-sm mb-1">Career PPG</p>
              <p className="text-emerald-400 text-2xl font-bold">{(careerSummary.careerAvgPPG || 0).toFixed(2)}</p>
            </div>

            {/* Total Career Points */}
            <div>
              <p className="text-slate-400 text-sm mb-1">Career Points</p>
              <p className="text-white text-2xl font-bold">
                {Object.values(careerHistory).reduce((sum, season) => sum + (season.points || 0), 0)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Best Season */}
      {careerSummary.bestSeason && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <p className="text-slate-400 text-sm">Best Season</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-white text-xl font-semibold">{bestSeasonLabel}</p>
            <span className="text-slate-500">•</span>
            {isGoalie ? (
              <p className="text-emerald-400 font-medium">{(careerSummary.bestSeasonGAA || 0).toFixed(2)} GAA</p>
            ) : (
              <p className="text-emerald-400 font-medium">{(careerSummary.bestSeasonPPG || 0).toFixed(2)} PPG</p>
            )}
          </div>
          {careerHistory[careerSummary.bestSeason] && (
            <p className="text-slate-400 text-sm mt-1">
              {isGoalie
                ? `${careerHistory[careerSummary.bestSeason].wins || 0} wins in ${careerHistory[careerSummary.bestSeason].gamesPlayed} games`
                : `${careerHistory[careerSummary.bestSeason].points || 0} points in ${careerHistory[careerSummary.bestSeason].gamesPlayed} games`
              }
            </p>
          )}
        </div>
      )}

      {/* Current Season Comparison */}
      {currentSeasonStats && currentSeasonStats.gamesPlayed > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Current Season vs Career Average</p>
          {isGoalie ? (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all"
                    style={{
                      width: `${Math.min(100, ((careerSummary.careerGAA || 0) / (currentSeasonStats.goalsAgainstAverage || 1)) * 100)}%`
                    }}
                  />
                </div>
              </div>
              <p className={`text-sm font-semibold ${
                (currentSeasonStats.goalsAgainstAverage || 0) < (careerSummary.careerGAA || 999) ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {(currentSeasonStats.goalsAgainstAverage || 0) < (careerSummary.careerGAA || 999) ? '-' : '+'}
                {(((currentSeasonStats.goalsAgainstAverage || 0) - (careerSummary.careerGAA || 0)) / (careerSummary.careerGAA || 1) * 100).toFixed(0)}%
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all"
                    style={{
                      width: `${Math.min(100, (((currentSeasonStats.points || 0) / currentSeasonStats.gamesPlayed) / (careerSummary.careerAvgPPG || 1)) * 100)}%`
                    }}
                  />
                </div>
              </div>
              <p className={`text-sm font-semibold ${
                ((currentSeasonStats.points || 0) / currentSeasonStats.gamesPlayed) > (careerSummary.careerAvgPPG || 0) ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {((currentSeasonStats.points || 0) / currentSeasonStats.gamesPlayed) > (careerSummary.careerAvgPPG || 0) ? '+' : ''}
                {((((currentSeasonStats.points || 0) / currentSeasonStats.gamesPlayed) - (careerSummary.careerAvgPPG || 0)) / (careerSummary.careerAvgPPG || 1) * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
