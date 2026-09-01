import { useState } from 'react';
import { BarChart3, Pencil, Target, X } from 'lucide-react';
import { configuredDraftRounds, draftOverallPickForTeam, nextDraftOverallPick, resolveDraftBoardPicks, resolvedDraftPosition } from '../../lib/draftRoom';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';

interface DraftGridProps {
  workspace: LeagueWorkspace;
  onDraftPositionChange: (position: number | null) => void;
  onRemovePick: (overallPick: number) => void;
  onTeamNameChange: (teamSlot: number, name: string) => void;
  availabilityPick?: number | null;
  onAvailabilityPickChange?: (overallPick: number) => void;
}

function positionTone(positions: string[]): string {
  if (positions.includes('G')) return 'border-negative/45 bg-negative-muted';
  if (positions.includes('D')) return 'border-warning/45 bg-warning-muted';
  if (positions.includes('LW') || positions.includes('RW')) return 'border-positive/45 bg-positive-muted';
  return 'border-accent/45 bg-accent-muted';
}

function teamLabel(workspace: LeagueWorkspace, teamSlot: number, myPosition: number | null): string {
  if (teamSlot === myPosition) return workspace.fantasyTeam.name.trim() || 'My team';
  return workspace.draftSession.teamNames[String(teamSlot)]?.trim() || `Team ${teamSlot}`;
}

export function DraftGrid({ workspace, onDraftPositionChange, onRemovePick, onTeamNameChange, availabilityPick, onAvailabilityPickChange }: DraftGridProps) {
  const [editingTeams, setEditingTeams] = useState(false);
  const teams = workspace.numberOfTeams;
  const rounds = configuredDraftRounds(workspace);
  const currentOverallPick = nextDraftOverallPick(workspace);
  const myPosition = resolvedDraftPosition(workspace);
  const picks = new Map(resolveDraftBoardPicks(workspace).map((entry) => [entry.overallPick, entry.pick]));
  const rosterById = new Map(workspace.roster.map((entry) => [entry.playerId.replace(/^nhl:/, ''), entry]));
  const keeperPicks = new Map(workspace.draftSession.keeperPickAssignments.flatMap((assignment) => {
    const keeper = rosterById.get(assignment.playerId.replace(/^nhl:/, ''));
    return keeper ? [[assignment.overallPick, keeper] as const] : [];
  }));
  const draftedIds = new Set(workspace.draftSession.picks.map((pick) => pick.playerId.replace(/^nhl:/, '')));
  const targetsByPick = new Map<number, LeagueWorkspace['draftSession']['targets']>();
  workspace.draftSession.targets.forEach((target) => {
    if (!target.targetOverallPick || draftedIds.has(target.playerId.replace(/^nhl:/, ''))) return;
    const targets = targetsByPick.get(target.targetOverallPick) ?? [];
    targets.push(target);
    targetsByPick.set(target.targetOverallPick, targets);
  });
  targetsByPick.forEach((targets) => targets.sort((a, b) => a.backupOrder - b.backupOrder));
  const gridTemplateColumns = `3rem repeat(${teams}, minmax(7.5rem, 1fr))`;

  return <div>
    <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <p className="max-w-2xl text-xs text-ink-dim">{workspace.draftSession.mode === 'planner' ? 'Mine fills your next open slot; Taken and simulations fill opponent slots.' : 'Every Taken or Mine action lands in the next open snake-draft cell.'} Use the grid to see positional runs, roster shapes, and who picks around you.</p>
      <div className="flex flex-wrap items-center gap-2"><label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-ink-dim">My draft slot<select value={myPosition ?? ''} onChange={(event) => onDraftPositionChange(event.target.value ? Number(event.target.value) : null)} className="min-h-10 rounded-lg border border-line bg-surface-0 px-3 text-sm text-ink outline-none focus:border-accent"><option value="">Not set</option>{Array.from({ length: teams }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><button type="button" onClick={() => setEditingTeams((value) => !value)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"><Pencil size={13} />{editingTeams ? 'Done' : 'Team names'}</button></div>
    </div>

    {editingTeams && <div className="grid gap-2 border-b border-line bg-surface-0 p-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: teams }, (_, index) => { const teamSlot = index + 1; const mine = teamSlot === myPosition; return <label key={teamSlot} className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{mine ? 'My team' : `Team ${teamSlot}`}<input value={teamLabel(workspace, teamSlot, myPosition)} disabled={mine} onChange={(event) => onTeamNameChange(teamSlot, event.target.value)} className="mt-1 min-h-9 w-full rounded-md border border-line bg-surface-1 px-2 text-xs normal-case tracking-normal text-ink outline-none focus:border-accent disabled:opacity-60" /></label>; })}</div>}

    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-0 px-4 py-2 text-[10px] text-ink-mute sm:px-5">
      <span><i className="mr-1 inline-block size-2 rounded-sm bg-accent" />C</span>
      <span><i className="mr-1 inline-block size-2 rounded-sm bg-positive" />Wing</span>
      <span><i className="mr-1 inline-block size-2 rounded-sm bg-warning" />D</span>
      <span><i className="mr-1 inline-block size-2 rounded-sm bg-negative" />G</span>
      <span className="sm:ml-auto">Swipe horizontally on mobile. Your column is outlined.</span>
    </div>

    <div className="max-h-[70vh] overflow-auto" role="region" aria-label="Team by round draft board" tabIndex={0}>
      <div className="grid min-w-max gap-px bg-line" style={{ gridTemplateColumns }}>
        <div className="sticky left-0 top-0 z-30 grid min-h-12 place-items-center bg-surface-2 text-[9px] font-bold uppercase tracking-wide text-ink-mute">Rd</div>
        {Array.from({ length: teams }, (_, index) => {
          const teamSlot = index + 1;
          const mine = teamSlot === myPosition;
          return <div key={teamSlot} className={`sticky top-0 z-20 flex min-h-12 items-center justify-center bg-surface-2 px-2 text-center text-[10px] font-bold uppercase tracking-wide ${mine ? 'border-x border-accent text-accent' : 'text-ink-dim'}`}>
            <span className="max-w-28 truncate">{teamLabel(workspace, teamSlot, myPosition)}</span>
          </div>;
        })}

        {Array.from({ length: rounds }, (_, roundIndex) => {
          const round = roundIndex + 1;
          return [
            <div key={`round-${round}`} className="sticky left-0 z-10 grid min-h-[5.25rem] place-items-center bg-surface-2 font-mono text-xs font-bold text-ink-dim">{round}</div>,
            ...Array.from({ length: teams }, (_, teamIndex) => {
              const teamSlot = teamIndex + 1;
              const overallPick = draftOverallPickForTeam(round, teamSlot, teams);
              const pick = picks.get(overallPick);
              const keeper = keeperPicks.get(overallPick);
              const occupant = pick ?? keeper;
              const mine = teamSlot === myPosition;
              const current = overallPick === currentOverallPick;
              const availabilityTarget = workspace.draftSession.mode === 'planner' && mine && !occupant && Boolean(onAvailabilityPickChange);
              const targetPlan = availabilityTarget ? targetsByPick.get(overallPick) : undefined;
              const backupCount = Math.max(0, (targetPlan?.length ?? 0) - 1);
              const checkingAvailability = availabilityTarget && availabilityPick === overallPick;
              return <div key={`${round}-${teamSlot}`} aria-label={`Round ${round}, team ${teamSlot}, pick ${overallPick}${occupant ? `, ${occupant.fullName}${keeper ? ', keeper' : ''}` : targetPlan?.length ? `, target ${targetPlan[0].fullName}${backupCount ? ` with ${backupCount} backup${backupCount === 1 ? '' : 's'}` : ''}` : ''}`} className={`relative min-h-[5.25rem] border p-2 ${occupant ? positionTone(occupant.positions) : targetPlan?.length ? 'border-warning/70 bg-warning-muted/60' : 'border-transparent bg-surface-1'} ${mine ? 'border-x-accent/70' : ''} ${current ? 'z-[1] border-accent bg-accent-muted shadow-accent-soft' : ''} ${checkingAvailability ? 'z-[1] border-positive bg-positive-muted shadow-card' : ''}`}>
                <span className={`absolute right-1.5 top-1 text-[8px] ${current ? 'font-bold text-accent' : 'text-ink-mute'}`}>#{overallPick}</span>
                {occupant ? <div className="flex h-full flex-col justify-between pt-2">
                  {pick ? <button type="button" onClick={() => onRemovePick(overallPick)} aria-label={`Remove ${pick.fullName} at pick ${overallPick}`} className="absolute left-1 top-1 grid size-6 place-items-center rounded-md text-ink-mute hover:bg-surface-0 hover:text-negative"><X size={12} /></button> : <span className="absolute left-1 top-1 rounded bg-surface-0/70 px-1.5 py-0.5 text-[8px] font-bold uppercase text-accent">Keeper</span>}
                  <strong className="line-clamp-2 pl-5 text-xs leading-tight text-ink">{occupant.fullName}</strong>
                  <span className="mt-2 flex items-center justify-between gap-1 text-[9px] text-ink-dim"><span>{occupant.team}</span><span className="truncate">{occupant.positions.join('/')}</span></span>
                </div> : targetPlan?.length ? <button type="button" onClick={() => onAvailabilityPickChange?.(overallPick)} aria-pressed={checkingAvailability} aria-label={`View targets at round ${round}, pick ${overallPick}`} className="flex h-full w-full flex-col justify-between pt-2 text-left"><span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wide text-warning"><Target size={11} />Primary target</span><strong className="line-clamp-2 text-xs leading-tight text-ink">{targetPlan[0].fullName}</strong><span className="text-[9px] text-ink-dim">{backupCount ? `+${backupCount} backup${backupCount === 1 ? '' : 's'}` : checkingAvailability ? 'Viewing availability' : 'Click to review'}</span></button> : availabilityTarget ? <button type="button" onClick={() => onAvailabilityPickChange?.(overallPick)} aria-pressed={checkingAvailability} aria-label={`Check player availability at round ${round}, pick ${overallPick}`} className={`grid h-full w-full place-items-center gap-1 pt-2 text-center text-[9px] font-bold uppercase tracking-wide ${checkingAvailability ? 'text-positive' : current ? 'text-accent' : 'text-ink-mute hover:text-accent'}`}><BarChart3 size={14} /><span>{checkingAvailability ? 'Checking availability' : current ? 'On the clock · check availability' : 'Check availability'}</span></button> : current ? <div className="grid h-full place-items-center pt-2 text-center text-[10px] font-bold uppercase tracking-wide text-accent">On the clock</div> : null}
              </div>;
            }),
          ];
        })}
      </div>
    </div>
  </div>;
}
