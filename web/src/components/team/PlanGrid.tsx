import type { PlannedAdd, PlannerSpot, WeekPlan, WeekPlannerResult } from '../../lib/weekPlanner';

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const longDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const lastName = (name: string) => name.split(' ').slice(-1)[0];

function spotLabel(spot: PlannerSpot, irSlot: string): string {
  if (spot.kind === 'open') return 'Open place';
  if (spot.kind === 'ir') return `${lastName(spot.holder?.full_name ?? '')} → ${irSlot}`;
  return `Drop ${lastName(spot.holder?.full_name ?? '')}`;
}

/**
 * The plan as a day grid: one row per roster place used, one column per day. Each
 * cell shows who holds the place and whether he starts, sits because the lineup is
 * full, or has no game. The header flags nights when your roster already fills the lineup.
 * Built with CSS grid (table roles for assistive tech): the site's legacy global table
 * rules force padding and font sizes on every <table>.
 */
export function PlanGrid({ plan, result, irSlot }: { plan: WeekPlan; result: WeekPlannerResult; irSlot: string }) {
  const usedSpots = result.spots.filter((spot) => plan.adds.some((add) => add.spotId === spot.id));
  const holderOn = (spotId: string, date: string): PlannedAdd | undefined => plan.adds.find((add) => add.spotId === spotId && add.effectiveDate <= date && (add.until === null || date <= add.until));
  const loadByDate = new Map(result.dayLoad.map((day) => [day.date, day]));
  const dailyByDate = new Map(plan.daily.map((day) => [day.date, day]));
  const dense = result.planDates.length > 10;
  const columns = { gridTemplateColumns: `9rem repeat(${result.planDates.length}, minmax(${dense ? '2.25rem' : '3rem'}, 1fr))` };
  const rowHeader = 'sticky left-0 z-10 border-r border-line px-2 py-1.5 text-left text-[11px]';

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-line" role="table" aria-label="Who holds each roster place each day, and whether he starts">
        <div className="grid w-max min-w-full text-center text-[11px]" style={columns} role="row">
          <div role="columnheader" className={`${rowHeader} bg-surface-0 font-medium text-ink-mute`}>Day</div>
          {result.planDates.map((date) => {
            const load = loadByDate.get(date);
            const packed = Boolean(load && load.games >= load.slots);
            return (
              <div key={date} role="columnheader" title={load ? `${longDate(date)}: ${load.games} of your players play, ${load.slots} lineup slots` : longDate(date)} className={`px-0.5 py-1.5 font-medium ${packed ? 'bg-warning-muted text-warning' : 'bg-surface-0 text-ink-mute'}`}>
                <span className="block leading-tight">{weekday(date).slice(0, dense ? 2 : 3)}</span>
                <span className="scoreboard-number block leading-tight text-ink">{Number(date.slice(8))}</span>
                {load && <span className="block text-[9px] font-normal leading-tight">{load.games}/{load.slots}</span>}
              </div>
            );
          })}
        </div>

        {usedSpots.map((spot) => {
          const chain = plan.adds.filter((add) => add.spotId === spot.id);
          return (
            <div key={spot.id} className="grid w-max min-w-full border-t border-line text-center" style={columns} role="row">
              <div role="rowheader" className={`${rowHeader} bg-surface-1`}>
                <span className="block font-semibold text-ink">{spotLabel(spot, irSlot)}</span>
                <span className="block text-[10px] text-ink-mute">{chain.map((add) => lastName(add.add.full_name)).join(' → ')}</span>
              </div>
              {result.planDates.map((date) => {
                const add = holderOn(spot.id, date);
                if (!add) {
                  const holderStillHere = spot.kind === 'stream' && spot.holder;
                  return <div key={date} role="cell" className="bg-surface-1 py-1 text-ink-mute" title={holderStillHere ? `${longDate(date)}: ${spot.holder?.full_name} still on your roster` : longDate(date)}>{holderStillHere ? '·' : ''}</div>;
                }
                const starts = add.startDates.includes(date);
                const plays = add.gameDates.includes(date);
                const first = add.effectiveDate === date;
                const status = starts ? 'starts' : plays ? 'plays, but your lineup is full' : 'no game';
                return (
                  <div
                    key={date}
                    role="cell"
                    title={`${longDate(date)}: ${add.add.full_name} ${status}`}
                    className={`flex flex-col items-center justify-center py-1 ${chain.indexOf(add) % 2 === 0 ? 'bg-accent-muted' : 'bg-positive-muted'} ${first ? 'border-l-2 border-accent' : ''}`}
                  >
                    {first && <span className="max-w-full truncate px-0.5 text-[9px] font-semibold leading-tight text-ink">{lastName(add.add.full_name).slice(0, dense ? 4 : 8)}</span>}
                    <span className={`text-sm leading-none ${starts ? 'text-accent' : 'text-ink-mute'}`} aria-label={status}>{starts ? '●' : plays ? '○' : ''}</span>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="grid w-max min-w-full border-t border-line bg-surface-0 text-center" style={columns} role="row">
          <div role="rowheader" className={`${rowHeader} bg-surface-0 font-medium text-ink-mute`}>Points gained</div>
          {result.planDates.map((date) => {
            const day = dailyByDate.get(date);
            const delta = day ? day.plannedPoints - day.baselinePoints : 0;
            return <div key={date} role="cell" className={`scoreboard-number py-1.5 text-[11px] ${delta > 0.05 ? 'text-positive' : delta < -0.05 ? 'text-negative' : 'text-ink-mute'}`}>{Math.abs(delta) < 0.05 ? '–' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(dense ? 0 : 1)}`}</div>;
          })}
        </div>
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-mute">
        <span><span className="text-accent">●</span> starts</span>
        <span>○ plays, but your lineup is full</span>
        <span><span className="rounded-sm bg-warning-muted px-1 text-warning">Sat</span> your players already fill the lineup (games / slots)</span>
      </p>
    </div>
  );
}
