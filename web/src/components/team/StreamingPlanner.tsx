import { useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarRange, HeartPulse, Plus, X } from 'lucide-react';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import { setCandidateAvailability, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { seasonValue, type PlannedAdd, type PlannerHorizon, type WeekPlan, type WeekPlannerResult } from '../../lib/weekPlanner';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { useWeekPlanner } from '../../hooks/useWeekPlanner';
import type { AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import { Button } from '../ui/button';

interface StreamingPlannerProps {
  workspace: LeagueWorkspace;
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  recommendations: AcquisitionRecommendationResult;
  compact?: boolean;
}

const normalizeId = (id: string) => id.replace(/^nhl:/, '');

function displayDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function signed(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;
}

function irSlotLabel(workspace: LeagueWorkspace): string {
  return Object.keys(workspace.rosterRules.slots).find((slot) => slot.toUpperCase().startsWith('IR') && workspace.rosterRules.slots[slot] > 0) ?? 'IR';
}

function AddStep({ add, nextWeekStart, onAvailability }: { add: PlannedAdd; nextWeekStart: string; onAvailability: (player: RosterPlayer, status: 'available' | 'taken') => void }) {
  const sameDay = add.actionDate === add.effectiveDate;
  return (
    <li className="rounded-md border border-line bg-surface-0 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
        {displayDate(add.actionDate)}{sameDay ? '' : ` · plays from ${displayDate(add.effectiveDate)}`}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink">
        <strong>Add {add.add.full_name}</strong>
        <span className="text-ink-mute">{add.add.team} · {add.add.positions.join('/')}</span>
        {add.drop && <><ArrowRight size={14} className="text-accent" aria-hidden="true" /><span className="text-ink-dim">drop {add.drop.full_name}</span></>}
      </p>
      <p className="mt-1 text-xs text-ink-dim">
        {add.starts} start{add.starts === 1 ? '' : 's'} in the window · {signed(add.points)} pts
        {add.playsNextWeekStart ? ` · also plays ${displayDate(nextWeekStart)}, already on your roster when adds reset` : ''}
      </p>
      {add.confirmed ? (
        <p className="mt-1 text-[11px] text-positive">Marked available · recheck before you add him</p>
      ) : (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-warning">
          Check he's available in your league:
          <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onAvailability(add.add, 'available')}>Available</button>
          <span aria-hidden="true">·</span>
          <button type="button" className="font-semibold text-ink-dim hover:text-negative hover:underline" onClick={() => onAvailability(add.add, 'taken')}>Taken</button>
        </p>
      )}
    </li>
  );
}

function PlanView({ plan, result, workspace, onAvailability }: { plan: WeekPlan; result: WeekPlannerResult; workspace: LeagueWorkspace; onAvailability: (player: RosterPlayer, status: 'available' | 'taken') => void }) {
  const lineupEffect = plan.gain - plan.pickupPoints + plan.droppedPoints;
  const irSlot = irSlotLabel(workspace);
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-md border border-line bg-surface-0 p-3">
        <p className="text-sm text-ink">
          <strong className="scoreboard-number text-lg text-positive">{signed(plan.gain)}</strong> pts {result.horizon === 'week' ? 'this week' : 'in this window'} over making no moves
          <span className="text-ink-dim"> ({plan.starts} lineup starts, {signed(plan.startsGain, 0)})</span>
        </p>
        <p className="mt-1 text-xs text-ink-dim">
          {signed(plan.pickupPoints)} from pickups
          {plan.droppedPoints > 0 ? ` · −${plan.droppedPoints.toFixed(1)} the dropped players would have scored` : ''}
          {Math.abs(lineupEffect) >= 0.05 ? ` · ${signed(lineupEffect)} lineup shuffle` : ''}
        </p>
      </div>

      <ol className="space-y-2">
        {plan.irMoves.map((move) => (
          <li key={move.spotId} className="rounded-md border border-line bg-surface-0 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">First · free move</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink"><HeartPulse size={14} className="text-warning" aria-hidden="true" /><strong>Move {move.player.full_name} to {irSlot}</strong><span className="text-ink-mute">({move.status})</span></p>
            <p className="mt-1 text-xs text-ink-dim">{move.holderPlays ? 'Day-to-day: he may play, and it costs his games from then on.' : 'Opens a roster place without dropping anyone.'} He needs a place when he returns.</p>
          </li>
        ))}
        {plan.adds.map((add) => <AddStep key={`${add.spotId}-${add.add.id}-${add.effectiveDate}`} add={add} nextWeekStart={result.week.nextStart} onAvailability={onAvailability} />)}
      </ol>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[26rem] text-left text-xs">
          <caption className="sr-only">Projected points each day, with no moves and with this plan</caption>
          <thead className="bg-surface-0 text-ink-mute"><tr><th className="px-3 py-2">Day</th><th className="px-3 py-2">No moves</th><th className="px-3 py-2">This plan</th><th className="px-3 py-2">Change</th></tr></thead>
          <tbody className="divide-y divide-line">
            {plan.daily.map((day) => {
              const delta = day.plannedPoints - day.baselinePoints;
              return (
                <tr key={day.date} className={day.adds.length ? 'bg-accent-muted' : 'bg-surface-1'}>
                  <td className="px-3 py-2 text-ink">{displayDate(day.date)}{day.adds.length ? ` · ${day.adds.map((add) => add.add.full_name.split(' ').pop()).join(', ')} in` : ''}</td>
                  <td className="px-3 py-2 text-ink-dim">{day.baselineStarts} · {day.baselinePoints.toFixed(1)}</td>
                  <td className="px-3 py-2 text-ink">{day.plannedStarts} · {day.plannedPoints.toFixed(1)}</td>
                  <td className={`px-3 py-2 ${delta > 0.05 ? 'text-positive' : delta < -0.05 ? 'text-negative' : 'text-ink-mute'}`}>{signed(delta)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {result.alternatives[plan.addCount]?.length ? (
        <div>
          <p className="text-xs font-semibold text-ink">If a target is taken</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {result.alternatives[plan.addCount].map((alternative) => (
              <span key={alternative.adds.map((add) => `${add.add.id}@${add.effectiveDate}`).join('|')} className="rounded-full border border-line bg-surface-0 px-3 py-1 text-xs text-ink-dim">
                {alternative.adds.map((add) => add.add.full_name).join(' → ')} · {signed(alternative.gain)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StreamingPlanner({ workspace, roster, leagueProfile, recommendations, compact = false }: StreamingPlannerProps) {
  const { updateLeague } = useLeagueWorkspace();
  const [includeGoalies, setIncludeGoalies] = useState(false);
  const [horizon, setHorizon] = useState<PlannerHorizon>('week');
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const { status, result } = useWeekPlanner({ workspace, leagueProfile, roster, recommendations, includeGoalies, horizon });

  const setStreamSpot = (playerId: string, value: boolean) => {
    const now = new Date().toISOString();
    updateLeague({
      ...workspace,
      roster: workspace.roster.map((entry) => normalizeId(entry.playerId) === normalizeId(playerId) ? { ...entry, streamSpot: value } : entry),
      updatedAt: now,
    });
  };
  const markAvailability = (player: RosterPlayer, availability: 'available' | 'taken') => {
    const now = new Date().toISOString();
    updateLeague({
      ...workspace,
      candidates: setCandidateAvailability(workspace.candidates, { id: player.id, team: player.team, position: player.positions[0] }, availability, now),
      updatedAt: now,
    });
  };

  const streamIds = new Set(workspace.roster.filter((entry) => entry.streamSpot).map((entry) => normalizeId(entry.playerId)));
  const streamPlayers = roster.filter((player) => streamIds.has(normalizeId(player.id)));
  const lockedIds = new Set(workspace.roster.filter((entry) => entry.keeper || entry.protected || entry.undroppable).map((entry) => normalizeId(entry.playerId)));
  const otherChoices = roster
    .filter((player) => !streamIds.has(normalizeId(player.id)) && !lockedIds.has(normalizeId(player.id)) && !result?.streamSuggestions.some((item) => normalizeId(item.id) === normalizeId(player.id)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const addCounts = result ? result.plans.map((_, count) => count).filter((count) => count > 0) : [];
  const activeCount = selectedCount !== null && addCounts.includes(selectedCount)
    ? selectedCount
    : addCounts.reduce<number | null>((best, count) => (best === null || (result as WeekPlannerResult).plans[count].gain > (result as WeekPlannerResult).plans[best].gain + 0.5 ? count : best), null);
  const plan = activeCount !== null && result ? result.plans[activeCount] : null;
  const weekLabel = result ? `${displayDate(result.window.start)} – ${displayDate(result.window.end)}` : '';
  const irSlot = irSlotLabel(workspace);

  return (
    <section className="border-t border-line p-4" aria-labelledby="streaming-planner-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="scoreboard-text text-accent">TRANSACTION PLANNER</p>
          <h3 id="streaming-planner-title" className="mt-1 text-lg font-semibold text-ink">{horizon === 'week' ? "Plan this week's adds" : `Plan the next ${horizon === '14d' ? '2 weeks' : '30 days'}`}</h3>
          <p className="mt-1 text-sm text-ink-dim">
            {weekLabel ? `${weekLabel}. ` : ''}
            {horizon === 'week' ? 'Streams your open places, IR moves and the players you mark OK to drop.' : 'Finds players worth adding and holding; each week keeps its own add limit.'}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {workspace.rosterRules.lockingMode !== 'weekly' && (
            <div className="flex gap-1 rounded-lg border border-line bg-surface-0 p-1" role="group" aria-label="Planning window">
              {([['week', 'This week'], ['14d', '2 weeks'], ['30d', '30 days']] as const).map(([value, label]) => (
                <Button key={value} type="button" size="sm" variant={horizon === value ? 'primary' : 'ghost'} aria-pressed={horizon === value} onClick={() => setHorizon(value)}>{label}</Button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-ink-dim">
            <input type="checkbox" checked={includeGoalies} onChange={(event) => setIncludeGoalies(event.target.checked)} className="accent-[var(--accent)]" />
            Include goalies
          </label>
        </div>
      </div>

      {status === 'loading' && <p className="mt-3 text-sm text-ink-dim">Loading schedules for the next 30 days…</p>}
      {status === 'error' && <p className="mt-3 text-sm text-warning">Schedules for the planner could not be loaded. Try again shortly.</p>}

      {result && (
        <div className={`mt-4 grid gap-3 ${compact ? '' : 'lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]'}`}>
          <div className="min-w-0 space-y-3">
            <div className="rounded-md border border-line bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">1 · Roster places to stream</p>
              <ul className="mt-2 space-y-1 text-xs text-ink-dim">
                {result.spots.filter((spot) => spot.kind === 'open').length > 0 && <li>{result.spots.filter((spot) => spot.kind === 'open').length} open place{result.spots.filter((spot) => spot.kind === 'open').length === 1 ? '' : 's'}: no drop needed</li>}
                {result.irSuggestions.map((item) => (
                  <li key={item.player.id} className="flex items-center gap-1.5"><HeartPulse size={12} className="text-warning" aria-hidden="true" />{item.player.full_name} ({item.status}) can move to {irSlot}{item.holderPlays ? ', but may play' : ''}</li>
                ))}
              </ul>

              <p className="mt-3 text-xs font-semibold text-ink">OK to drop</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {streamPlayers.length === 0 && <span className="text-xs text-ink-mute">None chosen.</span>}
                {streamPlayers.map((player) => (
                  <button key={player.id} type="button" onClick={() => setStreamSpot(player.id, false)} className="flex items-center gap-1 rounded-full border border-accent bg-accent-muted px-2.5 py-1 text-xs text-ink" aria-label={`Keep ${player.full_name}`}>
                    {player.full_name}<X size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
              {result.streamSuggestions.length > 0 && (
                <>
                  <p className="mt-2 text-[11px] text-ink-mute">Lowest FPPG on your roster (never keepers or protected players). You decide:</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {result.streamSuggestions.map((player) => (
                      <button key={player.id} type="button" onClick={() => setStreamSpot(player.id, true)} className="flex items-center gap-1 rounded-full border border-line bg-surface-0 px-2.5 py-1 text-xs text-ink-dim hover:border-accent hover:text-ink">
                        <Plus size={12} aria-hidden="true" />{player.full_name}<span className="text-ink-mute">{seasonValue(player, {}).toFixed(1)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {otherChoices.length > 0 && (
                <label className="mt-2 flex items-center gap-2 text-[11px] text-ink-mute">
                  Another player:
                  <select className="rounded border border-line bg-surface-0 px-1.5 py-1 text-xs text-ink" value="" onChange={(event) => event.target.value && setStreamSpot(event.target.value, true)}>
                    <option value="">Choose…</option>
                    {otherChoices.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
                  </select>
                </label>
              )}
            </div>

            {result.warnings.map((warning) => <p key={warning} className="flex items-start gap-2 rounded-md border border-warning bg-warning-muted p-2 text-xs text-warning"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{warning}</p>)}
            <ul className="space-y-1 text-[11px] text-ink-mute">{result.assumptions.map((assumption) => <li key={assumption}>· {assumption}</li>)}</ul>
          </div>

          <div className="min-w-0 rounded-md border border-line bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">2 · Compare how many adds to use</p>
            {addCounts.length === 0 ? (
              <p className="mt-2 text-sm text-ink-dim">
                {result.maxAdds === 0 ? 'No adds left this week.' : result.spots.length === 0 ? 'No roster place to stream yet: mark a player OK to drop, or move an injured player to IR.' : 'No candidate has games left in this window.'}
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Number of adds">
                {addCounts.map((count) => (
                  <Button key={count} type="button" size="sm" variant={activeCount === count ? 'primary' : 'ghost'} aria-pressed={activeCount === count} onClick={() => setSelectedCount(count)}>
                    {count} add{count === 1 ? '' : 's'} · {signed(result.plans[count].gain)}
                    {count > 1 && <span className="ml-1 opacity-75">({signed(result.plans[count].gain - result.plans[count - 1].gain)} for this add)</span>}
                  </Button>
                ))}
              </div>
            )}
            {plan && <PlanView plan={plan} result={result} workspace={workspace} onAvailability={markAvailability} />}
            {result.bridgeCandidates.length > 0 && (
              <div className="mt-3 rounded-md border border-accent/40 bg-accent-muted p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarRange size={15} className="text-accent" aria-hidden="true" />{displayDate(result.week.end).split(',')[0]} → {displayDate(result.week.nextStart).split(',')[0]} back-to-back</p>
                <p className="mt-1 text-xs text-ink-dim">
                  Have an add left at the end of the week? These players play {displayDate(result.week.end)} and {displayDate(result.week.nextStart)}.
                  Add one {result.bridgeCandidates[0].actionDate === result.week.end ? 'that day' : `on ${displayDate(result.bridgeCandidates[0].actionDate)}`} with this week's add: he scores on the last day and is already on your roster when next week's adds reset.
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {result.bridgeCandidates.map((bridge) => (
                    <li key={bridge.player.id} className="flex flex-wrap items-center gap-2 text-ink">
                      <strong>{bridge.player.full_name}</strong>
                      <span className="text-ink-mute">{bridge.player.team} · {bridge.player.positions.join('/')} · {bridge.fppg.toFixed(2)} FPPG</span>
                      {bridge.confirmed ? <span className="text-positive">Marked available</span> : (
                        <span className="flex items-center gap-2">
                          <button type="button" className="font-semibold text-accent hover:underline" onClick={() => markAvailability(bridge.player, 'available')}>Available</button>
                          <button type="button" className="font-semibold text-ink-dim hover:text-negative hover:underline" onClick={() => markAvailability(bridge.player, 'taken')}>Taken</button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
