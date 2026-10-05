import { useMemo, useState, type ReactNode } from 'react';
import { planningWeek, setCandidateAvailability, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { useTimeWindow } from '../../contexts/TimeWindowContext';
import { pickupProjectionWindow } from '../../hooks/useAcquisitionRecommendations';
import { usePickupFinder, type PickupFinderResult } from '../../hooks/usePickupFinder';
import { addDays, finderDays, weeklySpots, type AddAdvice, type Pickup } from '../../lib/pickupFinder';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import { Button } from '../ui/button';
import { PlayerNameLink } from './PlayerNameLink';

const FORWARDS = new Set(['C', 'LW', 'RW', 'F', 'W']);
const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const shortDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
const fills = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const openText = (open: Record<string, number>) => Object.entries(open).map(([slot, count]) => `${count > 1 ? `${count} ` : ''}${slot}`).join(', ');

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** The pickup days from the shared date range (the same one as the header), never before today. */
export function useFinderDays(workspace: LeagueWorkspace): string[] {
  const { state } = useTimeWindow();
  const window = pickupProjectionWindow(state);
  return useMemo(() => datesBetween(window.start, [window.end, workspace.season.end].sort()[0]), [window.start, window.end, workspace.season.end]);
}

/** "Use 3 of 4 adds now · hold 1" with the plan and the reason. */
export function AddAdviceSummary({ advice, compact = false, onOpenPlayer }: { advice: AddAdvice; compact?: boolean; onOpenPlayer?: (player: RosterPlayer) => void }) {
  const { remaining, use, hold, plan, marginal, holdValue, holdReason } = advice;
  const reason = holdReason === 'late' ? 'for a pickup on the last days of the week' : holdReason === 'injury' ? 'to replace a starter who gets hurt' : '';
  const headline = remaining === null
    ? (use ? `Make ${use} move${use === 1 ? '' : 's'} this week` : 'No move is worth making right now')
    : remaining === 0 ? 'No adds left this week'
      : use === 0 ? `Hold your ${remaining} add${remaining === 1 ? '' : 's'}`
        : `Use ${use} of your ${remaining} add${remaining === 1 ? '' : 's'} now${hold ? ` · hold ${hold}` : ''}`;
  const next = marginal[use];
  const why = remaining === 0 ? 'Your add limit resets at the start of next week.'
    : use === 0 && next !== undefined ? `The best move adds ${signed(next)} pts; keeping an add is worth about ${signed(holdValue)} ${reason}.`
      : hold > 0 && next !== undefined ? `The next add would gain ${signed(next)} pts; keeping it is worth about ${signed(holdValue)} ${reason}.`
        : use > 0 ? 'Every add left is worth making now.' : '';
  return (
    <div className="rounded-lg border border-accent/40 bg-surface-2 p-3">
      <p className="scoreboard-text text-accent">THIS WEEK'S ADDS</p>
      <p className="mt-1 text-base font-semibold text-ink">{headline}{plan && <span className="ml-2 scoreboard-number text-positive">{signed(plan.gain)} pts</span>}</p>
      {why && <p className="mt-0.5 text-xs text-ink-dim">{why}</p>}
      {plan && !compact && (
        <ol className="mt-2 space-y-1 text-sm">
          {plan.adds.map((add) => (
            <li key={`${add.spotId}-${add.add.id}`} className="flex flex-wrap items-baseline gap-x-2 text-ink">
              <span className="text-xs text-ink-mute">{dayLabel(add.actionDate)}</span>
              <span>Add <strong><PlayerNameLink player={add.add} onOpen={onOpenPlayer} /></strong></span>
              <span className="text-xs text-ink-dim">{add.drop ? <>drop <PlayerNameLink player={add.drop} onOpen={onOpenPlayer} /></> : 'no drop'} · {add.startDates.length} start{add.startDates.length === 1 ? '' : 's'}{add.until ? `, until ${shortDay(add.until)}` : ''}</span>
            </li>
          ))}
        </ol>
      )}
      {plan && plan.adds.length > 1 && !compact && <p className="mt-1 text-[11px] text-ink-mute">These adds are worked out together: some share one roster spot in turn, some replace a player for the whole week.</p>}
    </div>
  );
}

function PickupRow({ pickup, onOpenPlayer, onTaken }: { pickup: Pickup; onOpenPlayer?: (player: RosterPlayer) => void; onTaken: () => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <p className="min-w-0 truncate text-sm font-semibold text-ink">
        <PlayerNameLink player={pickup.rosterPlayer} onOpen={onOpenPlayer} />
        <span className="ml-1.5 text-[11px] font-normal text-ink-mute">{pickup.player.team} · {pickup.player.pos.join('/')}</span>
        {pickup.likelyOnWaivers && <span className="ml-1.5 rounded border border-warning/50 px-1 text-[10px] font-semibold text-warning" title={`Probably on waivers: can play for you from ${dayLabel(pickup.availableFrom)}`}>Waivers</span>}
      </p>
      <p className="row-span-2 self-center text-right">
        <span className="scoreboard-number block text-base font-bold text-positive">{signed(pickup.gain)}</span>
        <span className="text-[11px] text-ink-mute">pts</span>
      </p>
      <p className="min-w-0 text-xs text-ink-dim">
        {pickup.percentOwned !== null && <>{pickup.percentOwned}% owned · </>}
        {pickup.games} game{pickup.games === 1 ? '' : 's'} · <strong className="text-ink">fills {fills(pickup.fills)}</strong> · {pickup.drop ? <>drop <PlayerNameLink player={pickup.drop} onOpen={onOpenPlayer} /></> : 'no drop needed'}
        <button type="button" onClick={onTaken} className="ml-2 text-[11px] font-semibold text-ink-mute underline-offset-2 hover:text-warning hover:underline" aria-label={`Mark ${pickup.player.name} taken`}>Taken?</button>
      </p>
    </div>
  );
}

const RANGES = [['week', 'Rest of this week'], ['next', 'Next week'], ['14d', 'Next 2 weeks'], ['season', 'Rest of season']] as const;

/**
 * Pickups, gaps first: this week's add advice, your open lineup spots by day (by week for
 * long ranges), then every unrostered player who'd help, sortable and filterable. The date
 * range is the page's shared one, so the header, the spots and the list always agree.
 */
export function PickupFinder({ workspace, directory, onOpenPlayer, planSeveral, result: shared }: { workspace: LeagueWorkspace; directory: PlayerSearchResult[] | undefined; onOpenPlayer?: (player: RosterPlayer) => void; planSeveral?: ReactNode; /** The page's own finder result, when it already computes one. */ result?: PickupFinderResult }) {
  const { updateLeague } = useLeagueWorkspace();
  const { setPreset, setCustomRange } = useTimeWindow();
  const days = useFinderDays(workspace);
  const own = usePickupFinder({ workspace, directory: shared ? undefined : directory, days });
  const result = shared ?? own;
  const [position, setPosition] = useState<'all' | 'F' | 'D' | 'G'>('all');
  const [sort, setSort] = useState<'pts' | 'fills' | 'owned'>('pts');
  const [focus, setFocus] = useState<string | null>(null);
  const [shown, setShown] = useState(20);

  const activeRange = RANGES.find(([range]) => finderDays(workspace, range).join(',') === days.join(','))?.[0] ?? null;
  const chooseRange = (range: typeof RANGES[number][0]) => {
    setFocus(null);
    if (range === 'week') setPreset('rest-of-week');
    else if (range === '14d') setPreset('14d');
    else if (range === 'season') setPreset('rest-of-season');
    else {
      const week = planningWeek(workspace);
      setCustomRange({ start: week.nextStart, end: week.nextEnd });
    }
  };
  const markTaken = (pickup: Pickup) => {
    const now = new Date().toISOString();
    updateLeague({ ...workspace, candidates: setCandidateAvailability(workspace.candidates, { id: pickup.player.id, team: pickup.player.team, position: pickup.player.pos[0] }, 'taken', now), updatedAt: now });
  };

  const weekly = days.length > 14;
  const cards = weekly
    ? weeklySpots(workspace, result.spots).map((week) => ({ key: week.start, title: `${dayLabel(week.start).replace(/^\w+, /, '')}–${dayLabel(week.end).replace(/^\w+, /, '')}`, openTotal: week.openTotal, open: week.open, sub: 'open spots', dates: datesBetween(week.start, week.end) }))
    : result.spots.map((day) => ({ key: day.date, title: dayLabel(day.date), openTotal: day.openTotal, open: day.open, sub: `${day.playing} of yours play`, dates: [day.date] }));
  const focusDates = cards.find((card) => card.key === focus)?.dates ?? null;
  const totalOpen = result.spots.reduce((sum, day) => sum + day.openTotal, 0);

  const rows = useMemo(() => {
    let list = result.pickups.filter((pickup) => position === 'all' || (position === 'F' ? pickup.player.pos.some((pos) => FORWARDS.has(pos)) : pickup.player.pos.includes(position)));
    if (focusDates) list = list.filter((pickup) => pickup.startDates.some((date) => focusDates.includes(date)));
    return [...list].sort(sort === 'pts' ? (a, b) => b.gain - a.gain
      : sort === 'fills' ? (a, b) => b.fills - a.fills || b.gain - a.gain
        : (a, b) => (a.percentOwned ?? 100) - (b.percentOwned ?? 100) || b.gain - a.gain);
  }, [focusDates, position, result.pickups, sort]);

  return (
    <section id="pickup-board" className="space-y-4 rounded-lg border border-line bg-surface-glass p-4 shadow-raised [backdrop-filter:var(--frost)]" aria-labelledby="pickup-finder-title">
      <div>
        <p className="scoreboard-text text-accent">PICKUPS</p>
        <h2 id="pickup-finder-title" className="mt-1 text-xl font-semibold text-ink">Who fills your open spots</h2>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-0 p-1" role="group" aria-label="Date range">
        {RANGES.map(([range, label]) => (
          <button key={range} type="button" aria-pressed={activeRange === range} onClick={() => chooseRange(range)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${activeRange === range ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {result.advice && <AddAdviceSummary advice={result.advice} onOpenPlayer={onOpenPlayer} />}

      <FinderStatus result={result} />

      {cards.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-ink">{totalOpen} open lineup spot{totalOpen === 1 ? '' : 's'} <span className="font-normal text-ink-dim">· {dayLabel(days[0])} to {dayLabel(days[days.length - 1])} · tap a {weekly ? 'week' : 'day'} to see who fills it</span></p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={`Your open spots by ${weekly ? 'week' : 'day'}`}>
            {cards.map((card) => (
              <button key={card.key} type="button" aria-pressed={focus === card.key} onClick={() => setFocus(focus === card.key ? null : card.key)} className={`min-w-[6.5rem] shrink-0 rounded-lg border px-2.5 py-2 text-left ${focus === card.key ? 'border-accent bg-accent-muted' : 'border-line bg-surface-2 hover:border-accent'}`}>
                <span className="block text-[11px] font-semibold text-ink-dim">{card.title}</span>
                <span className={`scoreboard-number block text-xl font-bold ${card.openTotal ? 'text-positive' : 'text-ink-mute'}`}>{card.openTotal}</span>
                <span className="block min-h-[1em] text-[11px] text-ink-dim">{openText(card.open) || 'Full'}</span>
                <span className="block text-[10px] text-ink-mute">{card.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {result.status !== 'loading' && result.status !== 'error' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Position">
              {(['all', 'F', 'D', 'G'] as const).map((value) => <Button key={value} type="button" size="sm" variant={position === value ? 'primary' : 'ghost'} aria-pressed={position === value} onClick={() => setPosition(value)}>{value === 'all' ? 'All' : value}</Button>)}
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Sort">
              {([['pts', 'Most points'], ['fills', 'Fills most gaps'], ['owned', 'Least owned']] as const).map(([value, label]) => <Button key={value} type="button" size="sm" variant={sort === value ? 'primary' : 'ghost'} aria-pressed={sort === value} onClick={() => setSort(value)}>{label}</Button>)}
            </div>
          </div>
          <p className="text-xs text-ink-mute">{focusDates ? `Players who'd be in your lineup on ${cards.find((card) => card.key === focus)?.title}. Tap it again to clear.` : `${rows.length} player${rows.length === 1 ? '' : 's'} would help. "Fills" counts games he'd be in your lineup, not on your bench; goalies count expected starts.`}</p>
          {rows.slice(0, shown).map((pickup) => <PickupRow key={pickup.player.id} pickup={pickup} onOpenPlayer={onOpenPlayer} onTaken={() => markTaken(pickup)} />)}
          {result.status === 'ready' && rows.length === 0 && <p className="rounded-lg border border-dashed border-line p-3 text-sm text-ink-dim">Nobody available improves your lineup here. Try another range, position or day.</p>}
          {rows.length > shown && <Button type="button" size="sm" variant="ghost" onClick={() => setShown((count) => count + 20)}>Show more</Button>}
        </div>
      )}

      {planSeveral && (
        <details className="rounded-lg border border-line bg-surface-1">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ink">Plan several adds: team chains, week by week</summary>
          {planSeveral}
        </details>
      )}
    </section>
  );
}

function FinderStatus({ result }: { result: PickupFinderResult }) {
  if (result.status === 'error') return <p className="text-sm text-warning">The NHL schedule couldn't be loaded, so pickups can't be worked out. Try again shortly.</p>;
  if (result.status === 'loading') return <p className="text-sm text-ink-dim">Loading players and the schedule…</p>;
  if (result.status === 'working') return <p className="text-sm text-ink-dim">Working out who fits your lineup…</p>;
  return null;
}
