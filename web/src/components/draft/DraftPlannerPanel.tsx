import { useState } from 'react';
import { BarChart3, Check, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type { DraftRosterProjectionSummary } from '../../lib/draftStrategy';
import type { PlayerAvailabilityEstimate } from '../../lib/draftPlanner';

interface DraftPlannerPanelProps {
  mode: 'planner' | 'live';
  projectionLabel: string;
  hasDraftPosition: boolean;
  pickCount: number;
  simulatedPickCount: number;
  numberOfTeams: number;
  summary: DraftRosterProjectionSummary;
  availability: PlayerAvailabilityEstimate[];
  onModeChange: (mode: 'planner' | 'live') => void;
  onTeamCountChange: (teams: number) => void;
  onSimulateToNext: () => void;
  onSimulateRest: () => void;
  onReroll: () => void;
  onReset: () => void;
  onApplyRoster: () => void;
}

export function DraftPlannerPanel({ mode, projectionLabel, hasDraftPosition, pickCount, simulatedPickCount, numberOfTeams, summary, availability, onModeChange, onTeamCountChange, onSimulateToNext, onSimulateRest, onReroll, onReset, onApplyRoster }: DraftPlannerPanelProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingApply, setConfirmingApply] = useState(false);
  const [confirmingLive, setConfirmingLive] = useState(false);
  const planner = mode === 'planner';
  return <section className="overflow-hidden rounded-xl border border-line bg-surface-1" aria-label="Draft mode and planning controls">
    <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-start lg:justify-between">
      <div><p className="scoreboard-text text-accent">DRAFT MODE</p><h2 className="mt-0.5 text-lg font-semibold text-ink">{planner ? 'Planning sandbox' : 'Live draft tracker'}</h2><p className="mt-1 max-w-2xl text-xs text-ink-dim">{planner ? 'Scenario picks power recommendations and team projections without changing My Team.' : 'Mine selections sync to My Team while you track the real draft.'}</p></div>
      <div className="flex flex-wrap items-center gap-2"><label className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Teams<select aria-label="Draft team count" value={numberOfTeams} disabled={pickCount > 0} onChange={(event) => onTeamCountChange(Number(event.target.value))} className="ml-2 min-h-10 rounded-lg border border-line bg-surface-0 px-2 text-sm normal-case tracking-normal text-ink disabled:opacity-50">{Array.from({ length: 31 }, (_, index) => index + 2).map((teams) => <option key={teams} value={teams}>{teams}</option>)}</select></label><div className="inline-flex self-start rounded-lg border border-line bg-surface-0 p-1" aria-label="Draft mode"><button type="button" onClick={() => { setConfirmingLive(false); onModeChange('planner'); }} aria-pressed={planner} className={`rounded-md px-3 py-2 text-xs font-semibold ${planner ? 'bg-accent text-accent-ink' : 'text-ink-dim'}`}>Planner</button><button type="button" onClick={() => pickCount > 0 && planner ? setConfirmingLive(true) : onModeChange('live')} aria-pressed={!planner} className={`rounded-md px-3 py-2 text-xs font-semibold ${!planner ? 'bg-accent text-accent-ink' : 'text-ink-dim'}`}>Live</button></div></div>
    </div>

    {confirmingLive && <div className="flex flex-col gap-2 border-b border-warning/30 bg-warning-muted px-4 py-3 text-xs text-warning sm:flex-row sm:items-center sm:justify-between"><p>Live mode will add your scenario selections to My Team. Continue?</p><div className="flex gap-2"><button type="button" onClick={() => { onModeChange('live'); setConfirmingLive(false); }} className="min-h-9 rounded-md bg-warning px-3 font-bold text-surface-0">Switch to Live</button><button type="button" onClick={() => setConfirmingLive(false)} className="min-h-9 rounded-md border border-warning/50 px-3 font-semibold">Cancel</button></div></div>}

    {planner && <>
      <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1.2fr_1fr]">
        <div><div className="flex flex-wrap gap-2"><button type="button" disabled={!hasDraftPosition} onClick={onSimulateToNext} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-bold text-accent-ink disabled:opacity-40"><Sparkles size={14} />Simulate to my next pick</button><button type="button" disabled={!hasDraftPosition} onClick={onSimulateRest} className="min-h-10 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent disabled:opacity-40">Fill opponent picks</button>{simulatedPickCount > 0 && <button type="button" onClick={onReroll} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"><RotateCcw size={13} />Reroll opponents</button>}</div><p className="mt-2 text-[10px] text-ink-mute">Yahoo ADP with controlled variance · {projectionLabel} evaluates your choices. {!hasDraftPosition && 'Set My draft slot in the grid first.'}</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Players" value={summary.playerCount} /><Metric label="Regular starts" value={summary.regularStarts} /><Metric label="Regular points" value={summary.regularPoints.toFixed(1)} /><Metric label="Playoff points" value={summary.playoffPoints.toFixed(1)} detail={`${summary.playoffStarts} starts`} /></div>
      </div>

      {availability.length > 0 && <div className="border-b border-line p-4"><div className="flex items-center gap-2"><BarChart3 size={15} className="text-accent" /><div><h3 className="text-sm font-semibold text-ink">Likely available at your next pick</h3><p className="text-[10px] text-ink-mute">Estimated from 200 Yahoo-ADP rooms with draft-order variance.</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{availability.slice(0, 8).map((item, index) => <div key={item.playerId} className={`${index >= 4 ? 'hidden sm:flex' : 'flex'} items-center justify-between gap-2 rounded-md border border-line bg-surface-0 px-3 py-2`}><span className="min-w-0"><strong className="block truncate text-xs text-ink">{item.name}</strong><span className="text-[9px] text-ink-mute">Yahoo {item.yahooAdp?.toFixed(1) ?? '—'}</span></span><strong className={`font-mono text-sm ${item.probability >= 70 ? 'text-positive' : item.probability >= 35 ? 'text-warning' : 'text-negative'}`}>{item.probability}%</strong></div>)}</div></div>}

      <div className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-xs text-ink-mute">{pickCount} picks in this scenario · {simulatedPickCount} simulated</p><div className="flex flex-wrap gap-2">{confirmingReset ? <><button type="button" onClick={() => { onReset(); setConfirmingReset(false); }} className="min-h-9 rounded-md bg-negative px-3 text-xs font-bold text-white">Confirm reset</button><button type="button" onClick={() => setConfirmingReset(false)} className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim">Cancel</button></> : <button type="button" disabled={!pickCount} onClick={() => setConfirmingReset(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-negative/50 px-3 text-xs font-semibold text-negative disabled:opacity-40"><Trash2 size={13} />Reset scenario</button>}{confirmingApply ? <><button type="button" onClick={() => { onApplyRoster(); setConfirmingApply(false); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-positive px-3 text-xs font-bold text-white"><Check size={13} />Confirm My Team update</button><button type="button" onClick={() => setConfirmingApply(false)} className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim">Cancel</button></> : <button type="button" disabled={!summary.playerCount} onClick={() => setConfirmingApply(true)} className="min-h-9 rounded-md border border-positive/50 px-3 text-xs font-semibold text-positive disabled:opacity-40">Apply roster to My Team</button>}</div></div>
    </>}
  </section>;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-md border border-line bg-surface-0 p-2"><strong className="block font-mono text-base text-ink">{value}</strong><span className="block text-[9px] text-ink-mute">{label}</span>{detail && <span className="block text-[8px] text-ink-mute">{detail}</span>}</div>;
}
