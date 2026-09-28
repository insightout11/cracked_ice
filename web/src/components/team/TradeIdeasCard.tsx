import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown, RefreshCw } from 'lucide-react';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import { planningWeek, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { draftMarketRankForPlayer } from '../../lib/draftMarket';
import { useInjuries, withInjuries } from '../../lib/injuries';
import { byBalance, replacementLevel, tradesWithTeam, type TradeIdea } from '../../lib/tradeFinder';
import { canPlaySoon, likelyOwnedPlayerIds } from '../../lib/pickupCandidateDiscovery';
import { availableGoalies } from '../../lib/rosterGaps';
import { loadProjections, stableKey, toRosterPlayer } from '../../hooks/useAcquisitionRecommendations';
import { PlayerNameLink } from './PlayerNameLink';

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const WINDOW_DAYS = 28;
const positions = (player: RosterPlayer) => player.positions.join('/');
/** Free agents looked at for replacement level: the best few at each position. */
const FREE_AGENTS_PER_POSITION = 5;
const perWeek = (points: number, days: number) => (points * 7) / Math.max(1, days);

/** The best few likely-free players at each position, to project and pick replacement level from. */
function freeAgentPool(players: PlayerSearchResult[], unavailable: Set<string>): PlayerSearchResult[] {
  const free = players.filter((player) => !unavailable.has(normalizeId(player.id)) && canPlaySoon(player) && (player.blendedFppg ?? 0) > 0);
  const skaters = ['C', 'LW', 'RW', 'D'].flatMap((position) => free
    .filter((player) => player.pos.includes(position) && !player.pos.every((item) => item === 'G'))
    .sort((a, b) => (b.blendedFppg ?? 0) - (a.blendedFppg ?? 0))
    .slice(0, FREE_AGENTS_PER_POSITION));
  const goalies = availableGoalies(free, [], FREE_AGENTS_PER_POSITION).map((entry) => entry.player);
  return [...new Map([...skaters, ...goalies].map((player) => [normalizeId(player.id), player])).values()];
}

function datesFrom(start: string, days: number, seasonEnd: string): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  }).filter((date) => date <= seasonEnd);
}

/**
 * Trade ideas with the rest of the league: one-for-one swaps that make both
 * lineups better over the next four weeks and look fair on the market (close ADP
 * ranks). Game days come from the projections, so goalies count only on their
 * expected starts. Runs on request, one team at a time, so the page stays responsive.
 */
export function TradeIdeasCard({ workspace, roster, players, leagueProfile, onOpenPlayer }: { workspace: LeagueWorkspace; roster: RosterPlayer[]; players: PlayerSearchResult[]; leagueProfile: LeagueProfile; onOpenPlayer?: (player: RosterPlayer) => void }) {
  const injuries = useInjuries();
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [checking, setChecking] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<TradeIdea[]>([]);
  const [windowDays, setWindowDays] = useState(WINDOW_DAYS);
  // The free agents a trade has to beat, shown when no trade does.
  const [freeAgents, setFreeAgents] = useState<RosterPlayer[]>([]);
  // Trades are about the rest of the season, not this week's adds: folded away until asked for.
  const [open, setOpen] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const rosters = workspace.leagueRosters;
  if (!rosters?.teams.length) return null;

  const run = async () => {
    setState('running');
    setIdeas([]);
    try {
      const week = planningWeek(workspace);
      const dates = datesFrom(week.firstPlanDate, WINDOW_DAYS, workspace.season.end);
      const byId = new Map(players.map((player) => [normalizeId(player.id), player]));
      const mine = withInjuries(roster.filter((player) => !player.current_slot?.toUpperCase().startsWith('IR')), injuries);
      // Likely-free players to measure trades against: nobody in the league has them.
      const unavailable = new Set([...rosters.teams.flatMap((entry) => entry.playerIds), ...likelyOwnedPlayerIds(workspace, players), ...roster.map((player) => player.id)].map(normalizeId));
      const pool = freeAgentPool(players, unavailable);
      // Everyone involved, projected over the window: a goalie's game dates are his expected starts.
      const ids = [...new Set([...mine.map((player) => normalizeId(player.id)), ...rosters.teams.filter((entry) => !entry.mine).flatMap((entry) => entry.playerIds.map(normalizeId)), ...pool.map((player) => normalizeId(player.id))])];
      const request = ids.map((id) => ({ playerId: `nhl:${id}`, slot: 'BN' }));
      const window = { start: dates[0], end: dates[dates.length - 1] };
      const projections = await loadProjections(stableKey({ trades: true, league: workspace.id, profile: leagueProfile, window, ids: [...ids].sort() }), leagueProfile, window, request);
      const gameDates: Record<string, string[]> = {};
      Object.entries(projections).forEach(([id, projection]) => { gameDates[normalizeId(id)] = Object.keys(projection.gamesByDate ?? {}); });
      const marketRank = (player: RosterPlayer) => draftMarketRankForPlayer(player.id, byId.get(normalizeId(player.id))?.yahooAdp, workspace.draftSession.marketSource);
      const replacement = replacementLevel(workspace, withInjuries(pool.map(toRosterPlayer), injuries), gameDates);
      const inputs = { gameDates, marketRank, replacement };
      setFreeAgents(replacement);
      setWindowDays(dates.length);
      const found: TradeIdea[] = [];
      for (const team of rosters.teams.filter((entry) => !entry.mine)) {
        if (cancelled.current) return;
        setChecking(team.name);
        // Let the page paint between teams.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const theirs = withInjuries(team.playerIds.map((id) => byId.get(normalizeId(id))).filter((player): player is PlayerSearchResult => Boolean(player)).map(toRosterPlayer), injuries);
        found.push(...tradesWithTeam(workspace, mine, { name: team.name, roster: theirs }, inputs, dates));
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
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="keep-flex flex items-center gap-2 text-left text-sm text-ink">
          <ArrowLeftRight size={15} className="text-accent" aria-hidden="true" />
          <span>Trade ideas <span className="text-ink-dim">that help both teams</span></span>
          <ChevronDown size={14} className={`text-ink-mute transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {open && state !== 'running' && (
          <button type="button" onClick={run} className="keep-flex inline-flex min-h-9 items-center gap-1.5 rounded-md border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent-muted">
            <RefreshCw size={13} aria-hidden="true" />{state === 'idle' ? 'Find trades' : 'Check again'}
          </button>
        )}
      </div>
      {open && (<>
      {state === 'running' && <p className="mt-2 text-xs text-ink-dim">Checking {checking ?? 'the league'}…</p>}
      {state === 'error' && <p className="mt-2 text-xs text-warning" role="alert">The projections didn't load. Try again in a minute.</p>}
      {state === 'done' && !ideas.length && (
        <p className="mt-2 text-xs text-ink-dim">
          No fair trade beats the waiver wire right now.
          {freeAgents.length > 0 && <> Likely free instead: {freeAgents.map((player, index) => <span key={player.id}>{index > 0 && ', '}<span className="text-ink"><PlayerNameLink player={player} onOpen={onOpenPlayer} /></span> ({positions(player)})</span>)}.</>}
        </p>
      )}
      {state === 'done' && ideas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {ideas.map((idea) => (
            <li key={`${idea.team}-${[...idea.give, ...idea.get].map((player) => player.id).join('-')}`} className="rounded-md border border-line bg-surface-0 px-3 py-2 text-sm">
              <p className="text-xs font-semibold text-ink-mute">{idea.team}</p>
              <p className="mt-0.5 text-ink">
                Send {idea.give.map((player, index) => <span key={player.id}>{index > 0 && ' + '}<PlayerNameLink player={player} onOpen={onOpenPlayer} /> <span className="text-ink-dim">({positions(player)})</span></span>)}
                {' '}for {idea.get.map((player, index) => <span key={player.id}>{index > 0 && ' + '}<PlayerNameLink player={player} onOpen={onOpenPlayer} /> <span className="text-ink-dim">({positions(player)})</span></span>)}
              </p>
              <p className="mt-0.5 text-xs text-ink-dim">
                You <strong className="text-positive">+{perWeek(idea.myGain, windowDays).toFixed(1)}</strong> a week, them +{perWeek(idea.theirGain, windowDays).toFixed(1)}, beyond free-agent pickups.
                {' '}ADP {idea.giveRanks.map(Math.round).join(' + ')} for {idea.getRanks.map(Math.round).join(' + ')} ({Math.round(idea.valueMatch * 100)}% value match).
              </p>
              <p className="mt-0.5 text-xs text-ink">{idea.pitch}</p>
            </li>
          ))}
        </ul>
      )}
      {state === 'idle' && <p className="mt-2 text-xs text-ink-dim">Fair trades (1-for-1 and 2-for-1, matched on draft value) that help both lineups more than picking up a free agent would, over the next four weeks of games.</p>}
      </>)}
    </div>
  );
}
