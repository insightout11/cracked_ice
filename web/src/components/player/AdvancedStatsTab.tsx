import { Activity, Zap, Target, TrendingUp, TrendingDown } from 'lucide-react';

interface AdvancedStats {
  ppTimeOnIcePerGame?: number;
  ppGoalsForPer60?: number;
  ppIndividualSatFor?: number;
  shTimeOnIcePerGame?: number;
  ppGoalsAgainstPer60?: number;
  shIndividualSatFor?: number;
  giveaways?: number;
  giveawaysPer60?: number;
  takeaways?: number;
  takeawaysPer60?: number;
  hitsPer60?: number;
  blockedShotsPer60?: number;
  defensiveZoneFaceoffPct?: number;
  offensiveZoneFaceoffPct?: number;
  neutralZoneFaceoffPct?: number;
}

interface AdvancedStatsTabProps {
  advancedStats?: AdvancedStats;
  positions: string[];
}

function formatTimeOnIce(seconds?: number): string {
  if (!seconds || seconds === 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatPercent(value?: number): string {
  if (value === undefined || value === null) return '--';
  return `${(value * 100).toFixed(1)}%`;
}

function formatPer60(value?: number): string {
  if (value === undefined || value === null) return '--';
  return value.toFixed(2);
}

export function AdvancedStatsTab({ advancedStats, positions }: AdvancedStatsTabProps) {
  if (!advancedStats) {
    return (
      <div className="text-center py-12">
        <Activity className="w-16 h-16 text-ink-dim mx-auto mb-4" />
        <p className="text-ink-dim text-lg mb-2">No Advanced Stats Available</p>
        <p className="text-ink-dim text-sm">
          Advanced stats will be available after the next data sync.
        </p>
      </div>
    );
  }

  const isCenter = positions.includes('C');
  const hasPPTime = advancedStats.ppTimeOnIcePerGame && advancedStats.ppTimeOnIcePerGame > 0;
  const hasPKTime = advancedStats.shTimeOnIcePerGame && advancedStats.shTimeOnIcePerGame > 0;
  const hasGiveawayTakeaway = (advancedStats.giveaways || 0) > 0 || (advancedStats.takeaways || 0) > 0;
  const hasFaceoffs = isCenter && (
    advancedStats.defensiveZoneFaceoffPct !== undefined ||
    advancedStats.offensiveZoneFaceoffPct !== undefined ||
    advancedStats.neutralZoneFaceoffPct !== undefined
  );

  const takeawayGiveawayRatio = (advancedStats.giveaways || 0) > 0
    ? ((advancedStats.takeaways || 0) / (advancedStats.giveaways || 1))
    : 0;

  return (
    <div className="space-y-6">
      {/* Special Teams Time on Ice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Power Play */}
        <div className="rounded-lg border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-medium text-ink-dim">Power Play</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-ink-dim text-sm">TOI/Game</span>
              <span className={`text-xl font-bold ${hasPPTime ? 'text-accent' : 'text-ink-dim'}`}>
                {formatTimeOnIce(advancedStats.ppTimeOnIcePerGame)}
              </span>
            </div>

            {hasPPTime && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-dim">GF/60</span>
                  <span className="text-ink-dim">{formatPer60(advancedStats.ppGoalsForPer60)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-dim">Shot Attempts</span>
                  <span className="text-ink-dim">{advancedStats.ppIndividualSatFor || '--'}</span>
                </div>
              </>
            )}

            {!hasPPTime && (
              <p className="text-xs text-ink-dim italic">No PP time this season</p>
            )}
          </div>
        </div>

        {/* Penalty Kill */}
        <div className="rounded-lg border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-negative" />
            <h3 className="text-sm font-medium text-ink-dim">Penalty Kill</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-ink-dim text-sm">TOI/Game</span>
              <span className={`text-xl font-bold ${hasPKTime ? 'text-negative' : 'text-ink-dim'}`}>
                {formatTimeOnIce(advancedStats.shTimeOnIcePerGame)}
              </span>
            </div>

            {hasPKTime && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-dim">GA/60</span>
                  <span className="text-ink-dim">{formatPer60(advancedStats.ppGoalsAgainstPer60)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-dim">Shot Attempts</span>
                  <span className="text-ink-dim">{advancedStats.shIndividualSatFor || '--'}</span>
                </div>
              </>
            )}

            {!hasPKTime && (
              <p className="text-xs text-ink-dim italic">No PK time this season</p>
            )}
          </div>
        </div>
      </div>

      {/* Giveaways vs Takeaways */}
      {hasGiveawayTakeaway && (
        <div className="rounded-lg border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-medium text-ink-dim">Possession Metrics</h3>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-positive" />
                <span className="text-xs text-ink-dim uppercase tracking-wide">Takeaways</span>
              </div>
              <div className="text-2xl font-bold text-positive">{advancedStats.takeaways || 0}</div>
              <div className="text-sm text-ink-dim">{formatPer60(advancedStats.takeawaysPer60)} per 60</div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-warning" />
                <span className="text-xs text-ink-dim uppercase tracking-wide">Giveaways</span>
              </div>
              <div className="text-2xl font-bold text-warning">{advancedStats.giveaways || 0}</div>
              <div className="text-sm text-ink-dim">{formatPer60(advancedStats.giveawaysPer60)} per 60</div>
            </div>
          </div>

          {takeawayGiveawayRatio > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-dim">Takeaway/Giveaway Ratio</span>
                <span className={`text-lg font-semibold ${
                  takeawayGiveawayRatio >= 1 ? 'text-positive' : 'text-warning'
                }`}>
                  {takeawayGiveawayRatio.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Faceoff Stats by Zone (Centers only) */}
      {hasFaceoffs && (
        <div className="rounded-lg border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-medium text-ink-dim">Faceoff % by Zone</h3>
          </div>

          <div className="space-y-4">
            {/* Offensive Zone */}
            {advancedStats.offensiveZoneFaceoffPct !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-ink-dim">Offensive Zone</span>
                  <span className="text-lg font-semibold text-positive">
                    {formatPercent(advancedStats.offensiveZoneFaceoffPct)}
                  </span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-positive rounded-full transition-all"
                    style={{ width: `${(advancedStats.offensiveZoneFaceoffPct || 0) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Neutral Zone */}
            {advancedStats.neutralZoneFaceoffPct !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-ink-dim">Neutral Zone</span>
                  <span className="text-lg font-semibold text-accent">
                    {formatPercent(advancedStats.neutralZoneFaceoffPct)}
                  </span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${(advancedStats.neutralZoneFaceoffPct || 0) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Defensive Zone */}
            {advancedStats.defensiveZoneFaceoffPct !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-ink-dim">Defensive Zone</span>
                  <span className="text-lg font-semibold text-negative">
                    {formatPercent(advancedStats.defensiveZoneFaceoffPct)}
                  </span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-negative rounded-full transition-all"
                    style={{ width: `${(advancedStats.defensiveZoneFaceoffPct || 0) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per 60 Stats */}
      <div className="rounded-lg border border-line bg-surface-2 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-ink-dim" />
          <h3 className="text-sm font-medium text-ink-dim">Per 60 Minutes</h3>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xs text-ink-dim uppercase tracking-wide mb-1">Hits</div>
            <div className="text-xl font-bold text-ink-dim">{formatPer60(advancedStats.hitsPer60)}</div>
          </div>

          <div className="text-center">
            <div className="text-xs text-ink-dim uppercase tracking-wide mb-1">Blocks</div>
            <div className="text-xl font-bold text-ink-dim">{formatPer60(advancedStats.blockedShotsPer60)}</div>
          </div>

          <div className="text-center">
            <div className="text-xs text-ink-dim uppercase tracking-wide mb-1">Giveaways</div>
            <div className="text-xl font-bold text-ink-dim">{formatPer60(advancedStats.giveawaysPer60)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
