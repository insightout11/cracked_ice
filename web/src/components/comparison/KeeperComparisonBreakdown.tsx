import { Info, ShieldCheck } from 'lucide-react';
import type { KeeperComparison, KeeperFactorKey } from '../../lib/keeperAnalysis';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import type { DraftPlayer } from '../../lib/playerSearch';

interface KeeperComparisonBreakdownProps {
  analysis: KeeperComparison;
  playerA: DraftPlayer;
  playerB: DraftPlayer;
  workspace: LeagueWorkspace;
  onWorkspaceChange: (workspace: LeagueWorkspace) => void;
}

const LABELS: Record<KeeperFactorKey, string> = {
  currentValue: 'Current league value',
  ageTrajectory: 'Age + trajectory',
  role: 'NHL / PP role',
  durability: 'Recent availability',
  scarcity: 'Position scarcity',
};

export function KeeperComparisonBreakdown({ analysis, playerA, playerB, workspace, onWorkspaceChange }: KeeperComparisonBreakdownProps) {
  const options = [{ player: playerA, profile: analysis.optionA }, { player: playerB, profile: analysis.optionB }];
  const updateRules = (patch: Partial<LeagueWorkspace['keeperRules']>) => onWorkspaceChange({ ...workspace, keeperRules: { ...workspace.keeperRules, ...patch }, updatedAt: new Date().toISOString() });
  return <section className="rounded-xl border border-line-strong bg-surface-glass p-5 shadow-card" aria-labelledby="keeper-profile-heading">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><p className="scoreboard-text text-accent">KEEPER PROFILE</p><h2 id="keeper-profile-heading" className="mt-1 text-xl font-semibold text-ink">{analysis.verdict}</h2><p className="mt-1 max-w-3xl text-sm text-ink-dim">{analysis.explanation}</p></div>
      <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[31rem]">
        <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Horizon<select value={workspace.keeperRules.horizon} onChange={(event) => updateRules({ horizon: event.target.value as LeagueWorkspace['keeperRules']['horizon'] })} className="min-h-10 rounded-md border border-line bg-surface-0 px-2 text-xs normal-case tracking-normal text-ink"><option value="next-season">Next season</option><option value="two-to-three-years">2–3 years</option></select></label>
        <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Max keepers<input type="number" min="0" max="50" value={workspace.keeperRules.maximumKeepers ?? ''} placeholder="Unknown" onChange={(event) => updateRules({ maximumKeepers: event.target.value === '' ? null : Number(event.target.value) })} className="min-h-10 rounded-md border border-line bg-surface-0 px-2 text-xs normal-case tracking-normal text-ink" /></label>
        <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Keeper cost<select value={workspace.keeperRules.costSystem} onChange={(event) => updateRules({ costSystem: event.target.value as LeagueWorkspace['keeperRules']['costSystem'] })} className="min-h-10 rounded-md border border-line bg-surface-0 px-2 text-xs normal-case tracking-normal text-ink"><option value="none">No cost</option><option value="draft-round">Draft round</option><option value="salary">Salary</option></select></label>
      </div>
    </div>

    <div className="mt-5 rounded-lg border border-line bg-surface-0 px-3 py-2 text-xs text-ink-dim"><Info size={14} className="mr-2 inline text-accent" />The score uses visible NHL evidence only. Upcoming schedule is intentionally excluded from the 2–3 year outlook; prospects, contracts, and future picks are not modeled.</div>

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {options.map(({ player, profile }) => <article key={player.id} className={`rounded-lg border p-4 ${analysis.winnerId === player.id ? 'border-accent bg-accent-muted' : 'border-line bg-surface-0'}`}>
        <div className="flex items-start justify-between gap-3"><div><strong className="text-base text-ink">{player.name}</strong><p className="text-xs text-ink-mute">Age {profile.age ?? 'unknown'} · {profile.evidence.recentSeasons} NHL season{profile.evidence.recentSeasons === 1 ? '' : 's'} · {profile.confidence} confidence</p></div><div className="text-right"><strong className="font-mono text-2xl text-accent">{profile.total}</strong><span className="block text-[10px] text-ink-mute">profile / 100</span></div></div>
        <div className="mt-4 space-y-2">{(Object.keys(LABELS) as KeeperFactorKey[]).map((key) => <div key={key} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2"><span className="text-[11px] text-ink-dim">{LABELS[key]}</span><span className="h-2 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-accent" style={{ width: `${profile.factors[key]}%` }} /></span><strong className="text-right font-mono text-xs text-ink">{profile.factors[key].toFixed(0)}</strong></div>)}</div>
        <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs sm:grid-cols-4"><div><dt className="text-ink-mute">League FPPG</dt><dd className="font-semibold text-ink">{profile.evidence.leagueFppg.toFixed(2)}</dd></div><div><dt className="text-ink-mute">NHL GP</dt><dd className="font-semibold text-ink">{profile.evidence.nhlGamesPlayed}</dd></div><div><dt className="text-ink-mute">Avg TOI</dt><dd className="font-semibold text-ink">{profile.evidence.avgToiMinutes?.toFixed(1) ?? '—'} min</dd></div><div><dt className="text-ink-mute">PP TOI</dt><dd className="font-semibold text-ink">{profile.evidence.ppToiMinutes?.toFixed(1) ?? '—'} min</dd></div></dl>
        {workspace.keeperRules.costSystem !== 'none' && <p className="mt-3 text-xs text-ink-dim"><ShieldCheck size={13} className="mr-1 inline text-positive" />Keeper cost: {profile.costLabel ?? 'not entered yet'}</p>}
      </article>)}
    </div>
  </section>;
}
