import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, RefreshCw } from 'lucide-react';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import { planningWeek, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { loadSeasonSchedule } from '../../lib/schedulePlanning';
import { useInjuries, withInjuries } from '../../lib/injuries';
import { byBalance, tradesWithTeam, type TradeIdea } from '../../lib/tradeFinder';
import { toRosterPlayer } from '../../hooks/useAcquisitionRecommendations';
import { PlayerNameLink } from './PlayerNameLink';

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const WINDOW_DAYS = 28;
const positions = (player: RosterPlayer) => player.positions.join('/');

function datesFrom(start: string, days: number, seasonEnd: string): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  }).filter((date) => date <= seasonEnd);
}

/**
 * Trade ideas with the rest of the league: one-for-one swaps that make both
 * lineups better over the next four weeks of games. Runs on request, one team
 * at a time, so the page stays responsive.
 */
export function TradeIdeasCard({ workspace, roster, players, onOpenPlayer }: { workspace: LeagueWorkspace; roster: RosterPlayer[]; players: PlayerSearchResult[]; onOpenPlayer?: (player: RosterPlayer) => void }) {
  const injuries = useInjuries();
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [checking, setChecking] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<TradeIdea[]>([]);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const rosters = workspace.leagueRosters;
  if (!rosters?.teams.length) return null;

  const run = async () => {
    setState('running');
    setIdeas([]);
    try {
      const schedule = await loadSeasonSchedule();
      const teamGames = Object.fromEntries(Object.entries(schedule.games).map(([team, games]) => [team, games.map((game) => game.date)]));
      const week = planningWeek(workspace);
      const dates = datesFrom(week.firstPlanDate, WINDOW_DAYS, workspace.season.end);
      const byId = new Map(players.map((player) => [normalizeId(player.id), player]));
      const mine = withInjuries(roster.filter((player) => !player.current_slot?.toUpperCase().startsWith('IR')), injuries);
      const found: TradeIdea[] = [];
      for (const team of rosters.teams.filter((entry) => !entry.mine)) {
        if (cancelled.current) return;
        setChecking(team.name);
        // Let the page paint between teams.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const theirs = withInjuries(team.playerIds.map((id) => byId.get(normalizeId(id))).filter((player): player is PlayerSearchResult => Boolean(player)).map(toRosterPlayer), injuries);
        found.push(...tradesWithTeam(workspace, mine, { name: team.name, roster: theirs }, teamGames, dates));
      }
      setIdeas(found.sort(byBalance).slice(0, 6));
      setState('done');
    } catch {
      setState('error');
    } finally {
      setChecking(null);
    }
  };

  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-ink">
          <ArrowLeftRight size={15} className="text-accent" aria-hidden="true" />
          <span>Trade ideas <span className="text-ink-dim">that help both teams</span></span>
        </p>
        {state !== 'running' && (
          <button type="button" onClick={run} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent-muted">
            <RefreshCw size={13} aria-hidden="true" />{state === 'idle' ? 'Find trades' : 'Check again'}
          </button>
        )}
      </div>
      {state === 'running' && <p className="mt-2 text-xs text-ink-dim">Checking {checking ?? 'the league'}…</p>}
      {state === 'error' && <p className="mt-2 text-xs text-warning" role="alert">The schedule didn't load. Try again in a minute.</p>}
      {state === 'done' && !ideas.length && <p className="mt-2 text-xs text-ink-dim">No one-for-one trade makes both teams better right now. Check again after rosters change.</p>}
      {state === 'done' && ideas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {ideas.map((idea) => (
            <li key={`${idea.team}-${idea.give.id}-${idea.get.id}`} className="rounded-md border border-line bg-surface-0 px-3 py-2 text-sm">
              <p className="text-xs font-semibold text-ink-mute">{idea.team}</p>
              <p className="mt-0.5 text-ink">
                Send <PlayerNameLink player={idea.give} onOpen={onOpenPlayer} /> <span className="text-ink-dim">({positions(idea.give)})</span> for <PlayerNameLink player={idea.get} onOpen={onOpenPlayer} /> <span className="text-ink-dim">({positions(idea.get)})</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-dim">Next 4 weeks: you +{idea.myGain.toFixed(1)} pts, them +{idea.theirGain.toFixed(1)} pts from better-filled lineups.</p>
            </li>
          ))}
        </ul>
      )}
      {state === 'idle' && <p className="mt-2 text-xs text-ink-dim">Swaps where your spare player fills their gap and theirs fills yours, scored over the next four weeks of games.</p>}
    </div>
  );
}
