import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, BarChart3, Check, RotateCcw, Search, Sparkles, Trash2, X } from 'lucide-react';
import type { DraftRosterProjectionSummary } from '../../lib/draftStrategy';
import type { PlannerPickTarget, PlayerAvailabilityCurve, PlayerAvailabilityEstimate } from '../../lib/draftPlanner';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';

interface DraftPlannerPanelProps {
  mode: 'planner' | 'live';
  projectionLabel: string;
  hasDraftPosition: boolean;
  pickCount: number;
  simulatedPickCount: number;
  numberOfTeams: number;
  draftPosition: number | null;
  orderType: 'snake' | 'linear';
  summary: DraftRosterProjectionSummary;
  availability: PlayerAvailabilityEstimate[];
  availabilityCurves: PlayerAvailabilityCurve[];
  availabilityTargets: PlannerPickTarget[];
  availabilityPick: number | null;
  availabilityQuery: string;
  targets: LeagueWorkspace['draftSession']['targets'];
  onModeChange: (mode: 'planner' | 'live') => void;
  onTeamCountChange: (teams: number) => void;
  onDraftPositionChange: (position: number | null) => void;
  onOrderTypeChange: (orderType: 'snake' | 'linear') => void;
  onSimulateToNext: () => void;
  onSimulateRest: () => void;
  onReroll: () => void;
  onReset: () => void;
  onApplyRoster: () => void;
  onAvailabilityPickChange: (overallPick: number) => void;
  onAvailabilityQueryChange: (query: string) => void;
  onAddTargetAtPick: (playerId: string, overallPick: number) => void;
}

export function DraftPlannerPanel({ mode, projectionLabel, hasDraftPosition, pickCount, simulatedPickCount, numberOfTeams, draftPosition, orderType, summary, availability, availabilityCurves, availabilityTargets, availabilityPick, availabilityQuery, targets, onModeChange, onTeamCountChange, onDraftPositionChange, onOrderTypeChange, onSimulateToNext, onSimulateRest, onReroll, onReset, onApplyRoster, onAvailabilityPickChange, onAvailabilityQueryChange, onAddTargetAtPick }: DraftPlannerPanelProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingApply, setConfirmingApply] = useState(false);
  const [confirmingLive, setConfirmingLive] = useState(false);
  const [compareSelection, setCompareSelection] = useState<{ overallPick: number | null; playerIds: string[] }>({ overallPick: null, playerIds: [] });
  const planner = mode === 'planner';
  const selectedTarget = availabilityTargets.find((target) => target.overallPick === availabilityPick) ?? availabilityTargets[0];
  const compareIds = compareSelection.overallPick === (selectedTarget?.overallPick ?? null) ? compareSelection.playerIds : [];
  const comparePlayers = compareIds.flatMap((playerId) => {
    const player = availability.find((item) => item.playerId === playerId);
    return player ? [player] : [];
  });
  const toggleCompare = (playerId: string) => {
    const overallPick = selectedTarget?.overallPick ?? null;
    setCompareSelection((current) => {
      const activeIds = current.overallPick === overallPick ? current.playerIds : [];
      if (activeIds.includes(playerId)) return { overallPick, playerIds: activeIds.filter((id) => id !== playerId) };
      if (activeIds.length >= 2) return current;
      return { overallPick, playerIds: [...activeIds, playerId] };
    });
  };
  const normalizedAvailabilityQuery = availabilityQuery.trim().toLocaleLowerCase();
  const availabilityMatches = availability.filter((item) => normalizedAvailabilityQuery
    ? item.name.toLocaleLowerCase().includes(normalizedAvailabilityQuery) || item.team.toLocaleLowerCase().includes(normalizedAvailabilityQuery)
    : item.yahooAdp !== null && item.probability >= 1).slice(0, normalizedAvailabilityQuery ? 20 : availability.length);
  const decisionZone = availabilityMatches.filter((item) => item.probability >= 30 && item.probability < 80).slice(0, 6);
  const likelyLater = availabilityMatches.filter((item) => item.probability >= 80).slice(0, 3);
  const needsToFall = availabilityMatches.filter((item) => item.probability < 30).slice(0, 3);

  return <section className="overflow-hidden rounded-xl border border-line bg-surface-1" aria-label="Draft mode and planning controls">
    <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-start lg:justify-between">
      <div><p className="scoreboard-text text-accent">DRAFT MODE</p><h2 className="mt-0.5 text-lg font-semibold text-ink">{planner ? 'Planning sandbox' : 'Live draft tracker'}</h2><p className="mt-1 max-w-2xl text-xs text-ink-dim">{planner ? 'Scenario picks power recommendations and team projections without changing My Team.' : 'Mine selections sync to My Team while you track the real draft.'}</p></div>
      <div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Teams<select aria-label="Draft team count" value={numberOfTeams} disabled={pickCount > 0} onChange={(event) => onTeamCountChange(Number(event.target.value))} className="min-h-10 rounded-lg border border-line bg-surface-0 px-2 text-sm normal-case tracking-normal text-ink disabled:opacity-50">{Array.from({ length: 31 }, (_, index) => index + 2).map((teams) => <option key={teams} value={teams}>{teams}</option>)}</select></label><label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">My draft slot<select aria-label="My draft slot" value={draftPosition ?? ''} disabled={pickCount > 0} onChange={(event) => onDraftPositionChange(event.target.value ? Number(event.target.value) : null)} className="min-h-10 rounded-lg border border-line bg-surface-0 px-2 text-sm normal-case tracking-normal text-ink disabled:opacity-50"><option value="">Not set</option>{Array.from({ length: numberOfTeams }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Order<select aria-label="Draft order" value={orderType} disabled={pickCount > 0} onChange={(event) => onOrderTypeChange(event.target.value as 'snake' | 'linear')} className="min-h-10 rounded-lg border border-line bg-surface-0 px-2 text-sm normal-case tracking-normal text-ink disabled:opacity-50"><option value="snake">Snake</option><option value="linear">Linear</option></select></label><div className="inline-flex self-start rounded-lg border border-line bg-surface-0 p-1" aria-label="Draft mode"><button type="button" onClick={() => { setConfirmingLive(false); onModeChange('planner'); }} aria-pressed={planner} className={`rounded-md px-3 py-2 text-xs font-semibold ${planner ? 'bg-accent text-accent-ink' : 'text-ink-dim'}`}>Planner</button><button type="button" onClick={() => pickCount > 0 && planner ? setConfirmingLive(true) : onModeChange('live')} aria-pressed={!planner} className={`rounded-md px-3 py-2 text-xs font-semibold ${!planner ? 'bg-accent text-accent-ink' : 'text-ink-dim'}`}>Live</button></div></div>
    </div>

    {confirmingLive && <div className="flex flex-col gap-2 border-b border-warning/30 bg-warning-muted px-4 py-3 text-xs text-warning sm:flex-row sm:items-center sm:justify-between"><p>Live mode will add your scenario selections to My Team. Continue?</p><div className="flex gap-2"><button type="button" onClick={() => { onModeChange('live'); setConfirmingLive(false); }} className="min-h-9 rounded-md bg-warning px-3 font-bold text-surface-0">Switch to Live</button><button type="button" onClick={() => setConfirmingLive(false)} className="min-h-9 rounded-md border border-warning/50 px-3 font-semibold">Cancel</button></div></div>}

    {planner && <>
      {pickCount > 0 && <p className="border-b border-line bg-surface-0 px-4 py-2 text-[10px] text-ink-mute">Reset the scenario to change teams, draft slot, or draft order.</p>}
      {availabilityTargets.length > 0 && <div className="border-b border-line p-4"><div className="flex items-baseline justify-between gap-3"><div><p className="scoreboard-text text-accent">MY PICKS</p><h3 className="text-sm font-semibold text-ink">Round-by-round plan</h3></div><span className="text-[10px] text-ink-mute">Choose a pick to inspect availability</span></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{availabilityTargets.map((target) => { const pickTargets = targets.filter((item) => item.targetOverallPick === target.overallPick).sort((a, b) => a.backupOrder - b.backupOrder); return <button key={target.overallPick} type="button" onClick={() => onAvailabilityPickChange(target.overallPick)} className={`min-w-32 shrink-0 rounded-lg border p-2 text-left ${target.overallPick === selectedTarget?.overallPick ? 'border-accent bg-accent-muted' : pickTargets.length ? 'border-warning/50 bg-warning-muted/30' : 'border-line bg-surface-0'}`}><span className="block text-[9px] font-bold uppercase tracking-wide text-ink-mute">Round {target.round} · Pick #{target.overallPick}</span><strong className="mt-1 block truncate text-xs text-ink">{pickTargets[0]?.fullName ?? 'Choose target'}</strong><span className="mt-1 block text-[9px] text-ink-mute">{pickTargets.length > 1 ? `+${pickTargets.length - 1} backup${pickTargets.length === 2 ? '' : 's'}` : pickTargets.length ? 'Primary selected' : 'Check availability'}</span></button>; })}</div></div>}
      <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1.2fr_1fr]">
        <div><div className="flex flex-wrap gap-2"><button type="button" disabled={!hasDraftPosition} onClick={onSimulateToNext} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-bold text-accent-ink disabled:opacity-40"><Sparkles size={14} />Simulate to my next pick</button><button type="button" disabled={!hasDraftPosition} onClick={onSimulateRest} className="min-h-10 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent disabled:opacity-40">Fill opponent picks</button>{simulatedPickCount > 0 && <button type="button" onClick={onReroll} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"><RotateCcw size={13} />Reroll opponents</button>}</div><p className="mt-2 text-[10px] text-ink-mute">Yahoo ADP with human-draft volatility · {projectionLabel} evaluates your choices. {!hasDraftPosition && 'Set My draft slot above first.'}</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Players" value={summary.playerCount} /><Metric label="Regular starts" value={summary.regularStarts} /><Metric label="Regular points" value={summary.regularPoints.toFixed(1)} /><Metric label="Playoff points" value={summary.playoffPoints.toFixed(1)} detail={`${summary.playoffStarts} starts`} /></div>
      </div>

      {availabilityTargets.length > 0 && <div id="draft-availability" className="border-b border-line p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="flex items-center gap-2"><BarChart3 size={15} className="text-accent" /><div><h3 className="text-sm font-semibold text-ink">Availability at {selectedTarget ? `pick #${selectedTarget.overallPick}` : 'a future pick'}</h3><p className="text-[10px] text-ink-mute">500 Yahoo-based rooms using the players still available after keepers and recorded picks. Estimates are not guarantees.</p></div></div><label className="relative block min-w-56"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={14} /><span className="sr-only">Search availability players</span><input value={availabilityQuery} onChange={(event) => onAvailabilityQueryChange(event.target.value)} placeholder="Find a player or team" className="min-h-9 w-full rounded-md border border-line bg-surface-0 pl-9 pr-3 text-xs text-ink outline-none focus:border-accent" /></label></div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Future picks to analyze">{availabilityTargets.map((target) => <button key={target.overallPick} type="button" aria-pressed={target.overallPick === selectedTarget?.overallPick} onClick={() => onAvailabilityPickChange(target.overallPick)} className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold ${target.overallPick === selectedTarget?.overallPick ? 'border-accent bg-accent-muted text-accent' : 'border-line bg-surface-0 text-ink-dim hover:border-accent/60'}`}>R{target.round} · #{target.overallPick}</button>)}</div>
        {normalizedAvailabilityQuery && availabilityCurves.length > 0
          ? <div className="mt-3 space-y-3">{availabilityMatches.slice(0, 5).map((item) => item.yahooAdp === null
            ? <ManualTargetCard key={item.playerId} item={item} targets={availabilityTargets} assignedTarget={targets.find((target) => target.playerId === item.playerId)} onAddTarget={onAddTargetAtPick} />
            : <AvailabilityCurveCard key={item.playerId} item={item} curve={availabilityCurves.find((curve) => curve.playerId === item.playerId)} selectedPick={selectedTarget?.overallPick ?? null} assignedTarget={targets.find((target) => target.playerId === item.playerId)} compareSelected={compareIds.includes(item.playerId)} compareDisabled={compareIds.length >= 2 && !compareIds.includes(item.playerId)} onCompare={() => toggleCompare(item.playerId)} onPickChange={onAvailabilityPickChange} onAddTarget={onAddTargetAtPick} />)}</div>
          : availabilityMatches.length > 0 ? <div className="mt-3 space-y-4"><AvailabilityGroup title="Decision zone" description="The useful choices for this pick: available often enough to plan for, but risky enough that waiting matters." items={decisionZone} tone="decision" selectedTarget={selectedTarget} targets={targets} compareIds={compareIds} onCompare={toggleCompare} onAddTargetAtPick={onAddTargetAtPick} /><AvailabilityGroup title="Likely available later" description="Probably still on the board here. You may be able to wait instead of reaching now." items={likelyLater} tone="likely" selectedTarget={selectedTarget} targets={targets} compareIds={compareIds} onCompare={toggleCompare} onAddTargetAtPick={onAddTargetAtPick} /><AvailabilityGroup title="Needs to fall" description="Possible only if the room lets them slide. Treat these as bonuses, not the plan." items={needsToFall} tone="fall" selectedTarget={selectedTarget} targets={targets} compareIds={compareIds} onCompare={toggleCompare} onAddTargetAtPick={onAddTargetAtPick} /></div> : <p className="mt-3 rounded-md border border-dashed border-line px-3 py-4 text-center text-xs text-ink-dim">No matching draft-relevant players. Try a name or team.</p>}
        {comparePlayers.length > 0 && <CompareSelectionBar players={comparePlayers} plannerPick={selectedTarget?.overallPick ?? null} plannerSearch={availabilityQuery} onClear={() => setCompareSelection({ overallPick: selectedTarget?.overallPick ?? null, playerIds: [] })} />}
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-xs text-ink-mute">{pickCount} picks in this scenario · {simulatedPickCount} simulated</p><div className="flex flex-wrap gap-2">{confirmingReset ? <><button type="button" onClick={() => { onReset(); setConfirmingReset(false); }} className="min-h-9 rounded-md bg-negative px-3 text-xs font-bold text-white">Confirm reset</button><button type="button" onClick={() => setConfirmingReset(false)} className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim">Cancel</button></> : <button type="button" disabled={!pickCount} onClick={() => setConfirmingReset(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-negative/50 px-3 text-xs font-semibold text-negative disabled:opacity-40"><Trash2 size={13} />Reset scenario</button>}{confirmingApply ? <><button type="button" onClick={() => { onApplyRoster(); setConfirmingApply(false); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-positive px-3 text-xs font-bold text-white"><Check size={13} />Confirm My Team update</button><button type="button" onClick={() => setConfirmingApply(false)} className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim">Cancel</button></> : <button type="button" disabled={!summary.playerCount} onClick={() => setConfirmingApply(true)} className="min-h-9 rounded-md border border-positive/50 px-3 text-xs font-semibold text-positive disabled:opacity-40">Apply roster to My Team</button>}</div></div>
    </>}
  </section>;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-md border border-line bg-surface-0 p-2"><strong className="block font-mono text-base text-ink">{value}</strong><span className="block text-[9px] text-ink-mute">{label}</span>{detail && <span className="block text-[8px] text-ink-mute">{detail}</span>}</div>;
}

function AvailabilityGroup({ title, description, items, tone, selectedTarget, targets, compareIds, onCompare, onAddTargetAtPick }: {
  title: string;
  description: string;
  items: PlayerAvailabilityEstimate[];
  tone: 'decision' | 'likely' | 'fall';
  selectedTarget?: PlannerPickTarget;
  targets: LeagueWorkspace['draftSession']['targets'];
  compareIds: string[];
  onCompare: (playerId: string) => void;
  onAddTargetAtPick: (playerId: string, overallPick: number) => void;
}) {
  if (!items.length) return null;
  const titleTone = tone === 'decision' ? 'text-warning' : tone === 'likely' ? 'text-positive' : 'text-negative';
  const borderTone = tone === 'decision' ? 'border-warning/40' : tone === 'likely' ? 'border-positive/35' : 'border-negative/35';
  return <section aria-label={title}>
    <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"><h4 className={`text-xs font-bold uppercase tracking-wide ${titleTone}`}>{title}</h4><p className="text-[9px] text-ink-mute">{description}</p></div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => { const compareSelected = compareIds.includes(item.playerId); const compareDisabled = compareIds.length >= 2 && !compareSelected; return <div key={item.playerId} className={`rounded-md border bg-surface-0 px-3 py-2 ${borderTone} ${compareSelected ? 'ring-1 ring-accent' : ''}`}><div className="flex items-center justify-between gap-2"><span className="min-w-0"><strong className="block truncate text-xs text-ink">{item.name}</strong><span className="text-[9px] text-ink-mute">{item.team} · {item.positions.join('/')} · Yahoo {item.yahooAdp?.toFixed(1) ?? '—'}</span></span><span className="text-right"><strong className={`block font-mono text-sm ${titleTone}`}>{formatAvailability(item.probability)}</strong><span className="text-[8px] text-ink-mute">{availabilityBand(item.probability)}</span></span></div><div className="mt-2 grid grid-cols-2 gap-1.5"><button type="button" aria-pressed={compareSelected} disabled={compareDisabled} onClick={() => onCompare(item.playerId)} className={`inline-flex min-h-8 items-center justify-center gap-1 rounded border text-[10px] font-semibold disabled:opacity-35 ${compareSelected ? 'border-accent bg-accent-muted text-accent' : 'border-line text-ink-dim'}`}><ArrowLeftRight size={11} />{compareSelected ? 'Selected' : 'Compare'}</button>{selectedTarget && <button type="button" onClick={() => onAddTargetAtPick(item.playerId, selectedTarget.overallPick)} className="min-h-8 rounded border border-accent/50 text-[10px] font-semibold text-accent">{targetActionLabel(targets, item.playerId, selectedTarget.overallPick)}</button>}</div></div>; })}</div>
  </section>;
}

function CompareSelectionBar({ players, plannerPick, plannerSearch, onClear }: { players: PlayerAvailabilityEstimate[]; plannerPick: number | null; plannerSearch: string; onClear: () => void }) {
  const ready = players.length === 2;
  const href = draftComparisonPath(players.map((player) => player.playerId), { plannerPick, plannerSearch }) ?? '';
  return <div className="sticky bottom-2 z-20 mt-4 flex flex-col gap-2 rounded-lg border border-accent/60 bg-surface-glass p-3 shadow-card backdrop-blur sm:flex-row sm:items-center sm:justify-between" aria-live="polite"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide text-accent">Quick compare · {players.length}/2</p><p className="truncate text-xs font-semibold text-ink">{players.map((player) => player.name).join(' vs ') || 'Choose two players'}</p></div><div className="flex gap-2">{ready ? <Link to={href} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-xs font-bold text-accent-ink sm:flex-none"><ArrowLeftRight size={13} />Compare players</Link> : <span className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md border border-line px-3 text-xs text-ink-mute sm:flex-none">Choose one more</span>}<button type="button" onClick={onClear} aria-label="Clear compare selection" className="grid size-9 place-items-center rounded-md border border-line text-ink-mute hover:text-negative"><X size={13} /></button></div></div>;
}

export function draftComparisonPath(playerIds: string[], planner?: { plannerPick: number | null; plannerSearch: string }): string | null {
  if (playerIds.length !== 2) return null;
  const params = new URLSearchParams({ mode: 'draft', a: playerIds[0], b: playerIds[1], from: 'draft-planner' });
  if (planner?.plannerPick) params.set('plannerPick', String(planner.plannerPick));
  if (planner?.plannerSearch.trim()) params.set('plannerSearch', planner.plannerSearch.trim());
  return `/compare?${params.toString()}`;
}

function formatAvailability(probability: number): string {
  if (probability >= 99.5) return '>99%';
  if (probability <= 0.5) return '<1%';
  return `${Math.round(probability)}%`;
}

function availabilityBand(probability: number): string {
  if (probability >= 80) return 'Can likely wait';
  if (probability >= 30) return 'Target around here';
  return 'Needs a fall';
}

function targetActionLabel(targets: LeagueWorkspace['draftSession']['targets'], playerId: string, overallPick: number): string {
  const assigned = targets.find((target) => target.playerId === playerId);
  if (assigned?.targetOverallPick === overallPick) return 'Targeted here';
  return targets.some((target) => target.targetOverallPick === overallPick) ? 'Add as backup' : 'Target this pick';
}

function ManualTargetCard({ item, targets, assignedTarget, onAddTarget }: {
  item: PlayerAvailabilityEstimate;
  targets: PlannerPickTarget[];
  assignedTarget?: LeagueWorkspace['draftSession']['targets'][number];
  onAddTarget: (playerId: string, overallPick: number) => void;
}) {
  return <article className="rounded-lg border border-line bg-surface-0 p-3">
    <div><strong className="text-sm text-ink">{item.name}</strong><p className="text-[10px] text-ink-mute">{item.team} · {item.positions.join('/')} · Yahoo ADP unavailable</p></div>
    <p className="mt-2 text-[10px] text-ink-dim">There is not enough Yahoo market data for a defensible availability percentage. Choose a round manually.</p>
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label={`${item.name} manual round targets`}>{targets.map((target) => <button key={target.overallPick} type="button" onClick={() => onAddTarget(item.playerId, target.overallPick)} className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold ${assignedTarget?.targetOverallPick === target.overallPick ? 'border-warning bg-warning-muted text-warning' : 'border-line text-ink-dim hover:border-accent hover:text-accent'}`}>R{target.round} · #{target.overallPick}</button>)}</div>
  </article>;
}

function AvailabilityCurveCard({ item, curve, selectedPick, assignedTarget, compareSelected, compareDisabled, onCompare, onPickChange, onAddTarget }: {
  item: PlayerAvailabilityEstimate;
  curve?: PlayerAvailabilityCurve;
  selectedPick: number | null;
  assignedTarget?: LeagueWorkspace['draftSession']['targets'][number];
  compareSelected: boolean;
  compareDisabled: boolean;
  onCompare: () => void;
  onPickChange: (overallPick: number) => void;
  onAddTarget: (playerId: string, overallPick: number) => void;
}) {
  const points = curve?.points ?? [];
  let safer: PlayerAvailabilityCurve['points'][number] | undefined;
  let aggressive: PlayerAvailabilityCurve['points'][number] | undefined;
  for (const point of points) {
    if (point.probability >= 50) safer = point;
    else if (!aggressive) aggressive = point;
  }
  if (!aggressive && !safer) aggressive = points[0];
  const selectedPoint = points.find((point) => point.overallPick === selectedPick);

  return <article className="rounded-lg border border-line bg-surface-0 p-3">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-sm text-ink">{item.name}</strong><p className="text-[10px] text-ink-mute">{item.team} · {item.positions.join('/')} · Yahoo {item.yahooAdp?.toFixed(1) ?? '—'}</p></div><div className="flex items-center gap-2">{assignedTarget?.targetOverallPick && <span className="rounded-full border border-warning/50 bg-warning-muted px-2 py-1 text-[9px] font-semibold text-warning">Targeted R{assignedTarget.targetRound} · #{assignedTarget.targetOverallPick}</span>}<button type="button" aria-pressed={compareSelected} disabled={compareDisabled} onClick={onCompare} className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold disabled:opacity-35 ${compareSelected ? 'border-accent bg-accent-muted text-accent' : 'border-line text-ink-dim'}`}><ArrowLeftRight size={11} />{compareSelected ? 'Selected' : 'Compare'}</button></div></div>
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label={`${item.name} availability curve`}>{points.map((point) => <button key={point.overallPick} type="button" onClick={() => onPickChange(point.overallPick)} className={`min-w-[64px] shrink-0 rounded-md border px-2 py-1.5 text-left ${point === aggressive ? 'border-warning/70 bg-warning-muted' : point === safer ? 'border-positive/60 bg-positive-muted' : 'border-line bg-surface-1'}`}><span className="block text-[8px] text-ink-mute">R{point.round} · #{point.overallPick}</span><strong className={`font-mono text-xs ${point.probability >= 70 ? 'text-positive' : point.probability >= 35 ? 'text-warning' : 'text-negative'}`}>{formatAvailability(point.probability)}</strong></button>)}</div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {safer && <button type="button" onClick={() => onAddTarget(item.playerId, safer!.overallPick)} className="min-h-10 rounded-md border border-positive/50 px-3 text-left text-[10px] text-positive"><strong className="block">Safer target: R{safer.round} · #{safer.overallPick}</strong>{formatAvailability(safer.probability)} chance still available</button>}
      {aggressive && <button type="button" onClick={() => onAddTarget(item.playerId, aggressive!.overallPick)} className="min-h-10 rounded-md border border-warning/60 px-3 text-left text-[10px] text-warning"><strong className="block">Aggressive target: R{aggressive.round} · #{aggressive.overallPick}</strong>{formatAvailability(aggressive.probability)} chance still available</button>}
      {selectedPoint && selectedPoint.overallPick !== safer?.overallPick && selectedPoint.overallPick !== aggressive?.overallPick && <button type="button" onClick={() => onAddTarget(item.playerId, selectedPoint.overallPick)} className="min-h-10 rounded-md border border-accent/60 px-3 text-left text-[10px] text-accent"><strong className="block">{assignedTarget?.targetOverallPick && assignedTarget.targetOverallPick !== selectedPoint.overallPick ? 'Move target to' : 'Target selected pick'}: R{selectedPoint.round} · #{selectedPoint.overallPick}</strong>{formatAvailability(selectedPoint.probability)} chance still available</button>}
    </div>
  </article>;
}
