import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarRange, Moon, Repeat2 } from 'lucide-react';
import type { BackToBackResult, OffNightResult } from '../../types';
import { apiService } from '../../services/api';
import { useTimeWindow } from '../../contexts/TimeWindowContext';
import { getTeamLogoUrl } from '../../utils/teamLogos';
import { TimeWindow } from '../TimeWindow/TimeWindow';
import { Button } from '../ui/button';

type AnalysisMode = 'off-nights' | 'back-to-backs';
type SortKey = 'metric' | 'games' | 'delta';

interface AnalysisRow {
  teamCode: string;
  teamName: string;
  metric: number;
  games: number;
  delta: number;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export function SeasonAnalysisPanel() {
  const timeWindow = useTimeWindow();
  const [mode, setMode] = useState<AnalysisMode>('off-nights');
  const [offNights, setOffNights] = useState<OffNightResult[]>([]);
  const [backToBacks, setBackToBacks] = useState<BackToBackResult[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'metric', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const start = dateOnly(timeWindow.state.config.startUtc);
  const end = dateOnly(timeWindow.state.config.endUtc);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([apiService.getOffNights(start, end), apiService.getBackTobacks(start, end)])
      .then(([offNightRows, backToBackRows]) => {
        if (cancelled) return;
        setOffNights(offNightRows);
        setBackToBacks(backToBackRows);
      })
      .catch(() => { if (!cancelled) setError('Season analysis could not be loaded for this window.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [end, start]);

  const rows = useMemo<AnalysisRow[]>(() => {
    const raw = mode === 'off-nights'
      ? offNights.map((team) => ({ teamCode: team.teamCode, teamName: team.teamName, metric: team.totalOffNights, games: team.totalGames }))
      : backToBacks.map((team) => ({ teamCode: team.teamCode, teamName: team.teamName, metric: team.totalBackToBack, games: team.totalGames }));
    const average = raw.length ? raw.reduce((total, team) => total + team.metric, 0) / raw.length : 0;
    return raw.map((team) => ({ ...team, delta: team.metric - average }));
  }, [backToBacks, mode, offNights]);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const difference = sort.direction === 'desc' ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key];
    return difference || a.teamCode.localeCompare(b.teamCode);
  }), [rows, sort]);
  const podium = useMemo(() => [...rows].sort((a, b) => b.metric - a.metric || b.games - a.games || a.teamCode.localeCompare(b.teamCode)).slice(0, 3), [rows]);

  const changeSort = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  const SortIcon = sort.direction === 'desc' ? ArrowDown : ArrowUp;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line-strong bg-surface-glass p-4 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="scoreboard-text text-accent">SEASON SCHEDULE</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">Where the schedule creates leverage</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-dim">Compare low-volume nights and consecutive-game sets across the same saved analysis window used elsewhere on Cracked Ice.</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-line bg-surface-0 p-1" aria-label="Season analysis metric">
            <Button size="sm" variant={mode === 'off-nights' ? 'primary' : 'ghost'} aria-pressed={mode === 'off-nights'} onClick={() => setMode('off-nights')}><Moon size={14} aria-hidden="true" />Off-nights</Button>
            <Button size="sm" variant={mode === 'back-to-backs' ? 'primary' : 'ghost'} aria-pressed={mode === 'back-to-backs'} onClick={() => setMode('back-to-backs')}><Repeat2 size={14} aria-hidden="true" />Back-to-backs</Button>
          </div>
        </div>
        <div className="mt-4 border-t border-line pt-4"><TimeWindow value={timeWindow.state} onPresetChange={timeWindow.setPreset} onCustomRangeChange={timeWindow.setCustomRange} onModeChange={timeWindow.setMode} onPlayoffPresetChange={timeWindow.setPlayoffPreset} onLeagueWeeksChange={timeWindow.setLeagueWeeks} /></div>
      </section>

      {loading ? <p className="rounded-xl border border-line bg-surface-1 p-8 text-center text-ink-dim">Loading season schedule analysis…</p> : error ? <p className="rounded-xl border border-negative bg-negative-muted p-4 text-negative">{error}</p> : (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label={`Top ${mode}`}>
            {podium.map((team, index) => (
              <article key={team.teamCode} className={`rounded-xl border p-4 ${index === 0 ? 'border-accent bg-accent-muted shadow-accent' : 'border-line bg-surface-1'}`}>
                <div className="flex items-center gap-3"><span className="scoreboard-number text-sm text-ink-mute">#{index + 1}</span><img src={getTeamLogoUrl(team.teamCode)} alt="" className="size-9 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} /><span><strong className="block text-ink">{team.teamCode}</strong><span className="text-xs text-ink-mute">{team.teamName}</span></span><strong className={`scoreboard-number ml-auto text-3xl ${index === 0 ? 'text-accent' : 'text-ink'}`}>{team.metric}</strong></div>
                <p className="mt-3 text-xs text-ink-dim">{team.delta >= 0 ? '+' : ''}{team.delta.toFixed(1)} vs league average · {team.games} games</p>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-xl border border-line-strong bg-surface-1">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3"><div><h2 className="font-semibold text-ink">All 32 teams</h2><p className="text-xs text-ink-mute">{mode === 'off-nights' ? 'Off-nights have eight or fewer NHL games league-wide.' : 'Back-to-backs are games on consecutive calendar days.'}</p></div><span className="inline-flex items-center gap-1 text-xs text-ink-mute"><CalendarRange size={13} className="text-accent" aria-hidden="true" />{start} to {end}</span></div>
            <div className="max-h-[700px] overflow-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">All NHL teams ranked by {mode}</caption>
                <thead className="sticky top-0 z-10 bg-surface-0 text-xs uppercase tracking-wide text-ink-mute"><tr><th className="px-4 py-3">Team</th>{([['metric', mode === 'off-nights' ? 'Off-nights' : 'Back-to-backs'], ['delta', 'Vs average'], ['games', 'Games']] as const).map(([key, label]) => <th key={key} className="px-4 py-3"><button type="button" onClick={() => changeSort(key)} className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{label}{sort.key === key && <SortIcon size={12} aria-hidden="true" />}</button></th>)}</tr></thead>
                <tbody className="divide-y divide-line">{sortedRows.map((team, index) => <tr key={team.teamCode} className={index % 2 ? 'bg-surface-2/40' : 'bg-surface-1'}><td className="px-4 py-2"><div className="flex items-center gap-2"><img src={getTeamLogoUrl(team.teamCode)} alt="" className="size-7 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} /><span><strong className="text-ink">{team.teamCode}</strong><span className="ml-2 hidden text-xs text-ink-mute sm:inline">{team.teamName}</span></span></div></td><td className="scoreboard-number px-4 py-2 text-base text-ink">{team.metric}</td><td className={`scoreboard-number px-4 py-2 ${team.delta > 0 ? 'text-positive' : team.delta < 0 ? 'text-negative' : 'text-ink-mute'}`}>{team.delta >= 0 ? '+' : ''}{team.delta.toFixed(1)}</td><td className="scoreboard-number px-4 py-2 text-ink-dim">{team.games}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
