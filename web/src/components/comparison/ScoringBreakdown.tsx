import type { DraftPlayer } from '../../lib/playerSearch';

const LABELS: Record<string, string> = {
  goals: 'Goals', assists: 'Assists', points: 'Points', shots_on_goal: 'Shots',
  power_play_points: 'PP points', power_play_goals: 'PP goals', power_play_assists: 'PP assists',
  shorthanded_goals: 'SH goals', shorthanded_assists: 'SH assists', shorthanded_points: 'SH points',
  game_winning_goals: 'Game winners', hits: 'Hits', blocks: 'Blocks', plus_minus: '+/-',
  wins: 'Wins', losses: 'Losses', overtime_losses: 'OT losses', saves: 'Saves',
  goals_against: 'Goals against', shutouts: 'Shutouts', games_started: 'Goalie starts',
};

interface ScoringBreakdownProps {
  player: DraftPlayer;
}

export function ScoringBreakdown({ player }: ScoringBreakdownProps) {
  const breakdown = player.scoringBreakdown;
  if (!breakdown) return <p className="text-xs text-ink-mute">A category calculation is unavailable for this player.</p>;

  return <details className="mt-3 rounded-lg border border-line bg-surface-0 p-3">
    <summary className="cursor-pointer text-xs font-semibold text-accent">How {breakdown.fppg.toFixed(2)} FPPG is calculated</summary>
    <p className="mt-2 text-[11px] text-ink-mute">Season totals × your league weights ÷ {breakdown.gamesPlayed} games.</p>
    <div className="mt-3 space-y-2">
      {breakdown.contributions.map((contribution) => <div key={contribution.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs">
        <span className="min-w-0 text-ink-dim"><strong className="text-ink">{LABELS[contribution.key] ?? contribution.key}</strong> · {contribution.stat} × {contribution.weight}</span>
        <span className={contribution.fppg < 0 ? 'font-mono text-negative' : 'font-mono text-accent'}>{contribution.fppg >= 0 ? '+' : ''}{contribution.fppg.toFixed(2)}</span>
      </div>)}
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs font-bold text-ink"><span>Total per game</span><span className="font-mono text-accent">{breakdown.fppg.toFixed(2)}</span></div>
  </details>;
}
