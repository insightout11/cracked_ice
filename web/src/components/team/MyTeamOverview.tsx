import { ArrowLeftRight, CalendarDays, Repeat2, ShieldCheck, SlidersHorizontal, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { LeagueWorkspace, LeagueWorkspaceRosterEntry } from '../../lib/leagueWorkspace';
import { analyzeKeeperRosterPlan, type MyTeamAnalysis } from '../../lib/myTeamAnalysis';
import { Button } from '../ui/button';

interface MyTeamOverviewProps {
  workspace: LeagueWorkspace;
  roster: RosterPlayer[];
  analysis: MyTeamAnalysis;
  compact?: boolean;
  onManageRoster: () => void;
  onOpenSettings: () => void;
  onToggleKeeper: (playerId: string) => void;
  onToggleProtected: (playerId: string) => void;
  onCompareKeeper: (playerId: string) => void;
  onKeeperCostChange: (playerId: string, cost: LeagueWorkspaceRosterEntry['keeperCost']) => void;
}

function Metric({ value, label, tone = 'text-accent' }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <p className={`scoreboard-number text-xl ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-dim">{label}</p>
    </div>
  );
}

export function MyTeamOverview({
  workspace,
  roster,
  analysis,
  compact = false,
  onManageRoster,
  onOpenSettings,
  onToggleKeeper,
  onToggleProtected,
  onCompareKeeper,
  onKeeperCostChange,
}: MyTeamOverviewProps) {
  const entryById = new Map(workspace.roster.map((entry) => [entry.playerId, entry]));
  const freshness = workspace.freshness.syncedAt ?? workspace.freshness.importedAt ?? workspace.updatedAt;
  const keeperPlan = analyzeKeeperRosterPlan(workspace);

  return (
    <section className={`rounded-lg border border-line bg-surface-glass shadow-raised [backdrop-filter:var(--frost)] ${compact ? 'p-3' : 'p-4'}`} aria-labelledby="my-team-overview-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="scoreboard-text text-accent">MY TEAM</p>
          <h1 id="my-team-overview-title" className="mt-1 text-xl font-semibold text-ink">Roster attention</h1>
          {!compact && <p className="mt-1 text-sm text-ink-dim">What needs a decision in the current analysis window.</p>}
        </div>
        {!compact && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onOpenSettings}><SlidersHorizontal size={15} />League settings</Button>
            <Button type="button" size="sm" onClick={onManageRoster}><UserRoundCheck size={15} />Manage roster</Button>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-2 gap-2 ${compact ? 'mt-2' : 'mt-4 lg:grid-cols-6'}`}>
        <Metric value={analysis.emptyActiveSlots} label="empty roster slots" tone={analysis.emptyActiveSlots ? 'text-warning' : 'text-positive'} />
        <Metric value={analysis.projectedBenchGames} label="games lost to congestion" tone={analysis.projectedBenchGames ? 'text-warning' : 'text-positive'} />
        <Metric value={analysis.gapNights} label="nights with lineup room" />
        <Metric value={analysis.movesRemaining ?? '—'} label={analysis.movesRemaining === null ? 'moves remaining not set' : 'moves remaining'} />
        {!compact && <Metric value={analysis.unusedLineupOpportunities} label="unused lineup opportunities" />}
        {!compact && <Metric value={analysis.offNightStarts} label="projected off-night starts" tone="text-positive" />}
      </div>

      {!compact && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="rounded-md border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarDays size={16} className="text-accent" />Roster construction</div>
            <p className="mt-2 text-sm text-ink-dim">
              {analysis.positionNeeds.length
                ? analysis.positionNeeds.map((need) => `${need.position} ×${need.count}`).join(' · ')
                : 'All configured active positions are filled.'}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-ink-dim"><Repeat2 size={14} />{analysis.backToBacks} player back-to-backs in this window</p>
          </div>

          <div className="rounded-md border border-line bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck size={16} className="text-positive" />Keepers and protected players</div>
              <span className="text-xs text-ink-dim">{analysis.keeperCount} keepers · {analysis.protectedCount} protected</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-0 px-3 py-2">
              <p className="text-xs text-ink-dim">
                <span className="font-semibold text-ink">Keeper limit:</span>{' '}
                {keeperPlan.maximumKeepers === null ? 'not set' : `${keeperPlan.keeperCount}/${keeperPlan.maximumKeepers}`}
                {' · '}<span className="font-semibold text-ink">After keepers:</span>{' '}
                {keeperPlan.positionNeeds.length
                  ? keeperPlan.positionNeeds.map((need) => `${need.position} ×${need.count}`).join(' · ')
                  : 'all active roster positions occupied'}
              </p>
              <Link to="/?tool=draft" className="text-xs font-semibold text-accent hover:underline">Open updated draft board</Link>
            </div>
            {roster.length ? (
              <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                {roster.map((player) => {
                  const entry = entryById.get(player.id);
                  return (
                    <div key={player.id} className="flex items-center gap-1 rounded-md border border-line bg-surface-1 px-2 py-1">
                      <span className="mr-1 max-w-40 truncate text-xs text-ink">{player.full_name}</span>
                      <button type="button" className={`rounded px-2 py-1 text-xs ${entry?.keeper ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:bg-surface-2'}`} aria-pressed={entry?.keeper ?? false} onClick={() => onToggleKeeper(player.id)}>Keeper</button>
                      {entry?.keeper && workspace.keeperRules.costSystem === 'draft-round' && <input aria-label={`${player.full_name} keeper round`} type="number" min="1" max="50" value={entry.keeperCost?.type === 'draft-round' ? entry.keeperCost.round : ''} placeholder="Rnd" onChange={(event) => onKeeperCostChange(player.id, event.target.value ? { type: 'draft-round', round: Number(event.target.value) } : undefined)} className="h-7 w-14 rounded border border-line bg-surface-0 px-1.5 text-xs text-ink outline-none focus:border-accent" />}
                      {entry?.keeper && workspace.keeperRules.costSystem === 'salary' && <input aria-label={`${player.full_name} keeper salary`} type="number" min="0" step="0.1" value={entry.keeperCost?.type === 'salary' ? entry.keeperCost.amount : ''} placeholder="$" onChange={(event) => onKeeperCostChange(player.id, event.target.value ? { type: 'salary', amount: Number(event.target.value), currency: entry.keeperCost?.type === 'salary' ? entry.keeperCost.currency : 'USD' } : undefined)} className="h-7 w-16 rounded border border-line bg-surface-0 px-1.5 text-xs text-ink outline-none focus:border-accent" />}
                      <button type="button" className={`rounded px-2 py-1 text-xs ${entry?.protected ? 'bg-positive-muted text-positive' : 'text-ink-dim hover:bg-surface-2'}`} aria-pressed={entry?.protected ?? false} onClick={() => onToggleProtected(player.id)}>Protected</button>
                      <button type="button" aria-label={`Compare ${player.full_name} as a keeper`} className="rounded p-1 text-ink-dim hover:bg-surface-2 hover:text-accent" onClick={() => onCompareKeeper(player.id)}><ArrowLeftRight size={14} /></button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mt-2 text-sm text-ink-dim">Add your roster to mark keepers before the draft.</p>}
          </div>
        </div>
      )}

      {compact && (
        <div className="mt-3 rounded-md border border-line bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink">Keeper setup</span>
            <span className="text-[10px] text-ink-mute">{keeperPlan.keeperCount}{keeperPlan.maximumKeepers === null ? '' : `/${keeperPlan.maximumKeepers}`} selected</span>
          </div>
          {roster.length ? <div className="mt-2 grid gap-2">
            {roster.map((player) => {
              const entry = entryById.get(player.id);
              return <div key={player.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-1 px-2 py-2">
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{player.full_name}</span>
                <button type="button" aria-pressed={entry?.keeper ?? false} className={`rounded px-2 py-1 text-xs font-semibold ${entry?.keeper ? 'bg-accent text-accent-ink' : 'border border-line text-ink-dim'}`} onClick={() => onToggleKeeper(player.id)}>{entry?.keeper ? 'Keeper' : 'Mark keeper'}</button>
                {entry?.keeper && workspace.keeperRules.costSystem === 'draft-round' && <input aria-label={`${player.full_name} keeper round`} type="number" min="1" max="50" value={entry.keeperCost?.type === 'draft-round' ? entry.keeperCost.round : ''} placeholder="Round" onChange={(event) => onKeeperCostChange(player.id, event.target.value ? { type: 'draft-round', round: Number(event.target.value) } : undefined)} className="h-8 w-16 rounded border border-line bg-surface-0 px-2 text-xs text-ink" />}
                {entry?.keeper && workspace.keeperRules.costSystem === 'salary' && <input aria-label={`${player.full_name} keeper salary`} type="number" min="0" step="0.1" value={entry.keeperCost?.type === 'salary' ? entry.keeperCost.amount : ''} placeholder="Salary" onChange={(event) => onKeeperCostChange(player.id, event.target.value ? { type: 'salary', amount: Number(event.target.value), currency: entry.keeperCost?.type === 'salary' ? entry.keeperCost.currency : 'USD' } : undefined)} className="h-8 w-20 rounded border border-line bg-surface-0 px-2 text-xs text-ink" />}
                <button type="button" aria-label={`Compare ${player.full_name} as a keeper`} className="rounded border border-line p-1.5 text-ink-dim hover:text-accent" onClick={() => onCompareKeeper(player.id)}><ArrowLeftRight size={14} /></button>
              </div>;
            })}
          </div> : <p className="mt-2 text-xs text-ink-dim">Add players to set up keepers.</p>}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-dim">
        {compact
          ? `${workspace.season.label} · ${workspace.scoring.label}`
          : `${workspace.season.label} · ${workspace.scoring.label} · ${workspace.source.label} · Updated ${new Date(freshness).toLocaleString()}`}
      </p>
    </section>
  );
}
