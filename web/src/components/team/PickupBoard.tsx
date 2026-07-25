import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Clock3, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import type { LeagueProfile, PlayerProjection, RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import type { TimeWindowState } from '../../types/timeWindow';
import { apiService } from '../../services/api';
import { rankAddDropPairs } from '../../lib/acquisitionAnalysis';
import { createAcquisitionDemo } from '../../lib/acquisitionDemo';
import { createLeagueCandidateObservation, isLeagueCandidateCurrent, upsertLeagueCandidates } from '../../lib/leagueWorkspace';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { BulkImportPanel } from '../players/BulkImportPanel';
import { Button } from '../ui/button';
import { StreamingPlanner } from './StreamingPlanner';
import { createStreamingDemo } from '../../lib/streamingDemo';

interface PickupBoardProps {
  roster: RosterPlayer[];
  rosterProjections: Record<string, PlayerProjection>;
  leagueProfile: LeagueProfile;
  timeWindow: TimeWindowState;
  compact?: boolean;
}

function toRosterPlayer(player: PlayerSearchResult): RosterPlayer {
  return {
    id: player.id,
    full_name: player.name,
    team: player.team,
    positions: player.pos,
    games_played: player.games_played ?? 0,
    stats: player.stats ?? { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
    blendedFppg: player.blendedFppg,
    seasonFppg: player.seasonFppg,
    last30Fppg: player.last30Fppg,
    last7Fppg: player.last7Fppg,
  };
}

function sourceLabel(source: string): string {
  return ({
    'live-provider': 'Provider sync',
    'screenshot-confirmed': 'Screenshot',
    'user-confirmed': 'Manually confirmed',
    'imported-snapshot': 'Pasted snapshot',
    unknown: 'Unknown',
  } as Record<string, string>)[source] ?? source;
}

export function PickupBoard({ roster, rosterProjections, leagueProfile, timeWindow, compact = false }: PickupBoardProps) {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const [players, setPlayers] = useState<PlayerSearchResult[]>([]);
  const [candidateProjections, setCandidateProjections] = useState<Record<string, PlayerProjection>>({});
  const [query, setQuery] = useState('');
  const [showIntake, setShowIntake] = useState(activeLeague.candidates.length === 0);
  const [loading, setLoading] = useState(false);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [showTestScenario, setShowTestScenario] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getAllPlayers(leagueProfile)
      .then((response) => {
        const payload = response as typeof response & { players?: PlayerSearchResult[] };
        if (!cancelled) setPlayers(payload.players ?? payload.results ?? []);
      })
      .catch(() => { if (!cancelled) setMessage('The player directory could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leagueProfile]);

  const playerById = useMemo(() => new Map(players.map((player) => [player.id.replace(/^nhl:/, ''), player])), [players]);
  const candidates = useMemo(() => activeLeague.candidates
    .map((candidate) => {
      const player = playerById.get(candidate.playerId.replace(/^nhl:/, ''));
      return player ? { candidate, player, rosterPlayer: toRosterPlayer(player) } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item)), [activeLeague.candidates, playerById]);
  const currentCandidates = useMemo(() => candidates.filter(({ candidate }) => isLeagueCandidateCurrent(candidate)), [candidates]);

  useEffect(() => {
    if (currentCandidates.length === 0) {
      setCandidateProjections({});
      setProjectionLoading(false);
      return;
    }
    let cancelled = false;
    setProjectionLoading(true);
    apiService.applyRosterLineup({
      league: leagueProfile,
      window: { start: timeWindow.config.startUtc, end: timeWindow.config.endUtc },
      roster: currentCandidates.map(({ player }) => ({ playerId: player.id, slot: 'BN' })),
    }).then((response) => {
      if (!cancelled) setCandidateProjections(response.projections);
    }).catch(() => {
      if (!cancelled) setMessage('Candidate schedule projections are temporarily unavailable. Your pickup list is still saved.');
    }).finally(() => {
      if (!cancelled) setProjectionLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentCandidates, leagueProfile, timeWindow.config.endUtc, timeWindow.config.startUtc]);

  const recommendations = useMemo(() => rankAddDropPairs(
    activeLeague,
    roster,
    currentCandidates.map(({ rosterPlayer }) => rosterPlayer),
    { ...rosterProjections, ...candidateProjections },
  ), [activeLeague, candidateProjections, currentCandidates, roster, rosterProjections]);
  const candidateMetaById = useMemo(() => new Map(activeLeague.candidates.map((candidate) => [candidate.playerId.replace(/^nhl:/, ''), candidate])), [activeLeague.candidates]);
  const movesRemaining = activeLeague.acquisitions.limit === null || activeLeague.acquisitions.movesUsed === null
    ? null
    : Math.max(0, activeLeague.acquisitions.limit - activeLeague.acquisitions.movesUsed);
  const testScenario = useMemo(() => createAcquisitionDemo(activeLeague), [activeLeague]);
  const testRecommendation = useMemo(() => rankAddDropPairs(
    testScenario.workspace,
    testScenario.roster,
    testScenario.candidates,
    testScenario.projections,
  )[0], [testScenario]);
  const testPassed = Boolean(testRecommendation) &&
    testRecommendation.candidateStarts === testScenario.expected.candidateStarts &&
    testRecommendation.candidateGames === testScenario.expected.candidateGames &&
    testRecommendation.candidateCongestionGames === testScenario.expected.blockedGames &&
    testRecommendation.startsDelta === testScenario.expected.startsDelta &&
    testRecommendation.projectedPointsDelta === testScenario.expected.pointsDelta;

  const manualMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) return [];
    const rosterIds = new Set(roster.map((player) => player.id.replace(/^nhl:/, '')));
    const candidateIds = new Set(activeLeague.candidates.map((candidate) => candidate.playerId.replace(/^nhl:/, '')));
    return players.filter((player) =>
      !rosterIds.has(player.id.replace(/^nhl:/, '')) &&
      !candidateIds.has(player.id.replace(/^nhl:/, '')) &&
      (player.name.toLowerCase().includes(normalizedQuery) || player.team.toLowerCase().includes(normalizedQuery)))
      .slice(0, 6);
  }, [activeLeague.candidates, players, query, roster]);

  const saveCandidates = (playerIds: string[], source: 'paste' | 'screenshot' | 'manual') => {
    const now = new Date().toISOString();
    const availability = source === 'screenshot' ? 'screenshot-confirmed' : source === 'manual' ? 'user-confirmed' : 'imported-snapshot';
    const next = playerIds.map((playerId) => createLeagueCandidateObservation(playerId, availability, now));
    updateLeague({
      ...activeLeague,
      candidates: upsertLeagueCandidates(activeLeague.candidates, next),
      freshness: { ...activeLeague.freshness, importedAt: now },
      updatedAt: now,
    });
    setQuery('');
    setMessage(`${playerIds.length} candidate${playerIds.length === 1 ? '' : 's'} saved from ${source === 'manual' ? 'manual confirmation' : source}.`);
  };

  const removeCandidate = (playerId: string) => {
    updateLeague({
      ...activeLeague,
      candidates: activeLeague.candidates.filter((candidate) => candidate.playerId !== playerId),
      updatedAt: new Date().toISOString(),
    });
  };

  const refreshCandidate = (playerId: string) => {
    const now = new Date().toISOString();
    updateLeague({
      ...activeLeague,
      candidates: activeLeague.candidates.map((candidate) => candidate.playerId === playerId
        ? createLeagueCandidateObservation(candidate.playerId, 'user-confirmed', now)
        : candidate),
      updatedAt: now,
    });
    setMessage('Availability reconfirmed for the next 24 hours.');
  };

  const uploadScreenshot = async (file: File): Promise<string[]> => {
    const result = await apiService.uploadFreeAgentsImage(file);
    return result.playerNames;
  };

  return (
    <section className="rounded-lg border border-line bg-surface-glass shadow-raised [backdrop-filter:var(--frost)]" aria-labelledby="pickup-board-title">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="scoreboard-text text-accent">PICKUP BOARD</p>
          <h2 id="pickup-board-title" className="mt-1 text-xl font-semibold text-ink">Available-player decisions</h2>
          <p className="mt-1 text-sm text-ink-dim">Rank add/drop pairs among players you have actually confirmed are available.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {import.meta.env.DEV && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowTestScenario((value) => !value)} aria-expanded={showTestScenario}>
              {showTestScenario ? 'Close test' : 'Preview test case'}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowIntake((value) => !value)} aria-expanded={showIntake}>
            {showIntake ? 'Close intake' : 'Add candidates'}
          </Button>
        </div>
      </div>

      {showTestScenario && import.meta.env.DEV && (
        <div className="border-b border-line bg-surface-1 p-4" role="status">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="scoreboard-text text-accent">SYNTHETIC OFF-SEASON CHECK</p>
              <p className="mt-1 text-sm text-ink">One RW slot · protected anchor · current RW versus candidate RW · {testScenario.window.start} to {testScenario.window.end}</p>
              <p className="mt-1 text-xs text-ink-dim">Expected: candidate starts 5/7 games, 2 blocked games, +1 total lineup start, +8.0 lineup points. This preview does not change your league or roster.</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${testPassed ? 'border-positive bg-positive-muted text-positive' : 'border-negative bg-negative-muted text-negative'}`}>
              {testPassed ? 'Fixture passed' : 'Fixture failed'}
            </span>
          </div>
          {testRecommendation && (
            <p className="mt-3 text-sm text-ink">
              Actual: {testRecommendation.candidateStarts}/{testRecommendation.candidateGames} starts · {testRecommendation.candidateCongestionGames} blocked · {testRecommendation.startsDelta >= 0 ? '+' : ''}{testRecommendation.startsDelta} lineup start · {testRecommendation.projectedPointsDelta >= 0 ? '+' : ''}{testRecommendation.projectedPointsDelta.toFixed(1)} points
            </p>
          )}
        </div>
      )}

      {showIntake && (
        <div className="grid gap-4 border-b border-line p-4 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-start gap-2 rounded-md border border-line bg-surface-2 p-3 text-xs text-ink-dim">
              <ShieldCheck className="mt-0.5 shrink-0 text-positive" size={16} />
              <span>Every extracted name stays in review until you approve it. Overlapping screenshots are deduplicated, and ambiguous names cannot enter the board silently.</span>
            </div>
            <BulkImportPanel
              allPlayers={players}
              existingPlayerIds={[...roster.map((player) => player.id), ...activeLeague.candidates.map((candidate) => candidate.playerId)]}
              onImport={(playerIds, intake = 'paste') => saveCandidates(playerIds, intake)}
              onOcrUpload={uploadScreenshot}
              mode="free-agents"
              embedded
            />
          </div>
          <div>
            <label htmlFor="pickup-player-search" className="scoreboard-text mb-2 block text-accent">Manually confirm available</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={17} />
              <input id="pickup-player-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or team" className="w-full rounded-lg border border-line bg-surface-0 py-3 pl-10 pr-3 text-sm text-ink outline-none placeholder:text-ink-mute focus:border-accent" />
            </div>
            <div className="mt-2 space-y-1">
              {manualMatches.map((player) => (
                <button key={player.id} type="button" onClick={() => saveCandidates([player.id], 'manual')} className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface-0 px-3 py-2 text-left hover:bg-surface-2">
                  <span><strong className="block text-sm text-ink">{player.name}</strong><span className="text-xs text-ink-dim">{player.team} · {player.pos.join('/')}</span></span>
                  <span className="text-xs font-semibold text-accent">Mark available</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`grid gap-4 p-4 ${compact ? '' : 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]'}`}>
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Confirmed candidates</h3>
            <span className="text-xs text-ink-mute">{currentCandidates.length} current · {candidates.length - currentCandidates.length} stale</span>
          </div>
          {loading && <p className="mt-3 text-sm text-ink-dim">Loading player directory…</p>}
          {!loading && candidates.length === 0 && <p className="mt-3 text-sm text-ink-dim">Add a screenshot, paste, or manual confirmation to begin.</p>}
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {candidates.map(({ candidate, player }) => {
              const isStale = !candidate.expiresAt || new Date(candidate.expiresAt).getTime() <= Date.now();
              return (
                <div key={candidate.playerId} className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-3">
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-ink">{player.name}</strong>
                    <span className={`mt-1 flex items-center gap-1 text-xs ${isStale ? 'text-warning' : 'text-ink-dim'}`}><Clock3 size={13} />{sourceLabel(candidate.availability)} · {candidate.observedAt ? new Date(candidate.observedAt).toLocaleString() : 'time unknown'}{isStale ? ' · recheck availability' : ''}</span>
                  </span>
                  <button type="button" onClick={() => refreshCandidate(candidate.playerId)} aria-label={`Reconfirm ${player.name} is available`} className="rounded p-2 text-ink-mute hover:bg-surface-1 hover:text-accent"><RefreshCw size={16} /></button>
                  <button type="button" onClick={() => removeCandidate(candidate.playerId)} aria-label={`Remove ${player.name} from pickup board`} className="rounded p-2 text-ink-mute hover:bg-surface-1 hover:text-negative"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Best add/drop pairs</h3>
            <span className="text-xs text-ink-mute">Best among {currentCandidates.length} currently confirmed candidate{currentCandidates.length === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-line bg-surface-1 px-3 py-2 text-xs text-ink-dim">
            <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-accent" />{timeWindow.config.startUtc.slice(0, 10)} to {timeWindow.config.endUtc.slice(0, 10)}</span>
            <span>{activeLeague.scoring.label}</span>
            <span>{movesRemaining === null ? 'Move limit not set' : `${movesRemaining} ${activeLeague.acquisitions.period} move${movesRemaining === 1 ? '' : 's'} left`}</span>
          </div>
          {activeLeague.acquisitions.limit !== null && activeLeague.acquisitions.movesUsed !== null && activeLeague.acquisitions.movesUsed >= activeLeague.acquisitions.limit && (
            <p className="mt-2 flex items-center gap-2 text-xs text-warning"><AlertTriangle size={15} />No moves remain in the configured {activeLeague.acquisitions.period} limit.</p>
          )}
          {projectionLoading && <p className="mt-3 text-sm text-ink-dim">Re-solving your daily lineup for each candidate…</p>}
          {!projectionLoading && candidates.length > 0 && recommendations.length === 0 && <p className="mt-3 text-sm text-ink-dim">No eligible drop can be evaluated. Keepers, protected players, undroppable players, and inactive slots are excluded.</p>}
          <div className="mt-2 space-y-2">
            {!projectionLoading && recommendations.slice(0, compact ? 3 : 6).map((recommendation, index) => {
              const candidateMeta = candidateMetaById.get(recommendation.candidate.id.replace(/^nhl:/, ''));
              return (
                <article key={`${recommendation.candidate.id}-${recommendation.drop.id}`} className="rounded-md border border-line bg-surface-2 p-3">
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                    <span className="scoreboard-number text-sm text-ink-mute">#{index + 1}</span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                        <strong>{recommendation.candidate.full_name}</strong>
                        <ArrowRight size={14} className="text-accent" aria-hidden="true" />
                        <span className="text-ink-dim">drop {recommendation.drop.full_name}</span>
                      </p>
                      <p className="mt-1 text-xs text-ink-dim">
                        Starts {recommendation.candidateStarts}/{recommendation.candidateGames} candidate games
                        {' · '}{recommendation.startsDelta >= 0 ? '+' : ''}{recommendation.startsDelta} total lineup starts
                        {' · '}{recommendation.candidateCongestionGames} blocked by lineup competition
                      </p>
                    </div>
                    <span className="text-left sm:text-right">
                      <strong className={`scoreboard-number block text-lg ${recommendation.projectedPointsDelta >= 0 ? 'text-positive' : 'text-negative'}`}>{recommendation.projectedPointsDelta >= 0 ? '+' : ''}{recommendation.projectedPointsDelta.toFixed(1)}</strong>
                      <span className="text-xs text-ink-mute">lineup pts</span>
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 border-t border-line pt-2 text-xs text-ink-mute sm:grid-cols-2">
                    <span>Drop cost: {recommendation.dropCost.toFixed(1)} pts across {recommendation.dropStarts} start{recommendation.dropStarts === 1 ? '' : 's'}</span>
                    <span className="sm:text-right">{candidateMeta ? `${sourceLabel(candidateMeta.availability)} · ${candidateMeta.observedAt ? new Date(candidateMeta.observedAt).toLocaleString() : 'time unknown'}` : 'Availability source unknown'}</span>
                  </div>
                </article>
              );
            })}
          </div>
          {recommendations.length > 0 && <p className="mt-3 text-xs text-ink-mute">Projected lineup impact re-solves each day using position eligibility and active-slot capacity. It does not claim these are all available players.</p>}
        </div>
      </div>
      {roster.length > 0 && currentCandidates.length > 0 && !projectionLoading && (
        <StreamingPlanner
          workspace={activeLeague}
          roster={roster}
          candidates={currentCandidates.map(({ rosterPlayer }) => rosterPlayer)}
          projections={{ ...rosterProjections, ...candidateProjections }}
          selectedWindow={{ start: timeWindow.config.startUtc.slice(0, 10), end: timeWindow.config.endUtc.slice(0, 10) }}
          compact={compact}
        />
      )}
      {showTestScenario && (() => {
        const demo = createStreamingDemo(activeLeague);
        return (
          <StreamingPlanner
            workspace={demo.workspace}
            roster={demo.roster}
            candidates={demo.candidates}
            projections={demo.projections}
            selectedWindow={demo.window}
            compact={compact}
            previewLabel="Deterministic preview: three confirmed targets, one active C slot, and three moves remaining. Nothing is saved."
          />
        );
      })()}
      {message && <p className="border-t border-line px-4 py-3 text-sm text-ink-dim" aria-live="polite">{message}</p>}
    </section>
  );
}
