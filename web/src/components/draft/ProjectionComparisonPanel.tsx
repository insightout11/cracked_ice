import { useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Check, Search } from 'lucide-react';
import { buildNextSeasonProjectionMap } from '../../lib/draftProjection';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import type { DraftPlayer } from '../../lib/playerSearch';
import { CONSENSUS_PROJECTION_ID, CRACKED_ICE_PROJECTION_ID } from '../../lib/projectionImport';
import { Button } from '../ui/button';

type SortKey = 'disagreement' | 'name' | 'adp';
type ComparisonScope = 'draft-pool' | 'all';

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

interface MetricOption {
  id: string;
  label: string;
  shortLabel: string;
  statKeys?: string[];
  precision?: number;
}

const METRIC_OPTIONS: MetricOption[] = [
  { id: 'fppg', label: 'Projected FPPG', shortLabel: 'FPPG', precision: 2 },
  { id: 'games', label: 'Projected workload (GP/GS)', shortLabel: 'GP/GS', precision: 0 },
  { id: 'goals', label: 'Goals', shortLabel: 'G', statKeys: ['goals'] },
  { id: 'assists', label: 'Assists', shortLabel: 'A', statKeys: ['assists'] },
  { id: 'power_play_points', label: 'Power-play points', shortLabel: 'PPP', statKeys: ['power_play_points', 'powerplay_points'] },
  { id: 'shots_on_goal', label: 'Shots on goal', shortLabel: 'SOG', statKeys: ['shots_on_goal'] },
  { id: 'hits', label: 'Hits', shortLabel: 'HIT', statKeys: ['hits'] },
  { id: 'blocks', label: 'Blocks', shortLabel: 'BLK', statKeys: ['blocks'] },
  { id: 'penalty_minutes', label: 'Penalty minutes', shortLabel: 'PIM', statKeys: ['penalty_minutes'] },
  { id: 'plus_minus', label: 'Plus/minus', shortLabel: '+/-', statKeys: ['plus_minus'] },
  { id: 'faceoffs_won', label: 'Faceoffs won', shortLabel: 'FOW', statKeys: ['faceoffs_won'] },
  { id: 'wins', label: 'Goalie wins', shortLabel: 'W', statKeys: ['wins'] },
  { id: 'saves', label: 'Saves', shortLabel: 'SV', statKeys: ['saves'] },
  { id: 'goals_against', label: 'Goals against', shortLabel: 'GA', statKeys: ['goals_against'] },
  { id: 'save_percentage', label: 'Save percentage', shortLabel: 'SV%', statKeys: ['save_percentage'], precision: 3 },
  { id: 'goals_against_average', label: 'Goals-against average', shortLabel: 'GAA', statKeys: ['goals_against_average'], precision: 2 },
  { id: 'shutouts', label: 'Shutouts', shortLabel: 'SO', statKeys: ['shutouts'] },
];

const SOURCE_COLORS = ['text-accent', 'text-positive', 'text-warning', 'text-[#d19cff]', 'text-[#ff91ad]', 'text-[#8fd3ff]'];

function normalizeId(id: string) {
  return id.replace(/^nhl:/, '');
}

function metricValue(value: ComparisonValue | undefined, metric: MetricOption): number | undefined {
  if (!value) return undefined;
  if (metric.id === 'fppg') return value.fppg;
  if (metric.id === 'games') return value.games;
  for (const key of metric.statKeys ?? []) {
    if (value.stats?.[key] !== undefined) return value.stats[key];
  }
  return undefined;
}

function formatMetric(value: number, metric: MetricOption): string {
  return value.toFixed(metric.precision ?? 1);
}

function workloadLabel(value: ComparisonValue, goalie: boolean): string {
  return `${value.games} ${goalie && value.stats?.games_started !== undefined ? 'GS' : 'GP'}`;
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
  const [scope, setScope] = useState<ComparisonScope>('draft-pool');
  const [metricId, setMetricId] = useState('fppg');
  const selectedIds = workspace.projections.consensusSourceIds;
  const availableSources = [
    { id: CRACKED_ICE_PROJECTION_ID, label: 'Cracked Ice', matchedCount: directory.length },
    ...workspace.projections.sources.map((source) => ({ id: source.id, label: source.label, matchedCount: source.matchedCount })),
  ];
  const metric = METRIC_OPTIONS.find((option) => option.id === metricId) ?? METRIC_OPTIONS[0];
  const availableMetrics = useMemo(() => METRIC_OPTIONS.filter((option) => {
    if (!option.statKeys) return true;
    const sourceCoverage = selectedIds.filter((sourceId) => {
      if (sourceId === CRACKED_ICE_PROJECTION_ID) {
        return directory.some((player) => player.scoringBreakdown?.contributions.some((contribution) => option.statKeys!.includes(contribution.key)));
      }
      const source = workspace.projections.sources.find((candidate) => candidate.id === sourceId);
      return source ? Object.values(source.players).some((player) => option.statKeys!.some((key) => player.stats[key] !== undefined)) : false;
    }).length;
    return sourceCoverage >= 2;
  }), [directory, selectedIds, workspace.projections.sources]);

  useEffect(() => {
    if (!availableMetrics.some((option) => option.id === metricId)) setMetricId('fppg');
  }, [availableMetrics, metricId]);

  const rows = useMemo(() => {
    const crackedIce = buildNextSeasonProjectionMap(directory, workspace.season.start);
    return directory.map((player): ComparisonRow => {
      const id = normalizeId(player.id);
      const ci = crackedIce.get(id);
      const values: ComparisonRow['values'] = {
        [CRACKED_ICE_PROJECTION_ID]: ci ? { fppg: ci.projectedFppg, games: ci.projectedGames, stats: ci.projectedStats } : undefined,
      };
      workspace.projections.sources.forEach((source) => {
        const imported = source.players[id];
        values[source.id] = imported ? { fppg: imported.projectedFppg, games: imported.projectedGames, stats: imported.stats } : undefined;
      });
      const selectedValues = selectedIds.flatMap((sourceId) => {
        const selected = metricValue(values[sourceId], metric);
        return selected === undefined ? [] : [selected];
      });
      const spread = selectedValues.length > 1 ? Math.max(...selectedValues) - Math.min(...selectedValues) : 0;
      return { player, values, spread };
    }).filter((row) => {
      if (scope === 'draft-pool' && (row.player.yahooAdp == null || row.player.yahooAdp > 300)) return false;
      if (position !== 'ALL' && !row.player.pos.includes(position)) return false;
      const needle = query.trim().toLocaleLowerCase();
      if (needle && !`${row.player.name} ${row.player.team}`.toLocaleLowerCase().includes(needle)) return false;
      return selectedIds.some((sourceId) => row.values[sourceId]);
    }).sort((a, b) => {
      if (sortKey === 'name') return a.player.name.localeCompare(b.player.name);
      if (sortKey === 'adp') return (a.player.yahooAdp ?? 9999) - (b.player.yahooAdp ?? 9999);
      return b.spread - a.spread || (a.player.yahooAdp ?? 9999) - (b.player.yahooAdp ?? 9999);
    });
  }, [directory, metric, position, query, scope, selectedIds, sortKey, workspace.projections.sources, workspace.season.start]);

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
            Compare FPPG, workload, or individual projected categories. Cracked Ice category totals preserve last season's stat mix, adjusted to its projected rate and games; imported sources use their supplied stat lines.
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

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={15} />
          <span className="sr-only">Search projection comparison</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or team" className="min-h-10 w-full rounded-lg border border-line bg-surface-1 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <select aria-label="Projection comparison metric" value={metricId} onChange={(event) => setMetricId(event.target.value)} className="min-h-10 rounded-lg border border-line bg-surface-1 px-3 text-xs font-semibold text-ink">
          {availableMetrics.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <select aria-label="Projection comparison player scope" value={scope} onChange={(event) => setScope(event.target.value as ComparisonScope)} className="min-h-10 rounded-lg border border-line bg-surface-1 px-3 text-xs font-semibold text-ink">
          <option value="draft-pool">Draft pool · Yahoo top 300</option>
          <option value="all">All matched players</option>
        </select>
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

      <p className="mt-3 text-[10px] text-ink-mute">Showing {Math.min(rows.length, 100)} of {rows.length} {scope === 'draft-pool' ? 'draft-relevant' : 'matching'} players · {metric.shortLabel} spread uses only selected sources with that projection.</p>

      <div className="mt-3 space-y-2 lg:hidden">
        {rows.slice(0, 100).map((row) => (
          <article key={row.player.id} className="rounded-lg border border-line bg-surface-1 p-3">
            <div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-ink">{row.player.name}</strong><p className="text-[10px] text-ink-mute">{row.player.pos.join('/')} · {row.player.team} · Yahoo {row.player.yahooAdp?.toFixed(1) ?? '—'}</p></div><span className="font-mono text-xs text-warning">Δ {formatMetric(row.spread, metric)} {metric.shortLabel}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {visibleSources.map((source) => {
                const value = row.values[source.id];
                const selectedValue = metricValue(value, metric);
                return <div key={source.id} className="rounded-md border border-line bg-surface-0 p-2"><span className="block truncate text-[9px] font-bold uppercase tracking-wide text-ink-mute">{source.label}</span>{value ? <>{selectedValue !== undefined ? <strong className="mt-1 block font-mono text-sm text-ink">{formatMetric(selectedValue, metric)} {metric.shortLabel}</strong> : <strong className="mt-1 block text-xs text-ink-mute">No {metric.shortLabel} projection</strong>}<span className="text-[9px] text-ink-mute">{value.fppg.toFixed(2)} FPPG · {workloadLabel(value, row.player.pos.includes('G'))}{metric.id === 'fppg' && compactStatLine(value.stats, row.player.pos.includes('G')) ? ` · ${compactStatLine(value.stats, row.player.pos.includes('G'))}` : ''}</span></> : <span className="mt-1 block text-xs text-ink-mute">Not matched</span>}</div>;
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-3 hidden overflow-x-auto rounded-lg border border-line lg:block">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-surface-2 text-[9px] uppercase tracking-wide text-ink-mute"><tr><th className="sticky left-0 bg-surface-2 px-3 py-2">Player</th>{visibleSources.map((source) => <th key={source.id} className="min-w-36 px-3 py-2">{source.label}</th>)}<th className="px-3 py-2">{metric.shortLabel} spread</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, 100).map((row) => <tr key={row.player.id} className="bg-surface-1"><td className="sticky left-0 min-w-48 bg-surface-1 px-3 py-2"><strong className="block text-ink">{row.player.name}</strong><span className="text-[9px] text-ink-mute">{row.player.pos.join('/')} · {row.player.team} · Yahoo {row.player.yahooAdp?.toFixed(1) ?? '—'}</span></td>{visibleSources.map((source) => { const value = row.values[source.id]; const selectedValue = metricValue(value, metric); return <td key={source.id} className="px-3 py-2">{value ? <>{selectedValue !== undefined ? <><strong className="font-mono text-ink">{formatMetric(selectedValue, metric)}</strong><span className="ml-1 text-[9px] text-ink-mute">{metric.shortLabel}</span></> : <span className="text-ink-mute">No projection</span>}<span className="mt-0.5 block text-[9px] text-ink-mute">{value.fppg.toFixed(2)} FPPG · {workloadLabel(value, row.player.pos.includes('G'))}</span></> : <span className="text-ink-mute">Not matched</span>}</td>; })}<td className="px-3 py-2 font-mono text-warning">{formatMetric(row.spread, metric)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
