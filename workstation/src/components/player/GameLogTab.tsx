import React, { useState } from 'react';
import type { GameLogEntry } from '../../lib/coachSchemas';
import { format } from 'date-fns';

interface GameLogTabProps {
  games: GameLogEntry[];
  isGoalie: boolean;
}

export const GameLogTab: React.FC<GameLogTabProps> = ({ games, isGoalie }) => {
  const [visibleCount, setVisibleCount] = useState(10);

  if (!games || games.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>No game log data available</p>
      </div>
    );
  }

  const formatGameDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d');
  };

  const visibleGames = games.slice(0, visibleCount);
  const hasMore = visibleCount < games.length;

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 10, games.length));
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">
        Showing {visibleGames.length} of {games.length} games
      </div>

      {/* Skater Table */}
      {!isGoalie && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr className="text-slate-400">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Opp</th>
                <th className="text-center py-2 px-2">TOI</th>
                <th className="text-center py-2 px-2">G</th>
                <th className="text-center py-2 px-2">A</th>
                <th className="text-center py-2 px-2">P</th>
                <th className="text-center py-2 px-2">+/-</th>
                <th className="text-center py-2 px-2">SOG</th>
                <th className="text-center py-2 px-2">PPG</th>
                <th className="text-center py-2 px-2">PPP</th>
                <th className="text-center py-2 px-2">SHG</th>
                <th className="text-center py-2 px-2">Hits</th>
                <th className="text-center py-2 px-2">Blk</th>
                <th className="text-center py-2 px-2">PIM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleGames.map((game, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-2 px-3 text-slate-300 font-medium">
                    {formatGameDate(game.gameDate)}
                  </td>
                  <td className="py-2 px-3">
                    {game.opponent && (
                      <span className="text-slate-300">
                        {game.isHome ? 'vs' : '@'} {game.opponent}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center text-slate-300 font-mono text-xs">
                    {game.toi || '-'}
                  </td>
                  <td className="py-2 px-2 text-center text-white font-medium">
                    {game.goals}
                  </td>
                  <td className="py-2 px-2 text-center text-white font-medium">
                    {game.assists}
                  </td>
                  <td className="py-2 px-2 text-center text-cyan-400 font-bold">
                    {game.points}
                  </td>
                  <td className={`py-2 px-2 text-center font-medium ${
                    (game.plusMinus || 0) > 0 ? 'text-green-400' :
                    (game.plusMinus || 0) < 0 ? 'text-red-400' :
                    'text-slate-400'
                  }`}>
                    {game.plusMinus !== undefined ? (game.plusMinus > 0 ? '+' : '') + game.plusMinus : '-'}
                  </td>
                  <td className="py-2 px-2 text-center text-slate-300">
                    {game.shots}
                  </td>
                  <td className="py-2 px-2 text-center text-blue-400">
                    {game.powerPlayGoals || '-'}
                  </td>
                  <td className="py-2 px-2 text-center text-blue-300">
                    {game.powerPlayPoints || '-'}
                  </td>
                  <td className="py-2 px-2 text-center text-purple-400">
                    {game.shorthandedGoals || '-'}
                  </td>
                  <td className="py-2 px-2 text-center text-orange-400">
                    {game.hits || '-'}
                  </td>
                  <td className="py-2 px-2 text-center text-slate-400">
                    {game.blocks || '-'}
                  </td>
                  <td className="py-2 px-2 text-center text-yellow-400">
                    {game.pim || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Goalie Table */}
      {isGoalie && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr className="text-slate-400">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Opp</th>
                <th className="text-center py-2 px-2">TOI</th>
                <th className="text-center py-2 px-2">Decision</th>
                <th className="text-center py-2 px-2">Saves</th>
                <th className="text-center py-2 px-2">Shots</th>
                <th className="text-center py-2 px-2">SV%</th>
                <th className="text-center py-2 px-2">GAA</th>
                <th className="text-center py-2 px-2">SO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleGames.map((game, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-2 px-3 text-slate-300 font-medium">
                    {formatGameDate(game.gameDate)}
                  </td>
                  <td className="py-2 px-3">
                    {game.opponent && (
                      <span className="text-slate-300">
                        {game.isHome ? 'vs' : '@'} {game.opponent}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center text-slate-300 font-mono text-xs">
                    {game.toi || '-'}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {game.decision && (
                      <span className={`font-bold ${
                        game.decision === 'W' ? 'text-green-400' :
                        game.decision === 'L' ? 'text-red-400' :
                        'text-orange-400'
                      }`}>
                        {game.decision}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center text-cyan-400 font-medium">
                    {game.saves || 0}
                  </td>
                  <td className="py-2 px-2 text-center text-slate-300">
                    {game.shotsAgainst || 0}
                  </td>
                  <td className="py-2 px-2 text-center text-white font-medium">
                    {game.savePct ? (game.savePct * 100).toFixed(1) + '%' : '-'}
                  </td>
                  <td className="py-2 px-2 text-center text-slate-300">
                    {game.gaa?.toFixed(2) || '-'}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {game.shutout && <span className="text-yellow-400">✓</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadMore}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Load More ({games.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};
