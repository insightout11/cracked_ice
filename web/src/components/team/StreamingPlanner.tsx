import { useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarRange, HeartPulse, Plus, X } from 'lucide-react';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import { setCandidateAvailability, setCandidateDismissed, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { type PlannedAdd, type PlannerHorizon, type WeekPlan, type WeekPlannerResult } from '../../lib/weekPlanner';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { useWeekPlanner } from '../../hooks/useWeekPlanner';
import type { AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import { Button } from '../ui/button';
import { PlanGrid } from './PlanGrid';
import { PlayerNameLink } from './PlayerNameLink';
import { TeamChainCard } from './TeamChainCard';

interface StreamingPlannerProps {
  workspace: LeagueWorkspace;
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  recommendations: AcquisitionRecommendationResult;
  compact?: boolean;
  /** Open a player's profile; names are plain text without it. */
  onOpenPlayer?: (player: RosterPlayer) => void;
}

type Availability = 'available' | 'taken' | 'not-interested';

function NotInterestedButton({ player, onAvailability }: { player: RosterPlayer; onAvailability: (player: RosterPlayer, status: Availability) => void }) {
  return <button type="button" className="font-semibold text-ink-dim hover:text-ink hover:underline" onClick={() => onAvailability(player, 'not-interested')} title="Leave him out of the plan and show other options">Not interested</button>;
}

/** Available / Taken / Not interested, for one suggested player. */
function AvailabilityChoice({ player, onAvailability }: { player: RosterPlayer; onAvailability: (player: RosterPlayer, status: Availability) => void }) {
  return (
    <>
      <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onAvailability(player, 'available')}>Available</button>
      <span aria-hidden="true">·</span>
      <button type="button" className="font-semibold text-ink-dim hover:text-negative hover:underline" onClick={() => onAvailability(player, 'taken')}>Taken</button>
      <span aria-hidden="true">·</span>
      <NotInterestedButton player={player} onAvailability={onAvailability} />
    </>
  );
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

function AddStep({ add, nextWeekStart, onAvailability, onOpenPlayer }: { add: PlannedAdd; nextWeekStart: string; onAvailability: (player: RosterPlayer, status: Availability) => void; onOpenPlayer?: (player: RosterPlayer) => void }) {
  const sameDay = add.actionDate === add.effectiveDate;
  const hasWindow = add.earliestActionDate < add.actionDate;
  return (
    <li className="rounded-md border border-line bg-surface-0 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
        {hasWindow
          ? `Any time ${displayDate(add.earliestActionDate)} – ${displayDate(add.actionDate)} · first game ${displayDate(add.effectiveDate)}`
          : `${displayDate(add.actionDate)}${sameDay ? '' : ` · plays from ${displayDate(add.effectiveDate)}`}`}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink">
        <strong>Add <PlayerNameLink player={add.add} onOpen={onOpenPlayer} /></strong>
        <span className="text-ink-mute">{add.add.team} · {add.add.positions.join('/')}</span>
        {add.drop && <><ArrowRight size={14} className="text-accent" aria-hidden="true" /><span className="text-ink-dim">drop <PlayerNameLink player={add.drop} onOpen={onOpenPlayer} /></span></>}
      </p>
      <p className="mt-1 text-xs text-ink-dim">
        {add.starts} start{add.starts === 1 ? '' : 's'} in the window · {signed(add.points)} pts
        {add.playsNextWeekStart ? ` · also plays ${displayDate(nextWeekStart)}, already on your roster when adds reset` : ''}
      </p>
      {hasWindow && <p className="mt-1 text-[11px] text-ink-dim">Adding early costs nothing here and secures him; waiting keeps the option open.</p>}
      {add.confirmed ? (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-positive">
          Marked available · recheck before you add him
          <span aria-hidden="true" className="text-ink-mute">·</span>
          <NotInterestedButton player={add.add} onAvailability={onAvailability} />
        </p>
      ) : (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-warning">
          Check he's available in your league:
          <AvailabilityChoice player={add.add} onAvailability={onAvailability} />
        </p>
      )}
    </li>
  );
}

function PlanView({ plan, result, workspace, onAvailability, onOpenPlayer }: { plan: WeekPlan; result: WeekPlannerResult; workspace: LeagueWorkspace; onAvailability: (player: RosterPlayer, status: Availability) => void; onOpenPlayer?: (player: RosterPlayer) => void }) {
  const lineupEffect = plan.gain - plan.pickupPoints + plan.droppedPoints;
  const irSlot = irSlotLabel(workspace);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-sm text-ink">
          <strong className="scoreboard-number text-2xl text-positive">{signed(plan.gain)}</strong> pts {result.horizon === 'week' ? 'this week' : 'in this window'} vs. no moves
        </p>
        <p className="text-xs text-ink-dim">
          {signed(plan.pickupPoints)} from pickups
          {plan.droppedPoints > 0 ? ` · −${plan.droppedPoints.toFixed(1)} the dropped players would have scored` : ''}
          {Math.abs(lineupEffect) >= 0.05 ? ` · ${signed(lineupEffect)} lineup shuffle` : ''}
          {` · ${signed(plan.startsGain, 0)} lineup starts`}
        </p>
      </div>

      <PlanGrid plan={plan} result={result} irSlot={irSlot} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Moves, in order</p>
        <ol className="mt-2 grid gap-2 md:grid-cols-2">
          {plan.irMoves.map((move) => (
            <li key={move.spotId} className="rounded-md border border-line bg-surface-0 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">First · free move</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-ink"><HeartPulse size={14} className="text-warning" aria-hidden="true" /><strong>Move <PlayerNameLink player={move.player} onOpen={onOpenPlayer} /> to {irSlot}</strong><span className="text-ink-mute">({move.status})</span></p>
              <p className="mt-1 text-xs text-ink-dim">{move.holderPlays ? 'Day-to-day: he may play, and it costs his games from then on.' : 'Opens a roster place without dropping anyone.'} He needs a place when he returns.</p>
            </li>
          ))}
          {plan.adds.map((add) => <AddStep key={`${add.spotId}-${add.add.id}-${add.effectiveDate}`} add={add} nextWeekStart={result.week.nextStart} onAvailability={onAvailability} onOpenPlayer={onOpenPlayer} />)}
        </ol>
      </div>

      <SubstituteList plan={plan} result={result} onOpenPlayer={onOpenPlayer} />
    </div>
  );
}

/** For each add: who to take instead if he's gone, and what that costs. */
function SubstituteList({ plan, result, onOpenPlayer }: { plan: WeekPlan; result: WeekPlannerResult; onOpenPlayer?: (player: RosterPlayer) => void }) {
  const substitutes = result.substitutesFor(plan.addCount);
  const rows = plan.adds.filter((add) => substitutes[normalizeId(add.add.id)]?.length);
  if (!rows.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-ink">If a target is taken</p>
      <ul className="mt-1 space-y-1 text-xs">
        {rows.map((add) => (
          <li key={`${add.add.id}-${add.effectiveDate}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-line bg-surface-0 px-3 py-1.5">
            <span className="text-ink-mute">Instead of <strong className="text-ink-dim"><PlayerNameLink player={add.add} onOpen={onOpenPlayer} /></strong>:</span>
            {substitutes[normalizeId(add.add.id)].map((option, index) => (
              <span key={option.player.id} className="text-ink">
                {index > 0 && <span className="mr-2 text-ink-mute">or</span>}
                <strong><PlayerNameLink player={option.player} onOpen={onOpenPlayer} /></strong>
                <span className="text-ink-mute"> {option.player.team} · {option.player.positions.join('/')}</span>
                <span className={option.loss > 0.05 ? 'text-ink-dim' : 'text-positive'}> ({option.loss > 0.05 ? `−${option.loss.toFixed(1)} pts` : option.loss < -0.05 ? `+${(-option.loss).toFixed(1)} pts` : 'same value'}{option.effectiveDate !== add.effectiveDate ? `, from ${displayDate(option.effectiveDate)}` : ''})</span>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepHeading({ number, title, detail }: { number: number; title: string; detail?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="scoreboard-number flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-surface-0">{number}</span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {detail && <p className="text-xs text-ink-mute">{detail}</p>}
    </div>
  );
}

export function StreamingPlanner({ workspace, roster, leagueProfile, recommendations, compact = false, onOpenPlayer }: StreamingPlannerProps) {
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
  const markAvailability = (player: RosterPlayer, availability: Availability) => {
    const now = new Date().toISOString();
    const identity = { id: player.id, team: player.team, position: player.positions[0] };
    updateLeague({
      ...workspace,
      candidates: availability === 'not-interested'
        ? setCandidateDismissed(workspace.candidates, identity, true, now)
        : setCandidateAvailability(workspace.candidates, identity, availability, now),
      updatedAt: now,
    });
  };
  const showAgain = (playerId: string) => {
    const now = new Date().toISOString();
    updateLeague({ ...workspace, candidates: setCandidateDismissed(workspace.candidates, { id: playerId }, false, now), updatedAt: now });
  };
  const nameById = new Map((recommendations.players ?? []).map((player) => [normalizeId(player.id), player.name]));
  const notInterested = workspace.candidates
    .filter((candidate) => candidate.preference?.dismissed)
    .map((candidate) => ({ id: candidate.playerId, name: nameById.get(normalizeId(candidate.playerId)) }))
    .filter((item): item is { id: string; name: string } => Boolean(item.name));

  const streamIds = new Set(workspace.roster.filter((entry) => entry.streamSpot).map((entry) => normalizeId(entry.playerId)));
  const streamPlayers = roster.filter((player) => streamIds.has(normalizeId(player.id)));
  const lockedIds = new Set(workspace.roster.filter((entry) => entry.keeper || entry.protected || entry.undroppable).map((entry) => normalizeId(entry.playerId)));
  const otherChoices = roster
    .filter((player) => !streamIds.has(normalizeId(player.id)) && !lockedIds.has(normalizeId(player.id))
      && !result?.streamSuggestions.some((item) => normalizeId(item.id) === normalizeId(player.id))
      && !result?.irSuggestions.some((item) => normalizeId(item.player.id) === normalizeId(player.id)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const addCounts = result ? result.plans.map((_, count) => count).filter((count) => count > 0) : [];
  // Best: the fewest adds within half a point of the most gain.
  const recommendedCount = addCounts.reduce<number | null>((best, count) => (best === null || (result as WeekPlannerResult).plans[count].gain > (result as WeekPlannerResult).plans[best].gain + 0.5 ? count : best), null);
  const activeCount = selectedCount !== null && addCounts.includes(selectedCount) ? selectedCount : recommendedCount;
  const openCount = result ? result.spots.filter((spot) => spot.kind === 'open').length : 0;
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
        <div className="mt-4 space-y-5">
          {result.horizon === 'week' && result.teamChains && (
            <TeamChainCard chains={result.teamChains} workspace={workspace} roster={roster} players={recommendations.players ?? []} onOpenPlayer={onOpenPlayer} />
          )}

          <div>
            <StepHeading number={1} title="Roster places to stream" detail="Open places, IR moves, and players you're OK dropping" />
            <div className="mt-2 flex flex-wrap gap-2">
              {openCount > 0 && (
                <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
                  <p className="text-sm font-semibold text-ink">{openCount} open place{openCount === 1 ? '' : 's'}</p>
                  <p className="text-[11px] text-ink-mute">No drop needed</p>
                </div>
              )}
              {result.irSuggestions.map((item) => (
                <div key={item.player.id} className="rounded-md border border-warning/50 bg-warning-muted px-3 py-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><HeartPulse size={13} className="text-warning" aria-hidden="true" />{item.player.full_name} → {irSlot}</p>
                  <p className="text-[11px] text-ink-dim">{item.status}{item.holderPlays ? ' · may play, used only if a streamer beats him' : ' · free move, frees his place'}</p>
                </div>
              ))}
              {streamPlayers.map((player) => (
                <div key={player.id} className="flex items-start gap-2 rounded-md border border-accent bg-accent-muted px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{player.full_name}</p>
                    <p className="text-[11px] text-ink-dim">OK to drop · {(result.rosterFppg[normalizeId(player.id)] ?? 0).toFixed(2)} FPPG</p>
                  </div>
                  <button type="button" onClick={() => setStreamSpot(player.id, false)} className="rounded p-0.5 text-ink-dim hover:text-ink" aria-label={`Keep ${player.full_name}`}><X size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute">
              <span>Mark OK to drop:</span>
              {result.streamSuggestions.map((player) => (
                <button key={player.id} type="button" onClick={() => setStreamSpot(player.id, true)} className="flex items-center gap-1 rounded-full border border-line bg-surface-0 px-2.5 py-1 text-xs text-ink-dim hover:border-accent hover:text-ink" title="Among the lowest FPPG on your roster (never keepers or protected players)">
                  <Plus size={12} aria-hidden="true" />{player.full_name}<span className="text-ink-mute">{(result.rosterFppg[normalizeId(player.id)] ?? 0).toFixed(2)}</span>
                </button>
              ))}
              {otherChoices.length > 0 && (
                <select aria-label="Mark another player OK to drop" className="rounded border border-line bg-surface-0 px-1.5 py-1 text-xs text-ink" value="" onChange={(event) => event.target.value && setStreamSpot(event.target.value, true)}>
                  <option value="">Another player…</option>
                  {otherChoices.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
                </select>
              )}
            </div>
            {result.warnings.map((warning) => <p key={warning} className="mt-2 flex items-start gap-2 rounded-md border border-warning bg-warning-muted p-2 text-xs text-warning"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{warning}</p>)}
          </div>

          <div>
            <StepHeading number={2} title="How many adds?" detail={result.addsRemaining === null ? 'No add limit set' : `${result.addsRemaining} left this ${workspace.acquisitions.period === 'season' ? 'season' : 'week'}`} />
            {addCounts.length === 0 ? (
              <p className="mt-2 text-sm text-ink-dim">
                {result.maxAdds === 0 ? 'No adds left this week.' : result.spots.length === 0 ? 'No roster place to stream yet: mark a player OK to drop, or move an injured player to IR.' : 'No candidate has games left in this window.'}
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="group" aria-label="Number of adds">
                {addCounts.map((count) => {
                  const marginal = result.plans[count].gain - result.plans[count - 1].gain;
                  const selected = activeCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedCount(count)}
                      className={`rounded-md border p-2 text-left transition-colors ${selected ? 'border-accent bg-accent-muted' : 'border-line bg-surface-2 hover:border-accent/60'}`}
                    >
                      <span className="flex items-center justify-between text-xs text-ink-dim">{count} add{count === 1 ? '' : 's'}{count === recommendedCount && <span className="rounded-full bg-accent px-1.5 text-[9px] font-semibold uppercase text-surface-0">Best</span>}</span>
                      <span className="scoreboard-number block text-lg text-ink">{signed(result.plans[count].gain)}</span>
                      <span className={`block text-[11px] ${marginal < 0.5 ? 'text-ink-mute' : 'text-positive'}`}>{count === 1 ? 'first add' : marginal < 0.5 ? 'little gain for this add' : `${signed(marginal)} for this add`}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {plan && (
            <div>
              <StepHeading number={3} title={`The plan: ${plan.addCount} add${plan.addCount === 1 ? '' : 's'}`} />
              <div className="mt-2 rounded-md border border-line bg-surface-2 p-3">
                <PlanView plan={plan} result={result} workspace={workspace} onAvailability={markAvailability} onOpenPlayer={onOpenPlayer} />
              </div>
            </div>
          )}

          {result.bridgeCandidates.length > 0 && (
            <div className="rounded-md border border-accent/40 bg-accent-muted p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarRange size={15} className="text-accent" aria-hidden="true" />{displayDate(result.week.end).split(',')[0]} → {displayDate(result.week.nextStart).split(',')[0]} back-to-back</p>
              <p className="mt-1 text-xs text-ink-dim">
                Have an add left at the end of the week? These players play {displayDate(result.week.end)} and {displayDate(result.week.nextStart)}.
                Add one {result.bridgeCandidates[0].actionDate === result.week.end ? 'that day' : `on ${displayDate(result.bridgeCandidates[0].actionDate)}`} with this week's add: he scores on the last day and is already on your roster when next week's adds reset.
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {result.bridgeCandidates.map((bridge) => (
                  <li key={bridge.player.id} className="flex flex-wrap items-center gap-2 text-ink">
                    <strong><PlayerNameLink player={bridge.player} onOpen={onOpenPlayer} /></strong>
                    <span className="text-ink-mute">{bridge.player.team} · {bridge.player.positions.join('/')} · {bridge.fppg.toFixed(2)} FPPG</span>
                    <span className="flex items-center gap-2">
                      {bridge.confirmed ? (
                        <><span className="text-positive">Marked available</span><NotInterestedButton player={bridge.player} onAvailability={markAvailability} /></>
                      ) : <AvailabilityChoice player={bridge.player} onAvailability={markAvailability} />}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {notInterested.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute">
              <span>Not interested, left out of the plan:</span>
              {notInterested.map((item) => (
                <button key={item.id} type="button" onClick={() => showAgain(item.id)} className="flex items-center gap-1 rounded-full border border-line bg-surface-0 px-2 py-0.5 text-ink-dim hover:border-accent hover:text-ink" aria-label={`Show ${item.name} again`} title="Show him again">
                  {item.name}<X size={11} aria-hidden="true" />
                </button>
              ))}
            </p>
          )}

          <details className="text-[11px] text-ink-mute">
            <summary className="cursor-pointer font-semibold text-ink-dim">How this is calculated</summary>
            <ul className="mt-1 space-y-1">{result.assumptions.map((assumption) => <li key={assumption}>· {assumption}</li>)}</ul>
          </details>
        </div>
      )}
    </section>
  );
}
