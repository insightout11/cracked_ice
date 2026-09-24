import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, ListPlus, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import type { DraftPlayer, DraftPlayerDirectoryMeta } from '../../lib/playerSearch';
import type { TeamWeek } from '../../lib/schedule';
import type { TeamStreamingValue } from '../../lib/scheduleOpportunity';
import { isLeagueCandidateCurrent, setCandidateAvailability } from '../../lib/leagueWorkspace';
import type { PlanningWindow } from '../../lib/schedulePlanning';
import type { PlannerCandidate, PlannerHorizon } from '../../lib/weekPlanner';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { useWeekPlanner } from '../../hooks/useWeekPlanner';
import { apiService } from '../../services/api';
import { Button } from '../ui/button';
import { Drawer, DrawerClose, DrawerContent, ModalDescription, ModalTitle } from '../ui/dialog';

interface ScheduleTeamDrawerProps {
  open: boolean;
  team: TeamWeek | null;
  opportunity?: TeamStreamingValue;
  leagueProfile: LeagueProfile;
  planningWindow: PlanningWindow;
  onOpenChange: (open: boolean) => void;
}

const normalizePlayerId = (playerId: string) => playerId.replace(/^nhl:/, '');

function horizonFor(window: PlanningWindow): PlannerHorizon {
  if (window.intent === 'week') return 'week';
  if (window.intent === '14d') return '14d';
  return '30d';
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function asRosterPlayer(player: DraftPlayer): RosterPlayer {
  return {
    id: player.id,
    full_name: player.name,
    team: player.team,
    positions: player.pos,
    current_slot: 'BN',
    games_played: player.nhlGamesPlayed ?? 0,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
    blendedFppg: player.blendedFppg,
  };
}

/**
 * One NHL team's players, valued with the same planner as My Team: what adding each
 * one is worth over the planning window, whether that needs a drop or an IR move, and
 * quick Available / Taken / Add-to-plan actions.
 */
export function ScheduleTeamDrawer({ open, team, opportunity, leagueProfile, planningWindow, onOpenChange }: ScheduleTeamDrawerProps) {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [meta, setMeta] = useState<DraftPlayerDirectoryMeta | null>(null);
  const [loadedProfileKey, setLoadedProfileKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileKey = useMemo(() => JSON.stringify({
    scoringType: leagueProfile.scoring_type,
    skater: leagueProfile.skater_scoring,
    goalie: leagueProfile.goalie_scoring,
  }), [leagueProfile.goalie_scoring, leagueProfile.scoring_type, leagueProfile.skater_scoring]);

  useEffect(() => {
    if (!open || loadedProfileKey === profileKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiService.getDraftPlayers(leagueProfile)
      .then((response) => {
        if (cancelled) return;
        setPlayers(response.players);
        setMeta(response.meta);
        setLoadedProfileKey(profileKey);
      })
      .catch(() => { if (!cancelled) setError('The player directory could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leagueProfile, loadedProfileKey, open, profileKey]);

  const rosterIds = useMemo(() => new Set(activeLeague.roster.map((player) => normalizePlayerId(player.playerId))), [activeLeague.roster]);
  const candidates = useMemo(() => new Map(activeLeague.candidates.map((candidate) => [normalizePlayerId(candidate.playerId), candidate])), [activeLeague.candidates]);
  const teamPlayers = useMemo(() => team ? players.filter((player) => player.team === team.team) : [], [players, team]);
  const games = useMemo(() => team ? Object.entries(team.gamesByDay).flatMap(([day, dayGames]) => dayGames.map((game) => ({ ...game, day }))) : [], [team]);
  const roster = useMemo<RosterPlayer[]>(() => activeLeague.roster.map((entry) => ({
    id: entry.playerId,
    full_name: entry.fullName,
    team: entry.team,
    positions: entry.positions,
    current_slot: entry.slot,
    games_played: 0,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
  })), [activeLeague.roster]);

  const statusOf = (playerId: string): 'rostered' | 'taken' | 'available' | 'unknown' => {
    const id = normalizePlayerId(playerId);
    if (rosterIds.has(id)) return 'rostered';
    const candidate = candidates.get(id);
    if (candidate?.status === 'taken') return 'taken';
    return candidate && isLeagueCandidateCurrent(candidate) ? 'available' : 'unknown';
  };

  // Only players who could be added: not yours and not marked taken.
  const pool = useMemo<PlannerCandidate[]>(() => (open ? teamPlayers : [])
    .filter((player) => {
      const id = normalizePlayerId(player.id);
      return !rosterIds.has(id) && candidates.get(id)?.status !== 'taken';
    })
    .map((player) => {
      const candidate = candidates.get(normalizePlayerId(player.id));
      return { player: asRosterPlayer(player), confirmed: Boolean(candidate && isLeagueCandidateCurrent(candidate)) };
    }), [candidates, open, rosterIds, teamPlayers]);
  const planner = useWeekPlanner({
    workspace: activeLeague,
    leagueProfile,
    roster: open ? roster : [],
    includeGoalies: true,
    horizon: horizonFor(planningWindow),
    poolOverride: pool,
  });
  const singleAdds = planner.result?.singleAdds ?? {};
  const rankedPlayers = useMemo(() => [...teamPlayers].sort((a, b) =>
    (singleAdds[normalizePlayerId(b.id)]?.gain ?? -1) - (singleAdds[normalizePlayerId(a.id)]?.gain ?? -1)
    || (b.blendedFppg ?? -1) - (a.blendedFppg ?? -1)
    || a.name.localeCompare(b.name)), [singleAdds, teamPlayers]);

  const setAvailability = (player: DraftPlayer, status: 'available' | 'taken') => {
    const now = new Date().toISOString();
    updateLeague({
      ...activeLeague,
      candidates: setCandidateAvailability(activeLeague.candidates, { id: player.id, team: player.team, position: player.pos[0] }, status, now),
      updatedAt: now,
    });
  };
  const addToPlan = (player: DraftPlayer) => {
    setAvailability(player, 'available');
    onOpenChange(false);
    navigate('/team#pickup-board');
  };
  const windowLabel = planner.result ? `${shortDate(planner.result.window.start)} to ${shortDate(planner.result.window.end)}` : planningWindow.label.toLowerCase();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby="schedule-team-description" className="w-[min(96vw,34rem)] !bg-surface-2 p-0 [backdrop-filter:none]">
        <div className="sticky top-0 z-10 border-b border-line bg-surface-raised p-5 pr-14">
          <DrawerClose asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Close team players"><X size={18} /></Button></DrawerClose>
          <ModalTitle className="flex items-center gap-3">
            {team && <img src={team.logo} alt="" className="size-10 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} />}
            <span>{team?.teamName ?? 'Team players'}</span>
          </ModalTitle>
          <ModalDescription id="schedule-team-description">
            What adding each player is worth to your lineup, {windowLabel}, using the My Team planner and {meta?.scoringLabel ?? activeLeague.scoring.label}. Values assume he's available; mark him Available or Taken to keep your plan honest.
          </ModalDescription>
        </div>

        {team && <div className="border-b border-line p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line bg-surface-0 p-3"><span className="text-xs text-ink-mute">Games this week</span><strong className="scoreboard-number mt-1 block text-2xl text-ink">{games.length}</strong></div>
            <div className="rounded-lg border border-line bg-surface-0 p-3"><span className="text-xs text-ink-mute">Starts they add to your lineup</span><strong className="scoreboard-number mt-1 block text-2xl text-accent">+{opportunity?.extraUsableStarts ?? 0}</strong></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {games.map((game) => <span key={`${game.day}-${game.opponent}-${game.start}`} className={`rounded-full border px-2 py-1 text-xs ${game.isOffNight ? 'border-positive/60 bg-positive-muted text-positive' : 'border-line bg-surface-1 text-ink-dim'}`}><strong>{game.day}</strong> {game.home ? 'vs' : '@'} {game.opponent}</span>)}
            {games.length === 0 && <span className="text-sm text-ink-mute">No games in this week.</span>}
          </div>
        </div>}

        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Users size={15} className="text-accent" aria-hidden="true" />Players, best add first</h3>
            <span className="text-xs text-ink-mute">{planner.status === 'loading' && pool.length > 0 ? 'Planning…' : `${teamPlayers.length} listed`}</span>
          </div>
          {loading && <p className="rounded-lg border border-line bg-surface-0 p-6 text-center text-sm text-ink-dim">Loading players…</p>}
          {error && <p className="rounded-lg border border-negative bg-negative-muted p-3 text-sm text-negative">{error}</p>}
          {planner.status === 'error' && <p className="rounded-lg border border-warning bg-warning-muted p-3 text-sm text-warning">Lineup values are unavailable right now; the players and their schedule are still listed.</p>}
          {!loading && !error && rankedPlayers.map((player) => {
            const status = statusOf(player.id);
            const add = singleAdds[normalizePlayerId(player.id)];
            return (
              <article key={player.id} className={`rounded-lg border bg-surface-0 p-3 ${status === 'taken' ? 'border-line opacity-60' : add ? 'border-positive/40' : 'border-line'}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-ink">{player.name}</strong>
                    <span className="mt-0.5 block text-xs text-ink-dim">{player.pos.join('/')} · {player.blendedFppg === null ? 'No FPPG sample' : `${player.blendedFppg.toFixed(2)} FPPG`}</span>
                  </div>
                  {status === 'rostered' ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent bg-accent-muted px-2 py-1 text-[10px] text-accent"><Users size={11} aria-hidden="true" />On your roster</span>
                  ) : status === 'taken' ? (
                    <span className="shrink-0 rounded-full border border-line bg-surface-1 px-2 py-1 text-[10px] text-ink-mute">Taken</span>
                  ) : add ? (
                    <span className="shrink-0 text-right">
                      <strong className="scoreboard-number block text-lg text-positive">+{add.gain.toFixed(1)}</strong>
                      <span className="text-[10px] text-ink-mute">lineup pts</span>
                    </span>
                  ) : planner.status === 'ready' ? (
                    <span className="shrink-0 text-[10px] text-ink-mute">No lineup room</span>
                  ) : null}
                </div>
                {status !== 'rostered' && status !== 'taken' && add && (
                  <p className="mt-1 text-xs text-ink-dim">
                    From {shortDate(add.effectiveDate)}{add.drop ? `, dropping ${add.drop.full_name}` : add.irMove ? ` after moving ${add.irMove.full_name} to IR` : ' into an open roster spot'}
                  </p>
                )}
                {status !== 'rostered' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] ${status === 'available' ? 'text-positive' : status === 'taken' ? 'text-ink-mute' : 'text-warning'}`}>
                      {status === 'available' ? <Check size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}
                      {status === 'available' ? 'Marked available' : status === 'taken' ? 'Marked taken' : 'Check if he\'s available'}
                    </span>
                    <span className="ml-auto flex gap-1">
                      {status !== 'available' && <Button size="sm" variant="ghost" onClick={() => setAvailability(player, 'available')}>Available</Button>}
                      {status !== 'taken' && <Button size="sm" variant="ghost" onClick={() => setAvailability(player, 'taken')}>Taken</Button>}
                      {status !== 'taken' && add && <Button size="sm" onClick={() => addToPlan(player)}><ListPlus size={13} aria-hidden="true" />Add to plan</Button>}
                    </span>
                  </div>
                )}
              </article>
            );
          })}
          {!loading && !error && teamPlayers.length === 0 && <p className="rounded-lg border border-line bg-surface-0 p-6 text-center text-sm text-ink-dim">No active players are listed for this team.</p>}
        </div>
        <div className="border-t border-line bg-surface-0 p-4 text-xs text-ink-mute"><CalendarDays size={13} className="mr-1 inline text-accent" aria-hidden="true" />"Add to plan" marks him available and opens the planner on My Team, where he's included in this week's plan.</div>
      </DrawerContent>
    </Drawer>
  );
}
