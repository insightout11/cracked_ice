import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarDays, Check, Clock3, Plus, Users, X } from 'lucide-react';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import type { DraftPlayer, DraftPlayerDirectoryMeta } from '../../lib/playerSearch';
import type { TeamWeek } from '../../lib/schedule';
import type { TeamStreamingValue } from '../../lib/scheduleOpportunity';
import { createLeagueCandidateObservation, isLeagueCandidateCurrent, upsertLeagueCandidates } from '../../lib/leagueWorkspace';
import { rankAddDropPairs, type AddDropRecommendation } from '../../lib/acquisitionAnalysis';
import type { PlanningWindow } from '../../lib/schedulePlanning';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
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

function normalizePlayerId(playerId: string): string {
  return playerId.replace(/^nhl:/, '');
}

function availabilityLabel(source: string): string {
  return ({
    'live-provider': 'Confirmed by provider',
    'screenshot-confirmed': 'Confirmed from screenshot',
    'user-confirmed': 'Manually confirmed',
    'imported-snapshot': 'Confirmed from import',
  } as Record<string, string>)[source] ?? 'Availability unknown';
}

export function ScheduleTeamDrawer({ open, team, opportunity, leagueProfile, planningWindow, onOpenChange }: ScheduleTeamDrawerProps) {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [meta, setMeta] = useState<DraftPlayerDirectoryMeta | null>(null);
  const [loadedProfileKey, setLoadedProfileKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ player: DraftPlayer; recommendation: AddDropRecommendation | null; error?: string } | null>(null);
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
  const teamPlayers = useMemo(() => team ? players
    .filter((player) => player.team === team.team)
    .sort((a, b) => (b.blendedFppg ?? -1) - (a.blendedFppg ?? -1) || a.name.localeCompare(b.name)) : [], [players, team]);
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

  useEffect(() => {
    setPreview(null);
    setPreviewingId(null);
  }, [planningWindow.end, planningWindow.start, team?.team]);

  const markAvailable = (playerId: string) => {
    const now = new Date().toISOString();
    updateLeague({
      ...activeLeague,
      candidates: upsertLeagueCandidates(activeLeague.candidates, [createLeagueCandidateObservation(playerId, 'user-confirmed', now)]),
      updatedAt: now,
    });
  };

  const previewTransaction = async (player: DraftPlayer) => {
    if (roster.length === 0) {
      setPreview({ player, recommendation: null, error: 'Add your roster in My Team before previewing a swap.' });
      return;
    }
    setPreviewingId(player.id);
    setPreview(null);
    const candidate: RosterPlayer = {
      id: player.id,
      full_name: player.name,
      team: player.team,
      positions: player.pos,
      current_slot: 'BN',
      games_played: 0,
      stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
      blendedFppg: player.blendedFppg,
    };
    try {
      const response = await apiService.applyRosterLineup({
        league: leagueProfile,
        window: { start: planningWindow.start, end: planningWindow.end },
        roster: [...roster.map((item) => ({ playerId: item.id, slot: item.current_slot ?? 'BN' })), { playerId: player.id, slot: 'BN' }],
      });
      const recommendation = rankAddDropPairs(activeLeague, roster, [candidate], response.projections)[0] ?? null;
      setPreview({ player, recommendation, error: recommendation ? undefined : 'No legal drop comparison is available for this roster.' });
    } catch {
      setPreview({ player, recommendation: null, error: 'The transaction preview could not be calculated right now.' });
    } finally {
      setPreviewingId(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby="schedule-team-description" className="w-[min(96vw,34rem)] p-0">
        <div className="sticky top-0 z-10 border-b border-line bg-surface-raised p-5 pr-14">
          <DrawerClose asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Close team players"><X size={18} /></Button></DrawerClose>
          <p className="scoreboard-text text-accent">TEAM PLAYER BOARD</p>
          <ModalTitle className="mt-1 flex items-center gap-3">
            {team && <img src={team.logo} alt="" className="size-10 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} />}
            <span>{team?.teamName ?? 'Team players'}</span>
          </ModalTitle>
          <ModalDescription id="schedule-team-description">Players are ranked using {meta?.scoringLabel ?? activeLeague.scoring.label}. Previewed starts use {planningWindow.label.toLowerCase()} ({planningWindow.start} to {planningWindow.end}). Availability is never assumed.</ModalDescription>
        </div>

        {team && <div className="border-b border-line p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line bg-surface-0 p-3"><span className="text-xs text-ink-mute">Weekly games</span><strong className="scoreboard-number mt-1 block text-2xl text-ink">{games.length}</strong></div>
            <div className="rounded-lg border border-line bg-surface-0 p-3"><span className="text-xs text-ink-mute">Roster opportunity</span><strong className="scoreboard-number mt-1 block text-2xl text-accent">+{opportunity?.extraUsableStarts ?? 0}</strong></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {games.map((game) => <span key={`${game.day}-${game.opponent}-${game.start}`} className={`rounded-full border px-2 py-1 text-xs ${game.isOffNight ? 'border-positive/60 bg-positive-muted text-positive' : 'border-line bg-surface-1 text-ink-dim'}`}><strong>{game.day}</strong> {game.home ? 'vs' : '@'} {game.opponent}</span>)}
            {games.length === 0 && <span className="text-sm text-ink-mute">No games in this week.</span>}
          </div>
        </div>}

        {preview && <div className="border-b border-line bg-accent-muted p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="scoreboard-text text-accent">TRANSACTION PREVIEW</p>
              <h3 className="mt-1 text-sm font-semibold text-ink">Add {preview.player.name}{preview.recommendation ? ` · drop ${preview.recommendation.drop.full_name}` : ''}</h3>
              <p className="mt-1 text-xs text-ink-dim">{planningWindow.label} · {planningWindow.start} to {planningWindow.end}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Close transaction preview" onClick={() => setPreview(null)}><X size={15} /></Button>
          </div>
          {preview.recommendation ? <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-line bg-surface-0 p-2"><span className="text-[10px] text-ink-mute">Points</span><strong className={`block text-lg ${preview.recommendation.projectedPointsDelta >= 0 ? 'text-positive' : 'text-negative'}`}>{preview.recommendation.projectedPointsDelta >= 0 ? '+' : ''}{preview.recommendation.projectedPointsDelta.toFixed(1)}</strong></div>
              <div className="rounded-md border border-line bg-surface-0 p-2"><span className="text-[10px] text-ink-mute">Starts</span><strong className="block text-lg text-accent">{preview.recommendation.startsDelta >= 0 ? '+' : ''}{preview.recommendation.startsDelta}</strong></div>
              <div className="rounded-md border border-line bg-surface-0 p-2"><span className="text-[10px] text-ink-mute">Usable</span><strong className="block text-lg text-ink">{preview.recommendation.candidateStarts}/{preview.recommendation.candidateGames}</strong></div>
            </div>
            <p className="mt-3 text-xs text-ink-dim">Starts: {preview.recommendation.candidateStartDates.join(', ') || 'none'}{preview.recommendation.candidateBlockedDates.length > 0 ? ` · Blocked by lineup congestion: ${preview.recommendation.candidateBlockedDates.join(', ')}` : ''}</p>
          </> : <p className="mt-3 rounded-md border border-warning bg-warning-muted p-3 text-sm text-warning">{preview.error}</p>}
          {(!candidates.get(normalizePlayerId(preview.player.id)) || !isLeagueCandidateCurrent(candidates.get(normalizePlayerId(preview.player.id))!)) && <p className="mt-2 text-xs text-warning">Schedule fit only: this player's availability has not been confirmed.</p>}
        </div>}

        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Users size={15} className="text-accent" aria-hidden="true" />Players</h3>
            <span className="text-xs text-ink-mute">{teamPlayers.length} listed</span>
          </div>
          {loading && <p className="rounded-lg border border-line bg-surface-0 p-6 text-center text-sm text-ink-dim">Loading players…</p>}
          {error && <p className="rounded-lg border border-negative bg-negative-muted p-3 text-sm text-negative">{error}</p>}
          {!loading && !error && teamPlayers.map((player) => {
            const id = normalizePlayerId(player.id);
            const candidate = candidates.get(id);
            const onRoster = rosterIds.has(id);
            const current = candidate ? isLeagueCandidateCurrent(candidate) : false;
            const label = onRoster ? 'On your roster' : current && candidate ? availabilityLabel(candidate.availability) : candidate ? 'Availability stale' : 'Availability unknown';
            return (
              <article key={player.id} className="rounded-lg border border-line bg-surface-0 p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-ink">{player.name}</strong>
                    <span className="mt-0.5 block text-xs text-ink-dim">{player.pos.join('/')} · {player.blendedFppg === null ? 'No FPPG sample' : `${player.blendedFppg.toFixed(2)} FPPG`}</span>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${onRoster ? 'border-accent bg-accent-muted text-accent' : current ? 'border-positive bg-positive-muted text-positive' : candidate ? 'border-warning bg-warning-muted text-warning' : 'border-line bg-surface-1 text-ink-mute'}`}>
                    {onRoster ? <Users size={11} aria-hidden="true" /> : current ? <Check size={11} aria-hidden="true" /> : <Clock3 size={11} aria-hidden="true" />}{label}
                  </span>
                </div>
                {!onRoster && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-2">
                  {!current && <Button size="sm" variant="ghost" onClick={() => markAvailable(player.id)}><Plus size={13} aria-hidden="true" />Mark available</Button>}
                  <Button size="sm" variant="ghost" className="border border-line" disabled={previewingId === player.id} onClick={() => previewTransaction(player)}><ArrowRightLeft size={13} aria-hidden="true" />{previewingId === player.id ? 'Calculating…' : 'Preview add/drop'}</Button>
                </div>}
              </article>
            );
          })}
          {!loading && !error && teamPlayers.length === 0 && <p className="rounded-lg border border-line bg-surface-0 p-6 text-center text-sm text-ink-dim">No active players are listed for this team.</p>}
        </div>
        <div className="border-t border-line bg-surface-0 p-4 text-xs text-ink-mute"><CalendarDays size={13} className="mr-1 inline text-accent" aria-hidden="true" />A team-level opportunity is a schedule signal. Position eligibility is evaluated later in the transaction preview.</div>
      </DrawerContent>
    </Drawer>
  );
}
