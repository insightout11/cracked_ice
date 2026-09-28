import React from 'react';
import type { WeekCell, WeekShare } from '../lib/weekShare';

const dayLetter = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const monthDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function Cell({ cell, size }: { cell: WeekCell; size: number }) {
  if (!cell) return <span className="block rounded-full bg-line/40" style={{ width: size * 0.28, height: size * 0.28 }} />;
  if (cell === 'bench') return <span className="block rounded-full border-[3px] border-warning" style={{ width: size, height: size }} />;
  return <span className={`block rounded-full ${cell === 'off-start' ? 'bg-accent' : 'bg-ink'}`} style={{ width: size, height: size }} />;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-1 px-5 py-4">
      <strong className="block font-mono text-[44px] leading-none text-ink">{value}</strong>
      <span className="mt-2 block text-[17px] text-ink-dim">{label}</span>
    </div>
  );
}

/**
 * The matchup week at a glance, for "rate my week" posts: each player's games, which
 * start (off-nights in the accent colour) and which sit because the lineup is full.
 */
export const WeekShareFrame: React.FC<{ week: WeekShare; teamName: string }> = ({ week, teamName }) => {
  const rows = week.rows.slice(0, 18);
  const rowHeight = rows.length <= 12 ? 60 : rows.length <= 16 ? 50 : 42;
  const dot = rowHeight <= 44 ? 20 : 24;
  return (
    <div className="relative flex h-[1350px] w-[1080px] flex-col overflow-hidden bg-surface-0 font-sans text-ink">
      <div className="absolute inset-0 bg-gradient-to-br from-surface-0 via-surface-1 to-surface-0" />
      <img src="/hockey-rink-bg.png" alt="" className="absolute inset-0 size-full object-cover opacity-[0.06]" />

      <header className="relative flex items-center justify-between px-14 pt-12">
        <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-9 w-auto opacity-90" />
        <div className="text-right">
          <p className="scoreboard-text text-base text-accent">MY WEEK</p>
          <p className="mt-1 font-mono text-lg text-ink-dim">{monthDay(week.dates[0])} – {monthDay(week.dates[6])}</p>
        </div>
      </header>

      <section className="relative px-14 pt-9">
        <h1 className="text-[76px] font-black uppercase leading-none tracking-tight">Rate my week</h1>
        {teamName && <p className="mt-3 text-[24px] text-ink-dim">{teamName}</p>}
        <div className="mt-7 grid grid-cols-4 gap-3">
          <Stat value={week.starts} label="lineup starts" />
          <Stat value={week.games} label="games" />
          <Stat value={week.offNightStarts} label="off-night starts" />
          <Stat value={week.busyNights} label={week.busyNights === 1 ? 'busy night' : 'busy nights'} />
        </div>
      </section>

      <main className="relative mt-7 flex-1 px-14">
        <div className="grid items-center" style={{ gridTemplateColumns: '1fr repeat(7, 74px) 70px' }}>
          <span />
          {week.dates.map((date) => <span key={date} className="text-center text-[17px] font-bold text-ink-dim">{dayLetter(date)}</span>)}
          <span className="text-right text-[15px] text-ink-mute">starts</span>
          {rows.map((row) => (
            <React.Fragment key={row.player.id}>
              <span className="flex min-w-0 items-center gap-3 border-t border-line/60" style={{ height: rowHeight }}>
                <img src={`/api/coach/share-assets/logo/${row.player.team}`} alt="" crossOrigin="anonymous" className="size-7 shrink-0 object-contain" />
                <span className="truncate text-[21px] font-bold">{row.player.full_name}</span>
                <span className="shrink-0 text-[16px] text-ink-mute">{row.player.positions.join('/')}</span>
              </span>
              {row.cells.map((cell, index) => (
                <span key={week.dates[index]} className="grid place-items-center border-t border-line/60" style={{ height: rowHeight }}><Cell cell={cell} size={dot} /></span>
              ))}
              <span className="border-t border-line/60 text-right font-mono text-[22px] font-bold" style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}>{row.starts}</span>
            </React.Fragment>
          ))}
        </div>
      </main>

      <footer className="relative mx-14 mb-10 mt-4 flex items-end justify-between border-t border-line pt-6">
        <div className="flex items-center gap-6 text-[17px] text-ink-dim">
          <span className="flex items-center gap-2"><Cell cell="start" size={16} />starts</span>
          <span className="flex items-center gap-2"><Cell cell="off-start" size={16} />off-night start</span>
          <span className="flex items-center gap-2"><Cell cell="bench" size={16} />plays, lineup full</span>
        </div>
        <p className="font-mono text-[17px] text-ink-mute">crackedicehockey.com</p>
      </footer>
    </div>
  );
};
