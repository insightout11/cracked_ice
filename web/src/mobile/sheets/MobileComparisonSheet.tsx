import { useMemo } from 'react';
import { mugshotSeason } from '../../lib/season';
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
  return `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${team}/${numericId}.png`;
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

interface ComparisonStat {
  label: string;
  valueA: number | string;
  valueB: number | string;
  format?: 'int' | 'decimal' | 'percent' | 'toi' | 'signed';
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

    // Helper to get advanced stat
    const getAdvStat = (player: RosterPlayer | null, key: string): number | undefined => {
      if (!player?.advancedStats) return undefined;
      const val = (player.advancedStats as Record<string, unknown>)[key];
      return typeof val === 'number' ? val : undefined;
    };

    // Helper to get games played
    const getGamesPlayed = (player: RosterPlayer | null): number => {
      return player?.games_played ?? 0;
    };

    // If both goalies, show goalie stats
    if (isGoalieA && isGoalieB) {
      return [
        {
          label: 'ICE rating',
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
          label: 'Wins',
          valueA: (playerA?.stats as any)?.wins ?? 0,
          valueB: (playerB?.stats as any)?.wins ?? 0,
          format: 'int',
          higherIsBetter: true,
        },
        {
          label: 'Save %',
          valueA: ((playerA?.stats as any)?.savePct ?? 0) * 100,
          valueB: ((playerB?.stats as any)?.savePct ?? 0) * 100,
          format: 'percent',
          higherIsBetter: true,
        },
        {
          label: 'GAA',
          valueA: (playerA?.stats as any)?.goalsAgainstAverage ?? 0,
          valueB: (playerB?.stats as any)?.goalsAgainstAverage ?? 0,
          format: 'decimal',
          higherIsBetter: false,
        },
      ];
    }

    // Skater stats - enhanced with more comparisons
    const gamesA = getGamesPlayed(playerA);
    const gamesB = getGamesPlayed(playerB);
    const goalsA = getStat(playerA, 'goals');
    const goalsB = getStat(playerB, 'goals');
    const assistsA = getStat(playerA, 'assists');
    const assistsB = getStat(playerB, 'assists');
    const sogA = getStat(playerA, 'shots_on_goal');
    const sogB = getStat(playerB, 'shots_on_goal');
    const hitsA = getStat(playerA, 'hits');
    const hitsB = getStat(playerB, 'hits');
    const blocksA = getStat(playerA, 'blocks');
    const blocksB = getStat(playerB, 'blocks');
    const plusMinusA = (playerA?.stats as any)?.plus_minus ?? (playerA?.stats as any)?.plusMinus ?? 0;
    const plusMinusB = (playerB?.stats as any)?.plus_minus ?? (playerB?.stats as any)?.plusMinus ?? 0;

    // Shooting percentage
    const shPctA = sogA > 0 ? (goalsA / sogA) * 100 : 0;
    const shPctB = sogB > 0 ? (goalsB / sogB) * 100 : 0;

    // TOI stats
    const avgToiA = getAdvStat(playerA, 'avgToiPerGame');
    const avgToiB = getAdvStat(playerB, 'avgToiPerGame');
    const ppToiA = getAdvStat(playerA, 'ppTimeOnIcePerGame');
    const ppToiB = getAdvStat(playerB, 'ppTimeOnIcePerGame');

    const baseStats: ComparisonStat[] = [
      {
        label: 'ICE rating',
        valueA: projectionA?.iceScore ?? 0,
        valueB: projectionB?.iceScore ?? 0,
        format: 'decimal',
        higherIsBetter: true,
      },
      {
        label: 'Games Avail',
        valueA: projectionA?.gamesAvailable ?? 0,
        valueB: projectionB?.gamesAvailable ?? 0,
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'FPPG',
        valueA: projectionA?.fppg ?? playerA?.seasonFppg ?? 0,
        valueB: projectionB?.fppg ?? playerB?.seasonFppg ?? 0,
        format: 'decimal',
        higherIsBetter: true,
      },
      {
        label: 'Goals',
        valueA: goalsA,
        valueB: goalsB,
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'Assists',
        valueA: assistsA,
        valueB: assistsB,
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'Points',
        valueA: goalsA + assistsA,
        valueB: goalsB + assistsB,
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
        valueA: sogA,
        valueB: sogB,
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'SH%',
        valueA: shPctA,
        valueB: shPctB,
        format: 'percent',
        higherIsBetter: true,
      },
    ];

    // Add TOI stats if available
    if (avgToiA !== undefined || avgToiB !== undefined) {
      baseStats.push({
        label: 'Avg TOI',
        valueA: avgToiA ?? 0,
        valueB: avgToiB ?? 0,
        format: 'toi',
        higherIsBetter: true,
      });
    }

    if (ppToiA !== undefined || ppToiB !== undefined) {
      baseStats.push({
        label: 'PP TOI',
        valueA: ppToiA ?? 0,
        valueB: ppToiB ?? 0,
        format: 'toi',
        higherIsBetter: true,
      });
    }

    // Add physical stats
    baseStats.push(
      {
        label: 'Hits',
        valueA: hitsA,
        valueB: hitsB,
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: 'Blocks',
        valueA: blocksA,
        valueB: blocksB,
        format: 'int',
        higherIsBetter: true,
      },
      {
        label: '+/-',
        valueA: plusMinusA,
        valueB: plusMinusB,
        format: 'signed',
        higherIsBetter: true,
      }
    );

    return baseStats;
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
        <div className="sticky top-0 bg-surface-2 border-b border-line px-4 py-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-ink-dim" />
          </button>
          <h2 className="text-lg font-bold text-ink">Compare Players</h2>
        </div>

        {/* Player Headers */}
        <div className="flex border-b border-line">
          {/* Player A */}
          <button
            onClick={onSelectPlayerA}
            className="flex-1 p-4 border-r border-line active:bg-surface-2"
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
            className="flex-1 p-4 active:bg-surface-2"
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
            <div className="text-center py-12 text-ink-dim">
              Select two players to compare
            </div>
          )}
        </div>

        {/* Team Impact & Actions */}
        {playerA && playerB && (
          <div className="sticky bottom-0 bg-surface-2 border-t border-line px-4 py-4 safe-area-bottom">
            {/* Team Impact */}
            {teamImpact !== undefined && (
              <div className="flex items-center justify-center gap-2 mb-4 py-3 bg-surface-2 rounded-xl">
                <span className="text-sm text-ink-dim">Team Impact:</span>
                <span
                  className={`text-lg font-bold ${
                    teamImpact > 0
                      ? 'text-positive'
                      : teamImpact < 0
                      ? 'text-negative'
                      : 'text-ink-dim'
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
                className="w-full py-4 bg-accent rounded-xl text-ink font-semibold text-base hover:bg-accent active:bg-accent transition-colors flex items-center justify-center gap-2"
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
          className="w-16 h-16 rounded-full bg-surface-2 object-cover border-2 border-line"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-player.png';
          }}
        />
        <img
          src={getTeamLogoUrl(player.team)}
          alt={player.team}
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-2 border border-line p-0.5"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Name */}
      <h3 className="font-semibold text-ink text-sm truncate w-full">
        {player.full_name}
      </h3>

      {/* Team & Position */}
      <p className="text-xs text-ink-dim">
        {player.team} • {player.positions?.join(', ')}
      </p>

      {/* ICE Score */}
      <div className="mt-2 px-3 py-1 bg-surface-2 rounded-full">
        <span className="text-xs text-ink-dim">ICE: </span>
        <span className="text-sm font-bold text-accent">{iceScore.toFixed(1)}</span>
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
      <div className="w-16 h-16 rounded-full bg-surface-2 border-2 border-dashed border-line flex items-center justify-center mb-2">
        <span className="text-2xl text-ink-dim">+</span>
      </div>
      <span className="text-sm text-ink-dim">{label}</span>
    </div>
  );
}

/**
 * Comparison row with visual bars
 */
function ComparisonRow({ stat }: { stat: ComparisonStat }) {
  const { label, valueA, valueB, format = 'int', higherIsBetter = true } = stat;

  // Convert to numbers for comparison
  const numA = typeof valueA === 'number' ? valueA : parseFloat(valueA) || 0;
  const numB = typeof valueB === 'number' ? valueB : parseFloat(valueB) || 0;

  // Calculate bar widths
  const maxValue = Math.max(Math.abs(numA), Math.abs(numB), 0.01);
  const widthA = (Math.abs(numA) / maxValue) * 100;
  const widthB = (Math.abs(numB) / maxValue) * 100;

  // Determine winner
  const aWins = higherIsBetter ? numA > numB : numA < numB;
  const bWins = higherIsBetter ? numB > numA : numB < numA;
  const tie = numA === numB;

  // Format values
  const formatValue = (v: number) => {
    switch (format) {
      case 'decimal':
        return v.toFixed(2);
      case 'percent':
        return v.toFixed(1) + '%';
      case 'toi':
        return formatToi(v);
      case 'signed':
        return v > 0 ? `+${v}` : v.toString();
      default:
        return Math.round(v).toString();
    }
  };

  return (
    <div className="bg-surface-2 rounded-xl p-3">
      {/* Label */}
      <div className="text-xs text-ink-dim text-center mb-2">{label}</div>

      {/* Values & Bars */}
      <div className="flex items-center gap-2">
        {/* Player A Value */}
        <div
          className={`w-16 text-right text-sm font-bold ${
            aWins ? 'text-positive' : tie ? 'text-ink-dim' : 'text-ink-dim'
          }`}
        >
          {formatValue(numA)}
        </div>

        {/* Bars */}
        <div className="flex-1 flex items-center gap-1">
          {/* Left bar (A) - grows from center to left */}
          <div className="flex-1 h-4 flex justify-end">
            <div
              className={`h-full rounded-l transition-all ${
                aWins ? 'bg-positive-muted' : 'bg-surface-2'
              }`}
              style={{ width: `${widthA}%` }}
            />
          </div>

          {/* Center divider */}
          <div className="w-px h-6 bg-surface-2" />

          {/* Right bar (B) - grows from center to right */}
          <div className="flex-1 h-4 flex justify-start">
            <div
              className={`h-full rounded-r transition-all ${
                bWins ? 'bg-positive-muted' : 'bg-surface-2'
              }`}
              style={{ width: `${widthB}%` }}
            />
          </div>
        </div>

        {/* Player B Value */}
        <div
          className={`w-16 text-left text-sm font-bold ${
            bWins ? 'text-positive' : tie ? 'text-ink-dim' : 'text-ink-dim'
          }`}
        >
          {formatValue(numB)}
        </div>
      </div>
    </div>
  );
}
