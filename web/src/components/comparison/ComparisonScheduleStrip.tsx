import { useMemo } from 'react';
import type { ComparisonOption } from '../../lib/playerComparisonAnalysis';

interface ComparisonScheduleStripProps {
  optionA: ComparisonOption;
  optionB: ComparisonOption;
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let cursor = Date.parse(`${start}T12:00:00Z`); cursor <= Date.parse(`${end}T12:00:00Z`); cursor += DAY_MS) dates.push(new Date(cursor).toISOString().slice(0, 10));
  return dates;
}

export function ComparisonScheduleStrip({ optionA, optionB, start, end }: ComparisonScheduleStripProps) {
  const dates = useMemo(() => datesBetween(start, end), [end, start]);
  const daily = dates.length <= 35;
  const columns = useMemo(() => {
    if (daily) return dates.map((date) => ({ label: date.slice(5), dates: [date] }));
    const weeks: Array<{ label: string; dates: string[] }> = [];
    dates.forEach((date, index) => {
      if (index % 7 === 0) weeks.push({ label: date.slice(5), dates: [] });
      weeks[weeks.length - 1].dates.push(date);
    });
    return weeks;
  }, [daily, dates]);
  const rows = [optionA, optionB];

  return (
    <div className="rounded-xl border border-line bg-surface-0 p-4">
      <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-ink-dim"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-positive" />Usable start</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-negative" />Blocked game</span><span><i className="mr-1.5 inline-block size-2 rounded-full border border-accent bg-accent-muted" />Off-night</span></div>
      <div className="overflow-x-auto">
        <div className="min-w-[42rem]" style={{ width: `${Math.max(672, 130 + columns.length * (daily ? 24 : 46))}px` }}>
          <div className="grid items-center gap-1" style={{ gridTemplateColumns: `126px repeat(${columns.length}, minmax(20px, 1fr))` }}>
            <span />
            {columns.map((column, index) => <span key={`${column.label}-${index}`} className="pb-1 text-center font-mono text-[9px] text-ink-mute">{column.label}</span>)}
            {rows.flatMap((option) => {
              const games = new Map(option.schedule.map((game) => [game.date, game]));
              return [<strong key={`${option.player.id}-label`} className="truncate pr-2 text-xs text-ink">{option.player.full_name}</strong>, ...columns.map((column, index) => {
                const columnGames = column.dates.map((date) => games.get(date)).filter(Boolean);
                const usable = columnGames.filter((game) => game?.usable).length;
                const blocked = columnGames.length - usable;
                const offNight = columnGames.some((game) => game?.isOffNight);
                const label = columnGames.length === 0 ? `${option.player.full_name}: no game` : `${option.player.full_name}: ${usable} usable, ${blocked} blocked${offNight ? ', includes off-night' : ''}`;
                return <span key={`${option.player.id}-${index}`} title={label} aria-label={label} className={`mx-auto flex h-6 w-full max-w-9 items-center justify-center rounded-md border ${columnGames.length === 0 ? 'border-line/50 bg-surface-1' : blocked > 0 && usable === 0 ? 'border-negative/60 bg-negative-muted' : offNight ? 'border-accent bg-positive-muted' : 'border-positive/60 bg-positive-muted'}`}>
                  {columnGames.length > 0 && <span className={`size-2 rounded-full ${usable > 0 ? 'bg-positive' : 'bg-negative'}`} />}
                </span>;
              })];
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
