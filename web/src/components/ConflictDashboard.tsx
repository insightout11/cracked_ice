import { useMemo } from 'react';
import type { CoachConflictResponse } from '../types';

interface ConflictDashboardProps {
  conflicts: CoachConflictResponse | null;
  loading: boolean;
}

export function ConflictDashboard({ conflicts, loading }: ConflictDashboardProps) {
  const benchLeaders = useMemo(() => {
    if (!conflicts) return [];

    // Build a map of player IDs to names from the byDay data
    const playerNames = new Map<string, string>();
    conflicts.byDay.forEach(day => {
      day.benched.forEach(player => {
        if (!playerNames.has(player.playerId)) {
          playerNames.set(player.playerId, player.playerName);
        }
      });
    });

    return Object.entries(conflicts.benchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([playerId, count]) => ({
        playerId,
        playerName: playerNames.get(playerId) || playerId,
        count
      }));
  }, [conflicts]);

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-surface-glass p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <span className="ml-3 text-sm text-[var(--ink-mute)]">Analyzing schedule conflicts...</span>
        </div>
      </div>
    );
  }

  if (!conflicts) {
    return (
      <div className="rounded-xl border border-line bg-surface-glass p-6">
        <p className="text-sm text-[var(--ink-mute)] text-center">
          Upload your roster to see schedule conflicts
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-line bg-surface-glass p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">Benched Games</p>
          <p className="text-2xl font-bold text-negative mt-1">{conflicts.summary.totalBenchGp}</p>
          <p className="text-xs text-[var(--ink-mute)] mt-1">Games where players sit</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-glass p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">Total Starts</p>
          <p className="text-2xl font-bold text-[var(--accent)] mt-1">{conflicts.summary.totalStarts}</p>
          <p className="text-xs text-[var(--ink-mute)] mt-1">Active roster spots</p>
        </div>
      </div>

      {/* Most Benched Players */}
      {benchLeaders.length > 0 && (
        <div className="rounded-xl border border-line bg-surface-glass p-4">
          <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">Most Benched Players</h4>
          <div className="space-y-2">
            {benchLeaders.map((player) => (
              <div key={player.playerId} className="flex items-center justify-between text-sm">
                <span className="text-[var(--ink)]">{player.playerName}</span>
                <span className="text-negative font-semibold">{player.count} night{player.count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Calendar */}
      <div className="rounded-xl border border-line bg-surface-glass p-4">
        <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">Daily Breakdown</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {conflicts.byDay.map((day) => {
            const activeSlots = Object.entries(day.unusedSlots).filter(
              ([pos, count]) => !['BN', 'IR', 'IR+', 'IR-LT'].includes(pos) && count > 0
            );
            const hasUnused = activeSlots.length > 0;

            return (
              <div
                key={day.date}
                className={`rounded-lg border p-3 ${
                  hasUnused
                    ? 'border-warning bg-warning-muted'
                    : 'border-positive bg-positive-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  {hasUnused ? (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {activeSlots.map(([position, count]) => (
                        <span
                          key={position}
                          className="text-xs px-2 py-0.5 rounded bg-warning-muted text-warning border border-warning font-medium"
                        >
                          {count} {position}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-positive font-medium">All slots filled</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
