import { configuredDraftRounds, draftOverallPickForTeam, nextDraftOverallPick, resolveDraftBoardPicks, resolvedDraftPosition } from '../../lib/draftRoom';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';

interface DraftGridProps {
  workspace: LeagueWorkspace;
  onDraftPositionChange: (position: number | null) => void;
}

function positionTone(positions: string[]): string {
  if (positions.includes('G')) return 'border-negative/45 bg-negative-muted';
  if (positions.includes('D')) return 'border-warning/45 bg-warning-muted';
  if (positions.includes('LW') || positions.includes('RW')) return 'border-positive/45 bg-positive-muted';
  return 'border-accent/45 bg-accent-muted';
}

function teamLabel(workspace: LeagueWorkspace, teamSlot: number, myPosition: number | null): string {
  if (teamSlot !== myPosition) return `Team ${teamSlot}`;
  return workspace.fantasyTeam.name.trim() || 'My team';
}

export function DraftGrid({ workspace, onDraftPositionChange }: DraftGridProps) {
  const teams = workspace.numberOfTeams;
  const rounds = configuredDraftRounds(workspace);
  const currentOverallPick = nextDraftOverallPick(workspace);
  const myPosition = resolvedDraftPosition(workspace);
  const picks = new Map(resolveDraftBoardPicks(workspace).map((entry) => [entry.overallPick, entry.pick]));
  const gridTemplateColumns = `3rem repeat(${teams}, minmax(7.5rem, 1fr))`;

  return <div>
    <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <p className="max-w-2xl text-xs text-ink-dim">Every Taken or Mine action lands in the next snake-draft cell. Use the grid to see positional runs, roster shapes, and who picks around you.</p>
      <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-ink-dim">
        My draft slot
        <select value={myPosition ?? ''} onChange={(event) => onDraftPositionChange(event.target.value ? Number(event.target.value) : null)} className="min-h-10 rounded-lg border border-line bg-surface-0 px-3 text-sm text-ink outline-none focus:border-accent">
          <option value="">Not set</option>
          {Array.from({ length: teams }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
        </select>
      </label>
    </div>

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
              const mine = teamSlot === myPosition;
              const current = overallPick === currentOverallPick;
              return <div key={`${round}-${teamSlot}`} aria-label={`Round ${round}, team ${teamSlot}, pick ${overallPick}${pick ? `, ${pick.fullName}` : ''}`} className={`relative min-h-[5.25rem] border p-2 ${pick ? positionTone(pick.positions) : 'border-transparent bg-surface-1'} ${mine ? 'border-x-accent/70' : ''} ${current ? 'z-[1] border-accent bg-accent-muted shadow-accent-soft' : ''}`}>
                <span className={`absolute right-1.5 top-1 text-[8px] ${current ? 'font-bold text-accent' : 'text-ink-mute'}`}>#{overallPick}</span>
                {pick ? <div className="flex h-full flex-col justify-between pt-2">
                  <strong className="line-clamp-2 text-xs leading-tight text-ink">{pick.fullName}</strong>
                  <span className="mt-2 flex items-center justify-between gap-1 text-[9px] text-ink-dim"><span>{pick.team}</span><span className="truncate">{pick.positions.join('/')}</span></span>
                </div> : current ? <div className="grid h-full place-items-center pt-2 text-center text-[10px] font-bold uppercase tracking-wide text-accent">On the clock</div> : null}
              </div>;
            }),
          ];
        })}
      </div>
    </div>
  </div>;
}
