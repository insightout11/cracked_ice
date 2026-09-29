import React from 'react';
import type { WeekCell, WeekShare } from '../lib/weekShare';
import { CARD, CardBackdrop, SvgText, logoUrl } from './shareFrameParts';

const WIDTH = 1080;
const PAD = 54;
const INNER = WIDTH - PAD * 2;
const DAY = 74;
const COUNT = 64;
const NAME = INNER - DAY * 7 - COUNT;

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const monthDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function Dot({ cell, size }: { cell: WeekCell; size: number }) {
  if (!cell) return <span className="block rounded-full" style={{ width: 6, height: 6, background: 'rgba(166, 243, 255, 0.18)' }} />;
  if (cell === 'bench') return <span className="block rounded-full" style={{ width: size, height: size, border: `3px solid ${CARD.warning}` }} />;
  return <span className="block rounded-full" style={{ width: size, height: size, background: cell === 'off-start' ? CARD.accent : CARD.ink }} />;
}

function Stat({ value, label }: { value: number; label: string }) {
  const width = (INNER - 36) / 4;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-1 px-5 py-4">
      <SvgText text={String(value)} width={width - 40} size={46} weight={800} />
      <SvgText text={label} width={width - 40} size={18} weight={500} color={CARD.dim} />
    </div>
  );
}

/**
 * The matchup week at a glance, for "rate my week" posts: each player's games, which
 * start (off-nights in the accent colour) and which sit because the lineup is full.
 * Fixed-size rows with SVG text, so html2canvas lines everything up.
 */
export const WeekShareFrame: React.FC<{ week: WeekShare; teamName: string }> = ({ week, teamName }) => {
  const rows = week.rows.slice(0, 18);
  const rowHeight = rows.length <= 12 ? 60 : rows.length <= 16 ? 52 : 44;
  const dot = rowHeight <= 46 ? 20 : 24;
  const logo = rowHeight <= 46 ? 26 : 30;
  return (
    <div className="relative flex h-[1350px] w-[1080px] flex-col overflow-hidden bg-surface-0 text-ink">
      <CardBackdrop />
      <header className="relative flex items-start justify-between pt-12" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-9 w-auto opacity-90" />
        <div className="flex flex-col items-end gap-1">
          <SvgText text="MY WEEK" width={260} size={18} weight={800} color={CARD.accent} anchor="end" letterSpacing={2} />
          <SvgText text={`${monthDay(week.dates[0])} – ${monthDay(week.dates[6])}`} width={300} size={20} weight={500} color={CARD.dim} anchor="end" />
        </div>
      </header>

      <section className="relative mt-8 flex flex-col gap-2" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        <SvgText text="RATE MY WEEK" width={INNER} size={84} weight={900} />
        {teamName && <SvgText text={teamName} width={INNER} size={26} weight={500} color={CARD.dim} />}
        <div className="mt-5 grid grid-cols-4 gap-3">
          <Stat value={week.starts} label="lineup starts" />
          <Stat value={week.games} label="games" />
          <Stat value={week.offNightStarts} label="off-night starts" />
          <Stat value={week.busyNights} label={week.busyNights === 1 ? 'busy night' : 'busy nights'} />
        </div>
      </section>

      <main className="relative mt-8" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        <div className="flex items-center" style={{ height: 34 }}>
          <div style={{ width: NAME }} />
          {week.dates.map((date) => <SvgText key={date} text={weekday(date)} width={DAY} size={18} weight={700} color={CARD.dim} anchor="middle" />)}
          <SvgText text="starts" width={COUNT} size={15} weight={600} color={CARD.mute} anchor="end" />
        </div>
        {rows.map((row) => (
          <div key={row.player.id} className="flex items-center border-t border-line" style={{ height: rowHeight }}>
            <div className="flex items-center" style={{ width: NAME }}>
              <img src={logoUrl(row.player.team)} alt="" crossOrigin="anonymous" className="shrink-0 object-contain" style={{ width: logo, height: logo }} />
              <div className="ml-3">
                <SvgText spans={[{ text: row.player.full_name }, { text: `  ${row.player.positions.join('/')}`, color: CARD.mute, weight: 500 }]} width={NAME - logo - 24} size={21} weight={700} />
              </div>
            </div>
            {row.cells.map((cell, index) => (
              <div key={week.dates[index]} className="flex items-center justify-center" style={{ width: DAY, height: rowHeight }}><Dot cell={cell} size={dot} /></div>
            ))}
            <SvgText text={String(row.starts)} width={COUNT} size={22} weight={800} anchor="end" />
          </div>
        ))}
      </main>

      <footer className="relative mb-10 mt-auto flex items-center justify-between border-t border-line pt-6" style={{ marginLeft: PAD, marginRight: PAD }}>
        <div className="flex items-center gap-7">
          <span className="flex items-center gap-2"><Dot cell="start" size={16} /><SvgText text="starts" width={80} size={17} weight={500} color={CARD.dim} /></span>
          <span className="flex items-center gap-2"><Dot cell="off-start" size={16} /><SvgText text="off-night start" width={160} size={17} weight={500} color={CARD.dim} /></span>
          <span className="flex items-center gap-2"><Dot cell="bench" size={16} /><SvgText text="plays, lineup full" width={190} size={17} weight={500} color={CARD.dim} /></span>
        </div>
        <SvgText text="crackedicehockey.com" width={260} size={18} weight={500} color={CARD.mute} anchor="end" />
      </footer>
    </div>
  );
};
