import { useEffect, useMemo, useState } from 'react';
import { Swords } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import { planningWeek, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { useInjuries, withInjuries } from '../../lib/injuries';
import { matchupPreview } from '../../lib/matchupPreview';
import { loadProjections, stableKey, toRosterPlayer } from '../../hooks/useAcquisitionRecommendations';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/**
 * This week's matchup: the manager picks the opponent from the league rosters
 * (saved from the draft paste), and both lineups are counted day by day from the
 * projections, where a goalie plays only on his expected starts. Shows where you're behind and how many empty spots streams can fill.
 */
export function MatchupCard({ workspace, roster, players, leagueProfile, onShareWeek }: { workspace: LeagueWorkspace; roster: RosterPlayer[]; players: PlayerSearchResult[]; leagueProfile: LeagueProfile; onShareWeek?: () => void }) {
  const { updateLeague } = useLeagueWorkspace();
  const injuries = useInjuries();
  const week = planningWeek(workspace);
  const rosters = workspace.leagueRosters;
  const opponentName = rosters?.opponent?.weekStart === week.start ? rosters.opponent.name : null;
  const opponent = rosters?.teams.find((team) => team.name === opponentName && !team.mine) ?? null;
  const [choosing, setChoosing] = useState(false);

  const opponentRoster = useMemo(() => {
    if (!opponent) return [];
    const byId = new Map(players.map((player) => [normalizeId(player.id), player]));
    return opponent.playerIds.map((id) => byId.get(normalizeId(id))).filter((player): player is PlayerSearchResult => Boolean(player)).map(toRosterPlayer);
  }, [opponent, players]);

  // Both rosters projected for the week: a goalie's game dates are his expected starts.
  const ids = useMemo(() => [...new Set([...roster, ...opponentRoster].map((player) => normalizeId(player.id)))].sort(), [roster, opponentRoster]);
  const key = stableKey({ matchup: true, league: workspace.id, profile: leagueProfile, start: week.start, end: week.end, ids });
  const [gameDates, setGameDates] = useState<{ key: string; value: Record<string, string[]> } | null>(null);
  useEffect(() => {
    if (!opponent || !ids.length) return undefined;
    let cancelled = false;
    loadProjections(key, leagueProfile, { start: week.start, end: week.end }, ids.map((id) => ({ playerId: `nhl:${id}`, slot: 'BN' })))
      .then((projections) => {
        if (cancelled) return;
        setGameDates({ key, value: Object.fromEntries(Object.entries(projections).map(([id, projection]) => [normalizeId(id), Object.keys(projection.gamesByDate ?? {})])) });
      })
      .catch(() => { /* No projections, no matchup counts. */ });
    return () => { cancelled = true; };
  }, [ids, key, leagueProfile, opponent, week.end, week.start]);

  const current = gameDates?.key === key ? gameDates.value : null;
  const preview = useMemo(() => {
    if (!opponent || !current) return null;
    return matchupPreview(workspace, withInjuries(roster, injuries), withInjuries(opponentRoster, injuries), current, { start: week.start, end: week.end, today: week.today });
  }, [current, injuries, opponent, opponentRoster, roster, week.end, week.start, week.today, workspace]);

  if (!rosters?.teams.length) return null;

  const pick = (name: string) => {
    updateLeague({ ...workspace, leagueRosters: { ...rosters, opponent: { name, weekStart: week.start } }, updatedAt: new Date().toISOString() });
    setChoosing(false);
  };

  const others = rosters.teams.filter((team) => !team.mine);
  const mine = preview?.remaining.mine;
  const theirs = preview?.remaining.theirs;
  const gap = mine && theirs ? mine.skaterStarts - theirs.skaterStarts : 0;

  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-ink">
          <Swords size={15} className="text-accent" aria-hidden="true" />
          {opponent ? <span>vs <strong>{opponent.name}</strong></span> : <span>Who are you playing this week?</span>}
        </p>
        {opponent && !choosing && (
          <span className="flex items-center gap-3 text-xs font-semibold">
            {onShareWeek && <button type="button" onClick={onShareWeek} className="inline-link text-accent hover:underline">Share week</button>}
            <Link to={`/card?team=${encodeURIComponent(opponent.name)}`} className="text-accent hover:underline">Roast them</Link>
            <button type="button" onClick={() => setChoosing(true)} className="inline-link text-accent hover:underline">Change</button>
          </span>
        )}
      </div>

      {(!opponent || choosing) && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="This week's opponent">
          {others.map((team) => (
            <button key={team.name} type="button" aria-pressed={team.name === opponentName} onClick={() => pick(team.name)} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${team.name === opponentName ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink hover:border-accent'}`}>{team.name}</button>
          ))}
        </div>
      )}

      {opponent && !choosing && preview && mine && theirs && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink">
            {gap === 0 ? 'Even on skater starts left this week' : gap > 0 ? `You're ahead by ${gap} skater start${gap === 1 ? '' : 's'} left this week` : `You're behind by ${-gap} skater start${gap === -1 ? '' : 's'} left this week`}
            <span className="text-ink-dim"> ({mine.skaterStarts} to {theirs.skaterStarts}; goalie games {mine.goalieGames} to {theirs.goalieGames}).</span>
          </p>
          <div className="grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${preview.days.length}, minmax(0, 1fr))` }} role="table" aria-label="Skater starts by day, you and them">
            {preview.days.map((day) => {
              const behind = day.mine.skaterStarts < day.theirs.skaterStarts;
              return (
                <div key={day.date} role="row" className={`rounded-md border px-0.5 py-1.5 ${day.past ? 'border-line opacity-45' : behind ? 'border-warning/60 bg-warning/10' : 'border-line bg-surface-0'}`}>
                  <p role="rowheader" className="text-[10px] font-semibold uppercase text-ink-mute">{weekday(day.date)}</p>
                  <p role="cell" className="mt-0.5 text-base font-bold tabular-nums text-ink" aria-label={`You ${day.mine.skaterStarts}`}>{day.mine.skaterStarts}</p>
                  <p role="cell" className="text-xs tabular-nums text-ink-dim" aria-label={`Them ${day.theirs.skaterStarts}`}>{day.theirs.skaterStarts}</p>
                  {!day.past && day.mine.openSkaterSpots > 0 && <p className="mt-0.5 text-[10px] text-accent">{day.mine.openSkaterSpots} open</p>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-dim">
            Big number is you, small is them.{mine.openSkaterSpots > 0 ? ` You have ${mine.openSkaterSpots} empty skater spot${mine.openSkaterSpots === 1 ? '' : 's'} left; the adds below are picked to fill them.` : ' Your lineup is full every day left.'}
          </p>
        </div>
      )}
      {opponent && !choosing && !preview && <p className="mt-2 text-xs text-ink-mute">Loading this week's games…</p>}
    </div>
  );
}
