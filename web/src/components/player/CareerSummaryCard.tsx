import React from 'react';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';

interface CareerSeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  team?: string;
}

interface CareerSummary {
  totalSeasons: number;
  totalGames: number;
  careerAvgPPG: number;
  bestSeason: string;
  bestSeasonPPG: number;
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
  // Calculate current season stats for comparison
  const currentSeasonStats = currentSeason ? careerHistory[currentSeason] : null;
  const currentPPG = currentSeasonStats && currentSeasonStats.gamesPlayed > 0
    ? currentSeasonStats.points / currentSeasonStats.gamesPlayed
    : 0;

  // Determine if having career year
  const isCareerYear = currentPPG > 0 && currentPPG > careerSummary.careerAvgPPG * 1.1;

  // Format best season for display
  const bestSeasonLabel = careerSummary.bestSeason.length === 8
    ? `${careerSummary.bestSeason.slice(2, 4)}-${careerSummary.bestSeason.slice(6, 8)}`
    : careerSummary.bestSeason;

  // Calculate total career points
  const totalCareerPoints = Object.values(careerHistory).reduce((sum, season) => sum + season.points, 0);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-emerald-400" />
        Career Summary
      </h3>

      {/* Career Year Badge */}
      {isCareerYear && currentSeasonStats && (
        <div className="mb-4 px-3 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-semibold text-sm">Having a Career Year!</span>
          </div>
          <p className="text-slate-300 text-xs mt-1">
            {currentPPG.toFixed(2)} PPG this season vs {careerSummary.careerAvgPPG.toFixed(2)} career average
          </p>
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

        {/* Career PPG */}
        <div>
          <p className="text-slate-400 text-sm mb-1">Career PPG</p>
          <p className="text-emerald-400 text-2xl font-bold">{careerSummary.careerAvgPPG.toFixed(2)}</p>
        </div>

        {/* Total Career Points */}
        <div>
          <p className="text-slate-400 text-sm mb-1">Career Points</p>
          <p className="text-white text-2xl font-bold">{totalCareerPoints}</p>
        </div>
      </div>

      {/* Best Season */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <p className="text-slate-400 text-sm">Best Season</p>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-white text-xl font-semibold">{bestSeasonLabel}</p>
          <span className="text-slate-500">•</span>
          <p className="text-emerald-400 font-medium">{careerSummary.bestSeasonPPG.toFixed(2)} PPG</p>
        </div>
        {careerHistory[careerSummary.bestSeason] && (
          <p className="text-slate-400 text-sm mt-1">
            {careerHistory[careerSummary.bestSeason].points} points in {careerHistory[careerSummary.bestSeason].gamesPlayed} games
          </p>
        )}
      </div>

      {/* Current Season Comparison */}
      {currentSeasonStats && currentPPG > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Current Season vs Career Average</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all"
                  style={{
                    width: `${Math.min(100, (currentPPG / careerSummary.careerAvgPPG) * 100)}%`
                  }}
                />
              </div>
            </div>
            <p className={`text-sm font-semibold ${
              currentPPG > careerSummary.careerAvgPPG ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {currentPPG > careerSummary.careerAvgPPG ? '+' : ''}
              {((currentPPG - careerSummary.careerAvgPPG) / careerSummary.careerAvgPPG * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
