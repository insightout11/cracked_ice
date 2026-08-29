import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Check, Search } from 'lucide-react';
import { buildNextSeasonProjectionMap } from '../../lib/draftProjection';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import type { DraftPlayer } from '../../lib/playerSearch';
import { CONSENSUS_PROJECTION_ID, CRACKED_ICE_PROJECTION_ID } from '../../lib/projectionImport';
import { Button } from '../ui/button';

type SortKey = 'disagreement' | 'name' | 'adp';

interface ComparisonValue {
  fppg: number;
  games: number;
  stats?: Record<string, number>;
}

interface ComparisonRow {
  player: DraftPlayer;
  values: Record<string, ComparisonValue | undefined>;
  spread: number;
}

const SOURCE_COLORS = ['text-accent', 'text-positive', 'text-warning', 'text-[#d19cff]', 'text-[#ff91ad]', 'text-[#8fd3ff]'];

function normalizeId(id: string) {
  return id.replace(/^nhl:/, '');
}

function compactStatLine(stats: Record<string, number> | undefined, goalie: boolean): string | null {
  if (!stats) return null;
  const fields = goalie
    ? [['wins', 'W'], ['saves', 'SV'], ['goals_against', 'GA'], ['shutouts', 'SO']]
    : [['goals', 'G'], ['assists', 'A'], ['powerplay_points', 'PPP'], ['shots_on_goal', 'SOG']];
  const parts = fields.flatMap(([key, label]) => stats[key] === undefined ? [] : [`${label} ${Number(stats[key].toFixed(1))}`]);
  return parts.length ? parts.join(' · ') : null;
}

export function ProjectionComparisonPanel({
  workspace,
  directory,
  onChange,
}: {
  workspace: LeagueWorkspace;
  directory: DraftPlayer[];
  onChange: (workspace: LeagueWorkspace) => void;
}) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('disagreement');
  const selectedIds = workspace.projections.consensusSourceIds;
  const availableSources = [
    { id: CRACKED_ICE_PROJECTION_ID, label: 'Cracked Ice', matchedCount: directory.length },
    ...workspace.projections.sources.map((source) => ({ id: source.id, label: source.label, matchedCount: source.matchedCount })),
  ];

  const rows = useMemo(() => {
    const crackedIce = buildNextSeasonProjectionMap(directory, workspace.season.start);
    return directory.map((player): ComparisonRow => {
      const id = normalizeId(player.id);
      const ci = crackedIce.get(id);
      const values: ComparisonRow['values'] = {
        [CRACKED_ICE_PROJECTION_ID]: ci ? { fppg: ci.projectedFppg, games: ci.projectedGames } : undefined,
      };
      workspace.projections.sources.forEach((source) => {
        const imported = source.players[id];
        values[source.id] = imported ? { fppg: imported.projectedFppg, games: imported.projectedGames, stats: imported.stats } : undefined;
      });
      const selectedValues = selectedIds.flatMap((sourceId) => values[sourceId] ? [values[sourceId]!.fppg] : []);
      const spread = selectedValues.length > 1 ? Math.max(...selectedValues) - Math.min(...selectedValues) : 0;
      return { player, values, spread };
    }).filter((row) => {
      if (position !== 'ALL' && !row.player.pos.includes(position)) return false;
      const needle = query.trim().toLocaleLowerCase();
      if (needle && !`${row.player.name} ${row.player.team}`.toLocaleLowerCase().includes(needle)) return false;
      return selectedIds.some((sourceId) => row.values[sourceId]);
    }).sort((a, b) => {
      if (sortKey === 'name') return a.player.name.localeCompare(b.player.name);
      if (sortKey === 'adp') return (a.player.yahooAdp ?? 9999) - (b.player.yahooAdp ?? 9999);
      return b.spread - a.spread || (a.player.yahooAdp ?? 9999) - (b.player.yahooAdp ?? 9999);
    });
  }, [directory, position, query, selectedIds, sortKey, workspace.projections.sources, workspace.season.start]);

  const toggleSource = (sourceId: string) => {
    const next = selectedIds.includes(sourceId)
      ? selectedIds.filter((id) => id !== sourceId)
      : [...selectedIds, sourceId];
    if (!next.length) return;
    onChange({
      ...workspace,
      projections: { ...workspace.projections, consensusSourceIds: next },
      updatedAt: new Date().toISOString(),
    });
  };

  const useConsensus = () => onChange({
    ...workspace,
    projections: { ...workspace.projections, activeSourceId: CONSENSUS_PROJECTION_ID },
    updatedAt: new Date().toISOString(),
  });

  const visibleSources = availableSources.filter((source) => selectedIds.includes(source.id));

  return (
    <section className="rounded-xl border border-line bg-surface-0 p-3 sm:p-4" aria-label="Compare projection sources">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="scoreboard-text text-accent">PROJECTION COMPARISON</p>
          <h3 className="mt-1 text-base font-semibold text-ink">Where the sources disagree</h3>
          <p className="mt-1 max-w-2xl text-xs text-ink-dim">
            Compare league-scored FPPG and projected workload. Missing imported players are shown as missing here—not quietly presented as that source's projection.
          </p>
        </div>
        <Button type="button" size="sm" disabled={selectedIds.length < 2} onClick={useConsensus}>
          <Check size={14} />
          Use selected consensus
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Projection sources to compare">
        {availableSources.map((source, index) => {
          const selected = selectedIds.includes(source.id);
          return (
            <button
              key={source.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleSource(source.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selected ? 'border-accent bg-accent-muted text-accent' : 'border-line text-ink-mute hover:text-ink'}`}
            >
              <span className={selected ? SOURCE_COLORS[index % SOURCE_COLORS.length] : ''}>{source.label}</span>
              <span className="ml-1 font-normal opacity-70">{source.matchedCount}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={15} />
          <span className="sr-only">Search projection comparison</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or team" className="min-h-10 w-full rounded-lg border border-line bg-surface-1 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <select aria-label="Projection comparison position" value={position} onChange={(event) => setPosition(event.target.value)} className="min-h-10 rounded-lg border border-line bg-surface-1 px-3 text-xs font-semibold text-ink">
          {['ALL', 'C', 'LW', 'RW', 'D', 'G'].map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All positions' : value}</option>)}
        </select>
        <label className="relative">
          <ArrowDownWideNarrow className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={14} />
          <span className="sr-only">Sort projection comparison</span>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="min-h-10 appearance-none rounded-lg border border-line bg-surface-1 pl-9 pr-8 text-xs font-semibold text-ink">
            <option value="disagreement">Biggest disagreement</option>
            <option value="adp">Yahoo ADP</option>
            <option value="name">Player name</option>
          </select>
        </label>
      </div>

      <p className="mt-3 text-[10px] text-ink-mute">Showing {Math.min(rows.length, 100)} of {rows.length} matching players · FPPG spread uses only the selected sources that contain that player.</p>

      <div className="mt-3 space-y-2 lg:hidden">
        {rows.slice(0, 100).map((row) => (
          <article key={row.player.id} className="rounded-lg border border-line bg-surface-1 p-3">
            <div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-ink">{row.player.name}</strong><p className="text-[10px] text-ink-mute">{row.player.pos.join('/')} · {row.player.team} · Yahoo {row.player.yahooAdp?.toFixed(1) ?? '—'}</p></div><span className="font-mono text-xs text-warning">Δ {row.spread.toFixed(2)}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {visibleSources.map((source) => {
                const value = row.values[source.id];
                return <div key={source.id} className="rounded-md border border-line bg-surface-0 p-2"><span className="block truncate text-[9px] font-bold uppercase tracking-wide text-ink-mute">{source.label}</span>{value ? <><strong className="mt-1 block font-mono text-sm text-ink">{value.fppg.toFixed(2)} FPPG</strong><span className="text-[9px] text-ink-mute">{value.games} GP{compactStatLine(value.stats, row.player.pos.includes('G')) ? ` · ${compactStatLine(value.stats, row.player.pos.includes('G'))}` : ''}</span></> : <span className="mt-1 block text-xs text-ink-mute">Not matched</span>}</div>;
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-3 hidden overflow-x-auto rounded-lg border border-line lg:block">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-surface-2 text-[9px] uppercase tracking-wide text-ink-mute"><tr><th className="sticky left-0 bg-surface-2 px-3 py-2">Player</th>{visibleSources.map((source) => <th key={source.id} className="min-w-36 px-3 py-2">{source.label}</th>)}<th className="px-3 py-2">Spread</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, 100).map((row) => <tr key={row.player.id} className="bg-surface-1"><td className="sticky left-0 min-w-48 bg-surface-1 px-3 py-2"><strong className="block text-ink">{row.player.name}</strong><span className="text-[9px] text-ink-mute">{row.player.pos.join('/')} · {row.player.team} · Yahoo {row.player.yahooAdp?.toFixed(1) ?? '—'}</span></td>{visibleSources.map((source) => { const value = row.values[source.id]; const statLine = compactStatLine(value?.stats, row.player.pos.includes('G')); return <td key={source.id} className="px-3 py-2">{value ? <><strong className="font-mono text-ink">{value.fppg.toFixed(2)}</strong><span className="ml-1 text-[9px] text-ink-mute">FPPG · {value.games} GP</span>{statLine && <span className="mt-0.5 block text-[9px] text-ink-mute">{statLine}</span>}</> : <span className="text-ink-mute">Not matched</span>}</td>; })}<td className="px-3 py-2 font-mono text-warning">{row.spread.toFixed(2)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
