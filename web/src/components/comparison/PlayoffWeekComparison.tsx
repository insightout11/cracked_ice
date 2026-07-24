import { CalendarRange, Trophy } from 'lucide-react';
import type { DraftCandidateScore } from '../../lib/draftStrategy';

interface PlayoffWeekComparisonProps {
  candidates: Array<{ name: string; score: DraftCandidateScore }>;
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export function PlayoffWeekComparison({ candidates }: PlayoffWeekComparisonProps) {
  const weeks = candidates[0]?.score.metrics.playoffWeeks ?? [];
  if (!weeks.length) return null;
  const maxStarts = Math.max(1, ...candidates.flatMap(({ score }) => score.metrics.playoffWeeks.map((week) => week.usableStarts)));
  return <section className="mt-5 border-t border-line pt-5" aria-labelledby="playoff-week-heading">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="scoreboard-text flex items-center gap-1.5 text-positive"><Trophy size={13} />Fantasy playoffs</p><h3 id="playoff-week-heading" className="mt-1 text-base font-semibold text-ink">Matchup-by-matchup value</h3></div><p className="text-xs text-ink-mute">Usable starts account for the roster and daily-slot congestion modeled above.</p></div>
    <div className="mt-3 overflow-x-auto pb-1"><div className="grid min-w-[34rem] gap-2" style={{ gridTemplateColumns: `minmax(8rem,1.15fr) repeat(${weeks.length}, minmax(7rem,1fr))` }}>
      <div className="rounded-lg border border-line bg-surface-0 p-3"><CalendarRange size={16} className="text-accent" /><p className="mt-2 text-[10px] text-ink-mute">Configured window</p><p className="text-xs font-semibold text-ink">{shortDate(weeks[0].start)}–{shortDate(weeks[weeks.length - 1].end)}</p></div>
      {weeks.map((week) => <div key={week.start} className={`rounded-lg border p-3 ${week.isChampionship ? 'border-positive bg-positive-muted' : 'border-line bg-surface-0'}`}><p className={`text-[10px] font-bold uppercase tracking-wide ${week.isChampionship ? 'text-positive' : 'text-accent'}`}>{week.label}</p><p className="mt-1 text-[10px] text-ink-mute">{shortDate(week.start)}–{shortDate(week.end)}</p></div>)}
      {candidates.map(({ name, score }) => <div key={name} className="contents"><div className="flex items-center rounded-lg border border-line bg-surface-0 px-3 py-2"><strong className="truncate text-xs text-ink">{name}</strong></div>{score.metrics.playoffWeeks.map((week) => <div key={`${name}-${week.start}`} className={`rounded-lg border px-3 py-2 ${week.isChampionship ? 'border-positive/50 bg-positive-muted' : 'border-line bg-surface-0'}`}><div className="flex items-baseline justify-between gap-2"><strong className={`font-mono text-lg ${week.isChampionship ? 'text-positive' : 'text-ink'}`}>{week.usableStarts}</strong><span className="text-[9px] text-ink-mute">of {week.games} games</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${week.isChampionship ? 'bg-positive' : 'bg-accent'}`} style={{ width: `${(week.usableStarts / maxStarts) * 100}%` }} /></div><p className="mt-1.5 text-[9px] text-ink-mute">{week.offNights} off-night</p></div>)}</div>)}
    </div></div>
  </section>;
}
