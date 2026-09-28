import { useEffect, useMemo, useState } from 'react';
import { Swords } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import { planningWeek, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { loadSeasonSchedule } from '../../lib/schedulePlanning';
import { useInjuries, withInjuries } from '../../lib/injuries';
import { matchupPreview } from '../../lib/matchupPreview';
import { toRosterPlayer } from '../../hooks/useAcquisitionRecommendations';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/**
 * This week's matchup: the manager picks the opponent from the league rosters
 * (saved from the draft paste), and both lineups are counted day by day from the
 * NHL schedule. Shows where you're behind and how many empty spots streams can fill.
 */
export function MatchupCard({ workspace, roster, players }: { workspace: LeagueWorkspace; roster: RosterPlayer[]; players: PlayerSearchResult[] }) {
  const { updateLeague } = useLeagueWorkspace();
  const injuries = useInjuries();
  const week = planningWeek(workspace);
  const rosters = workspace.leagueRosters;
  const opponentName = rosters?.opponent?.weekStart === week.start ? rosters.opponent.name : null;
  const opponent = rosters?.teams.find((team) => team.name === opponentName && !team.mine) ?? null;
  const [choosing, setChoosing] = useState(false);

  const [teamGames, setTeamGames] = useState<Record<string, string[]> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSeasonSchedule()
      .then((schedule) => { if (!cancelled) setTeamGames(Object.fromEntries(Object.entries(schedule.games).map(([team, games]) => [team, games.map((game) => game.date)]))); })
      .catch(() => { /* No schedule, no matchup counts. */ });
    return () => { cancelled = true; };
  }, []);

  const preview = useMemo(() => {
    if (!opponent || !teamGames) return null;
    const byId = new Map(players.map((player) => [normalizeId(player.id), player]));
    const theirs = opponent.playerIds.map((id) => byId.get(normalizeId(id))).filter((player): player is PlayerSearchResult => Boolean(player)).map(toRosterPlayer);
    return matchupPreview(workspace, withInjuries(roster, injuries), withInjuries(theirs, injuries), teamGames, { start: week.start, end: week.end, today: week.today });
  }, [injuries, opponent, players, roster, teamGames, week.end, week.start, week.today, workspace]);

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
          {opponent ? <span>This week vs <strong>{opponent.name}</strong></span> : <span>Who are you playing this week?</span>}
        </p>
        {opponent && !choosing && (
          <span className="flex items-center gap-3">
            <Link to={`/card?team=${encodeURIComponent(opponent.name)}`} className="text-xs font-semibold text-accent hover:underline">Roast them</Link>
            <button type="button" onClick={() => setChoosing(true)} className="inline-link text-xs font-semibold text-accent hover:underline">Change</button>
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
          <div className="grid grid-cols-7 gap-1 text-center" role="table" aria-label="Skater starts by day, you and them">
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
      {opponent && !choosing && !preview && <p className="mt-2 text-xs text-ink-mute">Loading the schedule…</p>}
    </div>
  );
}
