import { Goal, ShieldCheck, Target } from 'lucide-react';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { goalieStartShare, goalieStatView } from '../../lib/goalieStats';

interface GoalieSeasonSummaryProps {
  player: RosterPlayer;
  compact?: boolean;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface-1 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{label}</p>
      <p className={`scoreboard-number mt-1 text-xl ${accent ? 'text-accent' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

export function GoalieSeasonSummary({ player, compact = false }: GoalieSeasonSummaryProps) {
  const stats = goalieStatView(player);
  // Share of the TEAM's games this goalie started — the workload question that
  // decides whether he is a true starter. Dividing by his own appearances would
  // always land near 100%, which says nothing.
  const teamGames = player.teamGamesPlayed;
  const startRate = goalieStartShare(stats.gamesStarted, teamGames);
  const savesPerStart = stats.gamesStarted > 0 ? stats.saves / stats.gamesStarted : 0;

  return (
    <section className={`rounded-xl border border-accent-muted bg-surface-0 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="scoreboard-text text-accent">Goalie season snapshot</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">Results, ratios, and workload</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-1 px-2.5 py-1 text-xs text-ink-dim">
          <ShieldCheck className="size-3.5 text-accent" aria-hidden="true" />
          {stats.wins}-{stats.losses}-{stats.overtimeLosses}
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
        <Metric label="Save percentage" value={stats.savePercentage > 0 ? stats.savePercentage.toFixed(3).replace(/^0/, '') : '—'} accent />
        <Metric label="Goals-against avg" value={stats.goalsAgainstAverage > 0 ? stats.goalsAgainstAverage.toFixed(2) : '—'} />
        <Metric label="Starts / team games" value={`${stats.gamesStarted} / ${teamGames ?? '—'}`} />
        <Metric label="Saves / start" value={savesPerStart > 0 ? savesPerStart.toFixed(1) : '—'} />
        <Metric label="Shutouts" value={String(stats.shutouts)} />
        <Metric label="Shots faced" value={String(stats.shotsAgainst)} />
      </div>

      {!compact && (
        <div className="mt-4 rounded-lg border border-line bg-surface-1 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-ink-dim"><Goal className="size-3.5" aria-hidden="true" />Start share</span>
            <strong className="scoreboard-number text-ink">{startRate === null ? '—' : `${startRate.toFixed(0)}%`}</strong>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-label={startRate === null ? 'Team games-played data unavailable' : `${startRate.toFixed(0)} percent of team games started`}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${startRate ?? 0}%` }} />
          </div>
          {startRate === null && <p className="mt-2 text-xs text-ink-mute">Team games-played data is unavailable for this stats snapshot.</p>}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-mute"><Target className="size-3.5" aria-hidden="true" />Fantasy value uses your league’s goalie weights, not a skater scoring proxy.</p>
        </div>
      )}
    </section>
  );
}
