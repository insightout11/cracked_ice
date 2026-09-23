import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Clock3, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { LeagueProfile, PlayerProjection, RosterPlayer } from '../../lib/coachSchemas';
import type { TimeWindowState } from '../../types/timeWindow';
import { apiService } from '../../services/api';
import { rankAddDropPairs } from '../../lib/acquisitionAnalysis';
import { createAcquisitionDemo } from '../../lib/acquisitionDemo';
import { createLeagueCandidateObservation, createLeagueCandidateTarget, isLeagueCandidateObservationCurrent, recordLeagueCandidateStatus, upsertLeagueCandidates } from '../../lib/leagueWorkspace';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { acquisitionAvailabilityLabel, sourceLabel, useAcquisitionRecommendations } from '../../hooks/useAcquisitionRecommendations';
import { parseHomeActionContext, resolveRecommendationHandoff } from '../../lib/navigationContext';
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

export function PickupBoard({ roster, rosterProjections, leagueProfile, timeWindow, compact = false }: PickupBoardProps) {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const [searchParams] = useSearchParams();
  const handledScenarioRef = useRef<string | null>(null);
  const [query, setQuery] = useState('');
  // Mobile already has a full player search with per-row availability actions.
  // Keep the bulk intake optional there instead of opening a second search by default.
  const [showIntake, setShowIntake] = useState(!compact && activeLeague.candidates.length === 0);
  const [showTestScenario, setShowTestScenario] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null);

  const recommendations = useAcquisitionRecommendations({ workspace: activeLeague, leagueProfile, timeWindow, rosterProjections });
  const { players, candidateProjections, candidates, currentCandidates, automaticCandidates, confirmedEvaluations, confirmedLanes, targetScenarios, automaticLanes, directoryLoading: loading, projectionLoading } = recommendations;
  const automaticById = useMemo(() => new Map(automaticCandidates.map((candidate) => [candidate.player.id.replace(/^nhl:/, ''), candidate])), [automaticCandidates]);
  const candidateMetaById = useMemo(() => new Map(activeLeague.candidates.map((candidate) => [candidate.playerId.replace(/^nhl:/, ''), candidate])), [activeLeague.candidates]);
  const movesRemaining = activeLeague.acquisitions.limit === null || activeLeague.acquisitions.movesUsed === null
    ? null
    : Math.max(0, activeLeague.acquisitions.limit - activeLeague.acquisitions.movesUsed);
  const handoff = useMemo(() => parseHomeActionContext(`?${searchParams.toString()}`), [searchParams]);
  const resolvedHandoff = useMemo(() => resolveRecommendationHandoff(recommendations.allScenarios, handoff), [handoff, recommendations.allScenarios]);
  const handoffScenario = resolvedHandoff.scenario;
  const handoffRecalculated = resolvedHandoff.state === 'recalculated';

  useEffect(() => {
    if (handoff?.source !== 'home-recommendation' || !handoff.scenarioId || recommendations.status === 'loading' || handledScenarioRef.current === handoff.scenarioId) return;
    handledScenarioRef.current = handoff.scenarioId;
    if (handoffScenario) setExpandedScenarioId(handoffScenario.id);
    document.getElementById('pickup-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [handoff, handoffScenario, recommendations.status]);
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
      candidates: activeLeague.candidates.map((candidate) => candidate.playerId.replace(/^nhl:/, '') === playerId.replace(/^nhl:/, '')
        ? recordLeagueCandidateStatus(candidate, 'available', now)
        : candidate),
      updatedAt: now,
    });
    setMessage('Availability reconfirmed for the next 24 hours.');
  };

  const markCandidateTaken = (playerId: string) => {
    const now = new Date().toISOString();
    updateLeague({
      ...activeLeague,
      candidates: activeLeague.candidates.map((candidate) => candidate.playerId.replace(/^nhl:/, '') === playerId.replace(/^nhl:/, '')
        ? recordLeagueCandidateStatus(candidate, 'taken', now)
        : candidate),
      updatedAt: now,
    });
    setMessage('Player marked taken and removed from current recommendations.');
  };

  const saveAutomaticCandidate = (playerId: string, confirmAvailable = false) => {
    const discovery = automaticById.get(playerId.replace(/^nhl:/, ''));
    if (!discovery) return;
    const now = new Date().toISOString();
    const target = createLeagueCandidateTarget(playerId, {
      source: 'market-boundary',
      marketSource: discovery.marketSource,
      marketRank: discovery.marketRank,
      boundaryStart: 1,
      boundaryEnd: 300,
      team: discovery.player.team,
      position: discovery.player.pos[0],
      windowStart: timeWindow.config.startUtc.slice(0, 10),
      windowEnd: timeWindow.config.endUtc.slice(0, 10),
      discoveredAt: now,
    });
    const candidate = confirmAvailable ? recordLeagueCandidateStatus(target, 'available', now) : target;
    updateLeague({
      ...activeLeague,
      candidates: upsertLeagueCandidates(activeLeague.candidates, [candidate]),
      updatedAt: now,
    });
    setMessage(confirmAvailable ? 'Player added and marked available for the next 24 hours.' : 'Player added as a target. Availability still needs to be checked.');
  };

  const uploadScreenshot = async (file: File): Promise<string[]> => {
    const result = await apiService.uploadFreeAgentsImage(file);
    return result.playerNames;
  };

  return (
    <section id="pickup-board" className="rounded-lg border border-line bg-surface-glass shadow-raised [backdrop-filter:var(--frost)]" aria-labelledby="pickup-board-title">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="scoreboard-text text-accent">PICKUP BOARD</p>
          <h2 id="pickup-board-title" className="mt-1 text-xl font-semibold text-ink">Available-player decisions</h2>
          <p className="mt-1 text-sm text-ink-dim">Review confirmed and conditional acquisition scenarios from one shared calculation.</p>
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

      {handoff?.source === 'home-recommendation' && (
        <div className={`border-b p-4 ${handoffRecalculated || (!handoffScenario && recommendations.status !== 'loading') ? 'border-warning/50 bg-warning-muted' : 'border-accent/40 bg-accent-muted'}`} role="status">
          {recommendations.status === 'loading' ? (
            <p className="text-sm text-ink-dim">Reopening the recommendation from Home…</p>
          ) : handoffScenario ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="scoreboard-text text-accent">{handoffRecalculated ? 'RECALCULATED SINCE HOME' : 'OPENED FROM HOME'}</p>
                <p className="mt-1 text-sm text-ink"><strong>{handoffScenario.addition.full_name}</strong>{handoffScenario.drop ? ` · drop ${handoffScenario.drop.full_name}` : ' · no drop required'} · {handoffScenario.impact.projectedPointsDelta >= 0 ? '+' : ''}{handoffScenario.impact.projectedPointsDelta.toFixed(1)} points · {handoffScenario.impact.usableStartsDelta >= 0 ? '+' : ''}{handoffScenario.impact.usableStartsDelta} usable starts</p>
                {handoffRecalculated && <p className="mt-1 text-xs text-warning">League, roster, availability, or projection inputs changed. These are the current numbers for the same move.</p>}
              </div>
              <span className="text-xs font-semibold text-ink-dim">{acquisitionAvailabilityLabel(handoffScenario)}</span>
            </div>
          ) : (
            <p className="text-sm text-warning">This exact Home scenario is no longer reproducible with the current league inputs. Review the refreshed options below.</p>
          )}
        </div>
      )}

      {recommendations.status === 'error' && <p className="border-b border-warning/50 bg-warning-muted px-4 py-3 text-sm text-warning" role="status">{recommendations.error} Your saved pickup targets are still available.</p>}

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
            <span className="text-xs text-ink-mute">{currentCandidates.length} confirmed · {candidates.length - currentCandidates.length} need review</span>
          </div>
          {loading && <p className="mt-3 text-sm text-ink-dim">Loading player directory…</p>}
          {!loading && candidates.length === 0 && <p className="mt-3 text-sm text-ink-dim">Add a screenshot, paste, or manual confirmation to begin.</p>}
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {candidates.map(({ candidate, player }) => {
              const observationCurrent = isLeagueCandidateObservationCurrent(candidate);
              const status = candidate.status ?? (candidate.availability === 'unknown' ? 'unknown' : 'available');
              const needsCheck = status === 'unknown' || !observationCurrent;
              return (
                <div key={candidate.playerId} className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-3">
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-ink">{player.name}</strong>
                    <span className={`mt-1 flex items-center gap-1 text-xs ${status === 'taken' || needsCheck ? 'text-warning' : 'text-ink-dim'}`}><Clock3 size={13} />{status === 'taken' ? 'Taken' : sourceLabel(candidate.availability)} · {candidate.observedAt ? new Date(candidate.observedAt).toLocaleString() : 'not yet checked'}{status === 'taken' ? ' · excluded from recommendations' : needsCheck ? ' · check availability' : ''}</span>
                  </span>
                  <button type="button" onClick={() => refreshCandidate(candidate.playerId)} aria-label={`Confirm ${player.name} is available`} title="Confirm available" className="rounded p-2 text-ink-mute hover:bg-surface-1 hover:text-accent"><RefreshCw size={16} /></button>
                  <button type="button" onClick={() => markCandidateTaken(candidate.playerId)} aria-label={`Mark ${player.name} taken`} title="Mark taken" className="rounded px-2 py-1 text-xs font-semibold text-ink-mute hover:bg-surface-1 hover:text-warning">Taken</button>
                  <button type="button" onClick={() => removeCandidate(candidate.playerId)} aria-label={`Remove ${player.name} from pickup board`} className="rounded p-2 text-ink-mute hover:bg-surface-1 hover:text-negative"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          {automaticLanes.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Suggested players to check</h3>
                  <p className="mt-0.5 text-xs text-ink-dim">Estimated from credible draft-market or NHL-sample evidence. Availability has not been checked.</p>
                </div>
                <span className="rounded-full border border-warning/50 bg-warning-muted px-2 py-1 text-[10px] font-semibold text-warning">Conditional</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {automaticLanes.map((lane) => {
                  const scenario = lane.scenario;
                  const discovery = automaticById.get(scenario.addition.id.replace(/^nhl:/, ''));
                  return (
                    <article key={lane.id} className="rounded-md border border-line bg-surface-2 p-3">
                      <p className="scoreboard-text text-accent">{lane.title}</p>
                      <p className="mt-1 text-[11px] text-ink-dim">{lane.description}</p>
                      <p className="mt-2 text-sm text-ink"><strong>{scenario.addition.full_name}</strong>{scenario.drop ? <> · possible drop <span className="text-ink-dim">{scenario.drop.full_name}</span></> : <> · no drop required</>}</p>
                      <p className="mt-1 text-xs text-ink-dim">
                        If available: <strong className="text-positive">+{scenario.impact.projectedPointsDelta.toFixed(1)} points</strong> · {scenario.impact.usableStartsDelta >= 0 ? '+' : ''}{scenario.impact.usableStartsDelta} usable starts
                      </p>
                      <p className="mt-1 text-[11px] text-warning">{scenario.materiality.reason}</p>
                      <p className="mt-2 text-[11px] text-ink-mute">Evidence: {discovery?.marketRank ? `${discovery.marketSource.toUpperCase()} rank ${discovery.marketRank.toFixed(1)}` : 'established NHL sample'} · participation and availability still require review</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => saveAutomaticCandidate(scenario.addition.id)}>Add target</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => saveAutomaticCandidate(scenario.addition.id, true)}>Confirm available</Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
          {targetScenarios.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">Targets to check</h3>
                <span className="text-xs text-ink-mute">Potential impact—not confirmed availability</span>
              </div>
              <div className="mt-2 space-y-2">
                {targetScenarios.slice(0, compact ? 2 : 3).map((scenario) => {
                  const expanded = expandedScenarioId === scenario.id;
                  return (
                    <article key={scenario.id} className="rounded-md border border-line bg-surface-2 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink"><strong>{scenario.addition.full_name}</strong>{scenario.drop ? <> · possible drop <span className="text-ink-dim">{scenario.drop.full_name}</span></> : <> · no drop required</>}</p>
                          <p className="mt-1 text-xs text-ink-dim">If available, this scenario changes the no-move baseline by <strong className={scenario.impact.projectedPointsDelta > 0 ? 'text-positive' : 'text-warning'}>{scenario.impact.projectedPointsDelta >= 0 ? '+' : ''}{scenario.impact.projectedPointsDelta.toFixed(1)} points</strong> and {scenario.impact.usableStartsDelta >= 0 ? '+' : ''}{scenario.impact.usableStartsDelta} usable starts.</p>
                          <p className="mt-1 text-[11px] text-warning">{scenario.materiality.reason}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setExpandedScenarioId(expanded ? null : scenario.id)}>{expanded ? 'Close' : 'Review scenario'}</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => refreshCandidate(scenario.addition.id)}>Available</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => markCandidateTaken(scenario.addition.id)}>Taken</Button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="mt-3 grid gap-2 border-t border-line pt-3 text-xs text-ink-dim sm:grid-cols-2">
                          <p><strong className="text-ink">Candidate use:</strong> {scenario.impact.candidateStarts}/{scenario.impact.candidateGames} games start · {scenario.impact.candidateBlockedDates.length} blocked</p>
                          <p><strong className="text-ink">Timing:</strong> effective {scenario.transaction.effectiveDate}{scenario.transaction.assumptions.length ? ` · ${scenario.transaction.assumptions.join(' ')}` : ''}</p>
                          <p><strong className="text-ink">Drop cost:</strong> {scenario.impact.dropCost.toFixed(1)} points across {scenario.impact.dropStarts} starts</p>
                          <p><strong className="text-ink">Longer-term check:</strong> {scenario.dropProtection.reason}</p>
                          <p className="sm:col-span-2"><strong className="text-ink">Participation:</strong> {scenario.participation.reason}</p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Recommended moves</h3>
            <span className="text-xs text-ink-mute">Distinct options among {currentCandidates.length} confirmed candidate{currentCandidates.length === 1 ? '' : 's'}</span>
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
          {!projectionLoading && currentCandidates.length > 0 && confirmedEvaluations.every((evaluation) => evaluation.status === 'no-legal-move') && <p className="mt-3 text-sm text-ink-dim">No legal move is available. Move limits, roster capacity, keepers, protected players, undroppable players, and inactive slots are respected.</p>}
          {!projectionLoading && currentCandidates.length > 0 && confirmedEvaluations.some((evaluation) => evaluation.status === 'ready') && confirmedLanes.length === 0 && <p className="mt-3 text-sm text-ink-dim">No confirmed move improves the no-move baseline in this window.</p>}
          {!projectionLoading && currentCandidates.length === 0 && candidates.length > 0 && <p className="mt-3 text-sm text-ink-dim">Confirm at least one target as available to rank actionable add/drop pairs.</p>}
          <div className="mt-2 space-y-2">
            {!projectionLoading && confirmedLanes.slice(0, compact ? 3 : 4).map((lane, index) => {
              const scenario = lane.scenario;
              const candidateMeta = candidateMetaById.get(scenario.addition.id.replace(/^nhl:/, ''));
              return (
                <article key={lane.id} className="rounded-md border border-line bg-surface-2 p-3">
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                    <span className="scoreboard-number text-sm text-ink-mute">#{index + 1}</span>
                    <div className="min-w-0">
                      <p className="scoreboard-text text-accent">{lane.title}</p>
                      <p className="mt-0.5 text-[11px] text-ink-dim">{lane.description}</p>
                      <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                        <strong>{scenario.addition.full_name}</strong>
                        {scenario.drop && <><ArrowRight size={14} className="text-accent" aria-hidden="true" /><span className="text-ink-dim">drop {scenario.drop.full_name}</span></>}
                        {!scenario.drop && <span className="text-positive">· no drop required</span>}
                      </p>
                      <p className="mt-1 text-xs text-ink-dim">
                        Starts {scenario.impact.candidateStarts}/{scenario.impact.candidateGames} candidate games
                        {' · '}{scenario.impact.usableStartsDelta >= 0 ? '+' : ''}{scenario.impact.usableStartsDelta} total lineup starts
                        {' · '}{scenario.impact.candidateBlockedDates.length} blocked by lineup competition
                      </p>
                    </div>
                    <span className="text-left sm:text-right">
                      <strong className="scoreboard-number block text-lg text-positive">+{scenario.impact.projectedPointsDelta.toFixed(1)}</strong>
                      <span className="text-xs text-ink-mute">lineup pts</span>
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 border-t border-line pt-2 text-xs text-ink-mute sm:grid-cols-2">
                    <span>{scenario.drop ? `Drop cost: ${scenario.impact.dropCost.toFixed(1)} pts across ${scenario.impact.dropStarts} start${scenario.impact.dropStarts === 1 ? '' : 's'}` : 'Open roster capacity: no drop cost'}</span>
                    <span className="sm:text-right">{candidateMeta ? `${sourceLabel(candidateMeta.availability)} · ${candidateMeta.observedAt ? new Date(candidateMeta.observedAt).toLocaleString() : 'time unknown'}` : 'Availability source unknown'}</span>
                  </div>
                  <p className={`mt-2 text-[11px] ${scenario.materiality.outcome === 'recommend' ? 'text-positive' : 'text-warning'}`}>{scenario.materiality.reason}</p>
                </article>
              );
            })}
          </div>
          {confirmedLanes.length > 0 && <p className="mt-3 text-xs text-ink-mute">Each lane shows a different decision, not repeated versions of one player. Projected impact re-solves each day against the no-move baseline.</p>}
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
