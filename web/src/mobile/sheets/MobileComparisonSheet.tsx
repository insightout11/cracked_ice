import { useMemo } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import { MobileBottomSheet } from '../MobileBottomSheet';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobileComparisonSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playerA: RosterPlayer | null;
  playerB: RosterPlayer | null;
  projectionA?: PlayerProjection;
  projectionB?: PlayerProjection;
  onSwapPlayers?: () => void;
  onSelectPlayerA?: () => void;
  onSelectPlayerB?: () => void;
  teamImpact?: number; // +/- ICE change if swapped
}

/**
 * Get headshot URL for NHL player
 */
function getHeadshotUrl(playerId: string, team: string): string {
  const numericId = playerId.replace(/^nhl:/, '');
  return `https://assets.nhle.com/mugs/nhl/20252026/${team}/${numericId}.png`;
}

interface ComparisonStat {
  label: string;
  valueA: number;
  valueB: number;
  format?: 'int' | 'decimal' | 'percent';
  higherIsBetter?: boolean;
}

/**
 * MobileComparisonSheet - Side-by-side player comparison
 *
 * Features:
 * - Split view with both players
 * - Visual bar comparison for each stat
 * - Highlights which player is better
 * - Team impact calculation
 * - Swap action button
 */
export function MobileComparisonSheet({
  isOpen,
  onClose,
  playerA,
  playerB,
  projectionA,
  projectionB,
  onSwapPlayers,
  onSelectPlayerA,
  onSelectPlayerB,
  teamImpact,
}: MobileComparisonSheetProps) {
  // Build comparison stats
  const stats = useMemo((): ComparisonStat[] => {
    const isGoalieA = playerA?.positions?.includes('G');
    const isGoalieB = playerB?.positions?.includes('G');

    // Helper to safely get stat as number
    const getStat = (player: RosterPlayer | null, key: string): number => {
      if (!player?.stats) return 0;
      const val = (player.stats as Record<string, unknown>)[key];
      return typeof val === 'number' ? val : 0;
    };

    // If both goalies, show goalie stats
    if (isGoalieA && isGoalieB) {
      return [
        {
          label: 'ICE Score',
          valueA: projectionA?.iceScore ?? 0,
          valueB: projectionB?.iceScore ?? 0,
          format: 'decimal',
          higherIsBetter: true,
        },
        {
          label: 'Games',
          valueA: projectionA?.gamesAvailable ?? 0,
          valueB: projectionB?.gamesAvailable ?? 0,
          format: 'int',
          higherIsBetter: true,
        },
        {
          label: 'Starts',
          valueA: projectionA?.starts ?? 0,
          valueB: projectionB?.starts ?? 0,
          format: 'int',
          higherIsBetter: true,
        },
        {
          label: 'FPPG',
          valueA: projectionA?.fppg ?? 0,
          valueB: projectionB?.fppg ?? 0,
          format: 'decimal',
          higherIsBetter: true,
        },
        {
          label: 'Goals',
          valueA: getStat(playerA, 'goals'),
          valueB: getStat(playerB, 'goals'),
          format: 'int',
          higherIsBetter: true,
        },
        {
          label: 'Assists',
          valueA: getStat(playerA, 'assists'),
          valueB: getStat(playerB, 'assists'),
          format: 'int',
          higherIsBetter: true,
        },
      ];
    }

    // Skater stats
    return [
      {
        label: 'ICE Score',
        valueA: projectionA?.iceScore ?? 0,
        valueB: projectionB?.iceScore ?? 0,
        format: 'decimal',
        higherIsBetter: true,
      },
      {
        label: 'Games',
        valueA: projectionA?.gamesAvailable ?? 0,
        valueB: projectionB?.gamesAvailable ?? 0,
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'FPPG',
        valueA: projectionA?.fppg ?? 0,
        valueB: projectionB?.fppg ?? 0,
        format: 'decimal',
        higherIsBetter: true,
      },
      {
        label: 'Goals',
        valueA: getStat(playerA, 'goals'),
        valueB: getStat(playerB, 'goals'),
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'Assists',
        valueA: getStat(playerA, 'assists'),
        valueB: getStat(playerB, 'assists'),
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'Points',
        valueA: getStat(playerA, 'goals') + getStat(playerA, 'assists'),
        valueB: getStat(playerB, 'goals') + getStat(playerB, 'assists'),
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'PPP',
        valueA: getStat(playerA, 'power_play_points'),
        valueB: getStat(playerB, 'power_play_points'),
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'SOG',
        valueA: getStat(playerA, 'shots_on_goal'),
        valueB: getStat(playerB, 'shots_on_goal'),
        format: 'int',
        higherIsBetter: true,
      },
    ];
  }, [playerA, playerB, projectionA, projectionB]);

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={['90%']}
      initialSnap={0}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
          <h2 className="text-lg font-bold text-white">Compare Players</h2>
        </div>

        {/* Player Headers */}
        <div className="flex border-b border-slate-700">
          {/* Player A */}
          <button
            onClick={onSelectPlayerA}
            className="flex-1 p-4 border-r border-slate-700 active:bg-slate-800/50"
          >
            {playerA ? (
              <PlayerHeader player={playerA} projection={projectionA} />
            ) : (
              <EmptyPlayerSlot label="Select Player" />
            )}
          </button>

          {/* Player B */}
          <button
            onClick={onSelectPlayerB}
            className="flex-1 p-4 active:bg-slate-800/50"
          >
            {playerB ? (
              <PlayerHeader player={playerB} projection={projectionB} />
            ) : (
              <EmptyPlayerSlot label="Select Player" />
            )}
          </button>
        </div>

        {/* Comparison Stats */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {playerA && playerB ? (
            <div className="space-y-3">
              {stats.map((stat) => (
                <ComparisonRow key={stat.label} stat={stat} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Select two players to compare
            </div>
          )}
        </div>

        {/* Team Impact & Actions */}
        {playerA && playerB && (
          <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-4 py-4 safe-area-bottom">
            {/* Team Impact */}
            {teamImpact !== undefined && (
              <div className="flex items-center justify-center gap-2 mb-4 py-3 bg-slate-800/50 rounded-xl">
                <span className="text-sm text-slate-400">Team Impact:</span>
                <span
                  className={`text-lg font-bold ${
                    teamImpact > 0
                      ? 'text-green-400'
                      : teamImpact < 0
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}
                >
                  {teamImpact > 0 ? '+' : ''}
                  {teamImpact.toFixed(1)} ICE
                </span>
              </div>
            )}

            {/* Swap Button */}
            {onSwapPlayers && (
              <button
                onClick={onSwapPlayers}
                className="w-full py-4 bg-cyan-600 rounded-xl text-white font-semibold text-base hover:bg-cyan-500 active:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeftRight className="w-5 h-5" />
                Swap Players
              </button>
            )}
          </div>
        )}
      </div>
    </MobileBottomSheet>
  );
}

/**
 * Player header component
 */
function PlayerHeader({
  player,
  projection,
}: {
  player: RosterPlayer;
  projection?: PlayerProjection;
}) {
  const iceScore = projection?.iceScore ?? 0;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Headshot */}
      <div className="relative mb-2">
        <img
          src={getHeadshotUrl(player.id, player.team)}
          alt={player.full_name}
          className="w-16 h-16 rounded-full bg-slate-700 object-cover border-2 border-slate-600"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-player.png';
          }}
        />
        <img
          src={getTeamLogoUrl(player.team)}
          alt={player.team}
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-600 p-0.5"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Name */}
      <h3 className="font-semibold text-white text-sm truncate w-full">
        {player.full_name}
      </h3>

      {/* Team & Position */}
      <p className="text-xs text-slate-400">
        {player.team} • {player.positions?.join(', ')}
      </p>

      {/* ICE Score */}
      <div className="mt-2 px-3 py-1 bg-slate-800 rounded-full">
        <span className="text-xs text-slate-400">ICE: </span>
        <span className="text-sm font-bold text-cyan-400">{iceScore.toFixed(1)}</span>
      </div>
    </div>
  );
}

/**
 * Empty player slot
 */
function EmptyPlayerSlot({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center mb-2">
        <span className="text-2xl text-slate-600">+</span>
      </div>
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}

/**
 * Comparison row with visual bars
 */
function ComparisonRow({ stat }: { stat: ComparisonStat }) {
  const { label, valueA, valueB, format = 'int', higherIsBetter = true } = stat;

  // Calculate bar widths
  const maxValue = Math.max(valueA, valueB, 0.01);
  const widthA = (valueA / maxValue) * 100;
  const widthB = (valueB / maxValue) * 100;

  // Determine winner
  const aWins = higherIsBetter ? valueA > valueB : valueA < valueB;
  const bWins = higherIsBetter ? valueB > valueA : valueB < valueA;
  const tie = valueA === valueB;

  // Format values
  const formatValue = (v: number) => {
    switch (format) {
      case 'decimal':
        return v.toFixed(2);
      case 'percent':
        return v.toFixed(1) + '%';
      default:
        return Math.round(v).toString();
    }
  };

  return (
    <div className="bg-slate-800/30 rounded-xl p-3">
      {/* Label */}
      <div className="text-xs text-slate-400 text-center mb-2">{label}</div>

      {/* Values & Bars */}
      <div className="flex items-center gap-2">
        {/* Player A Value */}
        <div
          className={`w-16 text-right text-sm font-bold ${
            aWins ? 'text-green-400' : tie ? 'text-slate-300' : 'text-slate-400'
          }`}
        >
          {formatValue(valueA)}
        </div>

        {/* Bars */}
        <div className="flex-1 flex items-center gap-1">
          {/* Left bar (A) - grows from center to left */}
          <div className="flex-1 h-4 flex justify-end">
            <div
              className={`h-full rounded-l transition-all ${
                aWins ? 'bg-green-500/50' : 'bg-slate-600/50'
              }`}
              style={{ width: `${widthA}%` }}
            />
          </div>

          {/* Center divider */}
          <div className="w-px h-6 bg-slate-600" />

          {/* Right bar (B) - grows from center to right */}
          <div className="flex-1 h-4 flex justify-start">
            <div
              className={`h-full rounded-r transition-all ${
                bWins ? 'bg-green-500/50' : 'bg-slate-600/50'
              }`}
              style={{ width: `${widthB}%` }}
            />
          </div>
        </div>

        {/* Player B Value */}
        <div
          className={`w-16 text-left text-sm font-bold ${
            bWins ? 'text-green-400' : tie ? 'text-slate-300' : 'text-slate-400'
          }`}
        >
          {formatValue(valueB)}
        </div>
      </div>
    </div>
  );
}
