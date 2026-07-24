import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, CalendarDays, ClipboardPaste, ExternalLink, Grid3X3, Link2, ListOrdered, Plus, Search, Share2, ShieldCheck, X } from 'lucide-react';
import type { PairingResult, Team } from '../../types';
import { apiService } from '../../services/api';
import { getTeamLogoUrl } from '../../utils/teamLogos';
import { inferDailySlots, rankPlayerMatches, type DraftPlayer, type DraftPlayerDirectoryMeta } from '../../lib/playerSearch';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import { SEASON_LABEL } from '../../lib/season';
import { loadDraftHelperState, persistDraftHelperState } from '../../lib/draftHelperStorage';
import { buildDraftHelperPermalink, parseDraftHelperPermalink } from '../../lib/draftHelperPermalink';
import { track } from '../../lib/analytics';
import { renderElementToPng, shareOrDownloadPng } from '../../lib/shareImage';
import { useTimeWindow } from '../../contexts/TimeWindowContext';
import { Card } from '../Card';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { IceDropdown, type DropdownOption } from '../IceDropdown';
import { TimeWindow } from '../TimeWindow';
import { PlayoffModeToggle } from '../TimeWindow/PlayoffModeToggle';
import { ScheduleInterleaveStrip } from './ScheduleInterleaveStrip';
import { PairingShareFrame } from './PairingShareFrame';
import { ComplementMatrix } from './ComplementMatrix';
import { BulkImportPanel } from '../players/BulkImportPanel';
import { countRosterPositions, getPositionLineupSlots, ROSTER_POSITIONS, type RosterPosition } from '../../lib/rosterImport';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { toLeagueProfile } from '../../lib/leagueWorkspace';
import { DRAFT_STRATEGY_PRESETS } from '../../lib/leagueWorkspace';
import { loadSeasonSchedule, type SeasonScheduleData } from '../../lib/schedulePlanning';
import { rankDraftCandidates } from '../../lib/draftStrategy';
import { DraftStrategyControl } from '../comparison/DraftStrategyControl';
import { DraftTargetList } from './DraftTargetList';

interface DraftHelperProps {
  teams: Team[];
}

function formatPlayerProduction(player: DraftPlayer): string {
  if (player.productionValue === null) return '—';
  const value = player.productionLabel === 'SV%'
    ? player.productionValue.toFixed(3).replace(/^0/, '')
    : player.productionValue.toFixed(2);
  return `${value} ${player.productionLabel}`;
}

function draftPlayerAsRoster(player: DraftPlayer): RosterPlayer {
  return { id: player.id, full_name: player.name, team: player.team, positions: player.pos, current_slot: 'BN', games_played: 0, blendedFppg: player.blendedFppg, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 } };
}

export function DraftHelper({ teams }: DraftHelperProps) {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const workspaceLeagueProfile = useMemo(() => toLeagueProfile(activeLeague), [activeLeague]);
  const permalinkState = useMemo(() => parseDraftHelperPermalink(window.location.search), []);
  const storedState = useMemo(() => loadDraftHelperState(localStorage), []);
  const storedPlayers = storedState.players;
  const storedTeams = storedState.lockedTeams;
  const [inputMode, setInputMode] = useState<'players' | 'teams'>(permalinkState?.inputMode ?? (storedPlayers.length ? 'players' : storedTeams.length ? 'teams' : 'players'));
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [directoryMeta, setDirectoryMeta] = useState<DraftPlayerDirectoryMeta | null>(null);
  const [seasonSchedule, setSeasonSchedule] = useState<SeasonScheduleData | null>(null);
  const [configuredLeagueProfile, setConfiguredLeagueProfile] = useState<LeagueProfile | null>(workspaceLeagueProfile);
  const [anchorPlayers, setAnchorPlayers] = useState<DraftPlayer[]>(permalinkState?.inputMode === 'players' ? [] : storedPlayers);
  const [importedRoster, setImportedRoster] = useState<DraftPlayer[]>([]);
  const [rosterPosition, setRosterPosition] = useState<RosterPosition | null>(null);
  const [showRosterImport, setShowRosterImport] = useState(false);
  const [stackedTeams, setStackedTeams] = useState<string[]>(permalinkState?.inputMode === 'players' ? permalinkState.stackedTeams : storedTeams);
  const [teamAnchors, setTeamAnchors] = useState<string[]>(() => {
    if (permalinkState?.inputMode === 'teams') {
      return permalinkState.teamAnchors.filter((code) => teams.some((team) => team.abbreviation === code));
    }
    const seedId = storedState.seedTeamId ?? 24;
    const seed = teams.find((team) => team.id === seedId)?.abbreviation ?? teams[0]?.abbreviation;
    return seed ? [seed, ...storedTeams.filter((team) => team !== seed)] : storedTeams;
  });
  const [teamSelection, setTeamSelection] = useState(teams[0]?.abbreviation ?? '');
  const [query, setQuery] = useState('');
  const [slots, setSlots] = useState<number>(() => permalinkState?.slots ?? storedState.slots ?? inferDailySlots(storedPlayers));
  const [customSlots, setCustomSlots] = useState(permalinkState?.customSlots ?? storedState.customSlots);
  const [permalinkPlayersResolved, setPermalinkPlayersResolved] = useState(
    permalinkState?.inputMode !== 'players' || permalinkState.playerIds.length === 0
  );
  const [showAll, setShowAll] = useState(storedState.showAll);
  const [resultView, setResultView] = useState<'ranked' | 'matrix'>('ranked');
  const [results, setResults] = useState<PairingResult[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [anchorsGamesByDate, setAnchorsGamesByDate] = useState<Record<string, string[]>>({});
  const [baselineStarts, setBaselineStarts] = useState(0);
  const [pairingMode, setPairingMode] = useState<'pair-building' | 'added-starts'>('pair-building');
  const [responseSlots, setResponseSlots] = useState(slots);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const shareFrameRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);
  const preferredResult = useRef(permalinkState?.selectedTeam ?? null);
  const timeWindow = useTimeWindow();

  const activeAnchors = useMemo(() => inputMode === 'players'
    ? [...anchorPlayers.map((player) => player.team), ...stackedTeams]
    : teamAnchors, [anchorPlayers, inputMode, stackedTeams, teamAnchors]);
  const matches = useMemo(() => rankPlayerMatches(players, query), [players, query]);
  const rosterPositionCounts = useMemo(() => countRosterPositions(importedRoster), [importedRoster]);
  const keeperEntries = useMemo(() => activeLeague.roster.filter((entry) => entry.keeper), [activeLeague.roster]);
  const keeperPlayers = useMemo(() => {
    const keeperIds = new Set(keeperEntries.map((entry) => entry.playerId.replace(/^nhl:/, '')));
    return players.filter((player) => keeperIds.has(player.id.replace(/^nhl:/, '')));
  }, [keeperEntries, players]);
  const keeperRoster = useMemo(() => keeperPlayers.map(draftPlayerAsRoster), [keeperPlayers]);
  const remainingKeeperNeeds = useMemo(() => {
    const reserved = new Set(['BN', 'IR', 'IR+']);
    return Object.entries(activeLeague.rosterRules.slots)
      .filter(([position]) => !reserved.has(position))
      .map(([position, count]) => ({
        position,
        count: Math.max(0, count - keeperEntries.filter((entry) => entry.slot === position || (!entry.slot && entry.positions.includes(position))).length),
      }))
      .filter((need) => need.count > 0);
  }, [activeLeague.rosterRules.slots, keeperEntries]);
  const selected = results.find((result) => result.team === selectedTeam) ?? results[0] ?? null;
  const isTopResult = selected?.team === results[0]?.team;
  const anchorPositions = useMemo(() => importedRoster.length > 0 && rosterPosition
    ? [rosterPosition]
    : [...new Set(anchorPlayers.flatMap((player) => player.pos))], [anchorPlayers, importedRoster.length, rosterPosition]);
  const positionalAverages = directoryMeta?.positionalAverages ?? {};
  const averageFppg = anchorPositions.length
    ? anchorPositions.reduce((sum, position) => sum + (positionalAverages[position]?.avgFppg ?? 0), 0) / anchorPositions.length
    : (positionalAverages[slots === 4 ? 'D' : 'C']?.avgFppg ?? 0);
  const averageSampleSize = anchorPositions.length === 1
    ? positionalAverages[anchorPositions[0]]?.sampleSize ?? 0
    : positionalAverages[slots === 4 ? 'D' : 'C']?.sampleSize ?? 0;
  const targetCandidates = useMemo(() => selected
    ? players.filter((player) => player.team === selected.team && (!anchorPositions.length || player.pos.some((position) => anchorPositions.includes(position))))
    : [], [anchorPositions, players, selected]);
  const rankedTargets = useMemo(() => seasonSchedule
    ? rankDraftCandidates(targetCandidates, players, keeperRoster, activeLeague, seasonSchedule)
    : [], [activeLeague, keeperRoster, players, seasonSchedule, targetCandidates]);
  const strategyLabel = activeLeague.draftStrategy.presetId === 'custom'
    ? 'Custom strategy'
    : DRAFT_STRATEGY_PRESETS[activeLeague.draftStrategy.presetId].label;
  const maxRankingValue = Math.max(1, ...results.map((result) => pairingMode === 'pair-building' ? result.separateNights : result.addedStarts));
  const scoringLabel = directoryMeta?.scoringLabel ?? 'Default scoring';
  const updatedLabel = directoryMeta?.updatedAt
    ? new Date(directoryMeta.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'unknown';

  useEffect(() => {
    let cancelled = false;
    const loadPlayers = async () => {
      try {
        const directory = await apiService.getDraftPlayers(workspaceLeagueProfile);
        if (!cancelled) {
          setConfiguredLeagueProfile(workspaceLeagueProfile);
          setPlayers(directory.players);
          setDirectoryMeta(directory.meta);
          if (permalinkState?.inputMode === 'players') {
            setAnchorPlayers(permalinkState.playerIds
              .map((id) => directory.players.find((player) => player.id === id))
              .filter((player): player is DraftPlayer => Boolean(player)));
            setPermalinkPlayersResolved(true);
          }
        }
      } catch {
        if (!cancelled) {
          setPermalinkPlayersResolved(true);
          setError('Player search is temporarily unavailable. The Teams tab still works.');
        }
      }
    };
    void loadPlayers();
    return () => { cancelled = true; };
  }, [permalinkState, workspaceLeagueProfile]);

  useEffect(() => {
    let cancelled = false;
    loadSeasonSchedule().then((schedule) => { if (!cancelled) setSeasonSchedule(schedule); }).catch(() => { if (!cancelled) setError('The season schedule could not be loaded.'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    persistDraftHelperState(localStorage, { players: anchorPlayers, lockedTeams: stackedTeams, showAll, slots, customSlots });
  }, [anchorPlayers, customSlots, showAll, slots, stackedTeams]);

  useEffect(() => {
    if (!customSlots && inputMode === 'players') {
      setSlots(importedRoster.length > 0 && rosterPosition
        ? getPositionLineupSlots(rosterPosition, configuredLeagueProfile)
        : inferDailySlots(anchorPlayers));
    }
  }, [anchorPlayers, configuredLeagueProfile, customSlots, importedRoster.length, inputMode, rosterPosition]);

  useEffect(() => {
    if (importedRoster.length === 0) return;

    const nextPosition = rosterPosition && rosterPositionCounts[rosterPosition] > 0
      ? rosterPosition
      : ROSTER_POSITIONS.find((position) => rosterPositionCounts[position] > 0) ?? null;
    if (nextPosition !== rosterPosition) setRosterPosition(nextPosition);
    setAnchorPlayers(nextPosition
      ? importedRoster.filter((player) => player.pos.includes(nextPosition))
      : []);
  }, [importedRoster, rosterPosition, rosterPositionCounts]);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    if (!permalinkPlayersResolved) return;
    if (!activeAnchors.length) {
      setResults([]);
      setSelectedTeam(null);
      return;
    }
    const start = timeWindow.state.config.startUtc.slice(0, 10);
    const end = timeWindow.state.config.endUtc.slice(0, 10);
    setLoading(true);
    setError(null);
    // One team in classic Teams mode represents a filled lineup slot, preserving
    // the old complement result while still using the unified pairings endpoint.
    const effectiveSlots = inputMode === 'teams' && activeAnchors.length === 1 ? 1 : slots;
    apiService.getPairings({ anchors: activeAnchors, start, end, slots: effectiveSlots })
      .then((response) => {
        if (requestSequence.current !== requestId) return;
        setResults(response.results);
        setAnchorsGamesByDate(response.anchorsGamesByDate);
        setBaselineStarts(response.baseline.usableStarts);
        setPairingMode(response.mode);
        setResponseSlots(response.slotsPerDay);
        const linkedResult = preferredResult.current;
        setSelectedTeam(linkedResult && response.results.some((result) => result.team === linkedResult)
          ? linkedResult
          : response.results[0]?.team ?? null);
        preferredResult.current = null;
        track('complement_run', { mode: inputMode === 'players' ? 'roster-aware' : 'complement', anchors: activeAnchors.length });
      })
      .catch((requestError) => {
        if (requestSequence.current === requestId) {
          setError(requestError?.response?.data?.message ?? 'Could not calculate pairings. Try another window.');
        }
      })
      .finally(() => {
        if (requestSequence.current === requestId) setLoading(false);
      });
  }, [activeAnchors, inputMode, permalinkPlayersResolved, slots, timeWindow.state.config.startUtc, timeWindow.state.config.endUtc]);

  const addPlayer = (player: DraftPlayer) => {
    if (importedRoster.length > 0) {
      if (!importedRoster.some((rosterPlayer) => rosterPlayer.id === player.id)) {
        setImportedRoster((current) => [...current, player]);
      }
    } else if (!anchorPlayers.some((anchor) => anchor.id === player.id)) {
      setAnchorPlayers((current) => [...current, player]);
    }
    setQuery('');
  };
  const importRosterPlayers = (playerIds: string[]) => {
    const additions = playerIds
      .map((id) => players.find((player) => player.id === id))
      .filter((player): player is DraftPlayer => Boolean(player));
    const merged = [...importedRoster, ...additions.filter((player) => !importedRoster.some((current) => current.id === player.id))];
    const counts = countRosterPositions(merged);
    const nextPosition = rosterPosition && counts[rosterPosition] > 0
      ? rosterPosition
      : ROSTER_POSITIONS.find((position) => counts[position] > 0) ?? null;
    setImportedRoster(merged);
    setRosterPosition(nextPosition);
    setInputMode('players');
    setResultView('ranked');
  };
  const useKeeperRoster = () => {
    if (keeperPlayers.length === 0) return;
    const counts = countRosterPositions(keeperPlayers);
    const nextPosition = ROSTER_POSITIONS.find((position) => counts[position] > 0) ?? null;
    setImportedRoster(keeperPlayers);
    setRosterPosition(nextPosition);
    setInputMode('players');
    setResultView('ranked');
    setShowRosterImport(false);
  };
  const removeRosterPlayer = (playerId: string) => {
    setImportedRoster((current) => current.filter((player) => player.id !== playerId));
    setAnchorPlayers((current) => current.filter((player) => player.id !== playerId));
  };
  const clearImportedRoster = () => {
    setImportedRoster([]);
    setRosterPosition(null);
    setAnchorPlayers([]);
  };
  const addTeamAnchor = () => {
    if (teamSelection && !teamAnchors.includes(teamSelection)) setTeamAnchors((current) => [...current, teamSelection]);
  };
  const addToStack = (team: string) => {
    const isAlreadyAnchored = inputMode === 'players' ? stackedTeams.includes(team) : teamAnchors.includes(team);
    if (isAlreadyAnchored) return;
    if (inputMode === 'players') setStackedTeams((current) => [...current, team]);
    else setTeamAnchors((current) => [...current, team]);
    track('team_locked', { team });
  };

  const openMatrixPair = (anchorTeam: string, candidateTeam: string) => {
    preferredResult.current = candidateTeam;
    setInputMode('teams');
    setTeamAnchors([anchorTeam]);
    setResultView('ranked');
  };

  const handleShareImage = async () => {
    if (!shareFrameRef.current || !selected) return;
    setShareStatus('Preparing image…');
    try {
      const blob = await renderElementToPng(shareFrameRef.current);
      const action = await shareOrDownloadPng(blob, `cracked-ice-${activeAnchors.join('-')}-${selected.team}.png`);
      track('pairing_shared', { format: 'png' });
      setShareStatus(action === 'shared' ? 'Shared' : 'PNG downloaded');
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') {
        setShareStatus(null);
      } else {
        setShareStatus('Could not create the image. Try again.');
      }
    }
  };

  const handleCopyLink = async () => {
    if (!selected) return;
    const url = buildDraftHelperPermalink(window.location.href, {
      inputMode,
      playerIds: anchorPlayers.map((player) => player.id),
      stackedTeams,
      teamAnchors,
      slots,
      customSlots,
      selectedTeam: selected.team,
    }, timeWindow.state);
    try {
      await navigator.clipboard.writeText(url);
      track('pairing_shared', { format: 'url' });
      setShareStatus('Link copied');
    } catch {
      setShareStatus('Could not copy the link.');
    }
  };

  const teamOptions: DropdownOption[] = teams.map((team) => ({ value: team.abbreviation, label: `${team.name} (${team.abbreviation})` }));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="scoreboard-text mb-2 text-accent">SCHEDULE FIT OPTIMIZER</p>
            <h1 className="font-display text-2xl font-bold uppercase tracking-[0.05em] sm:text-3xl">Find your best schedule fit</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-dim">Choose a player already on your roster—or one you may add. We’ll rank the NHL schedules that create the most usable starts over your selected dates.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <Button asChild variant="ghost" size="sm">
              <Link to="/compare?mode=draft"><ArrowLeftRight size={15} />Compare players</Link>
            </Button>
            <div className="inline-flex rounded-lg border border-line bg-surface-0 p-1">
              {(['players', 'teams'] as const).map((mode) => (
                <button key={mode} onClick={() => setInputMode(mode)} className={`rounded-md px-4 py-2 text-sm font-semibold ${inputMode === mode ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}>
                  {mode === 'players' ? 'Players' : 'Teams'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DraftStrategyControl value={activeLeague.draftStrategy} onChange={(draftStrategy) => updateLeague({ ...activeLeague, draftStrategy, updatedAt: new Date().toISOString() })} />

        {inputMode === 'players' ? (
          <div className="relative mt-5 max-w-2xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="scoreboard-text block">PLAYER SEARCH</label>
              <div className="flex flex-wrap justify-end gap-2">
                {keeperPlayers.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={useKeeperRoster}>
                    <ShieldCheck size={15} />Use {keeperPlayers.length} keeper{keeperPlayers.length === 1 ? '' : 's'}
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowRosterImport((value) => !value)} aria-expanded={showRosterImport}>
                  <ClipboardPaste size={15} />{showRosterImport ? 'Close paste' : 'Paste roster'}
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search McDavid, Makar, Shesterkin…" className="w-full rounded-lg border border-line bg-surface-0 py-3 pl-10 pr-4 text-ink outline-none focus:border-accent" />
            </div>
            {matches.length > 0 && (
              <div className="mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-line bg-surface-0 p-2 shadow-ice-lg">
                {matches.map((player) => (
                  <button key={player.id} onClick={() => addPlayer(player)} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-2">
                    <img src={getTeamLogoUrl(player.team)} alt="" className="h-8 w-8 object-contain" />
                    <span className="min-w-0 flex-1"><strong className="block truncate text-ink">{player.name}</strong><span className="text-xs text-ink-dim">{player.pos.join('/')} · {player.team}</span></span>
                    <span className="font-mono text-xs text-accent">{formatPlayerProduction(player)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex max-w-2xl items-end gap-2">
            <div className="min-w-0 flex-1"><label className="scoreboard-text mb-2 block">TEAM</label><IceDropdown options={teamOptions} value={teamSelection} onChange={(value) => setTeamSelection(String(value))} aria-label="Select anchor team" /></div>
            <Button onClick={addTeamAnchor}><Plus size={16} /> Add anchor</Button>
          </div>
        )}

        {inputMode === 'players' && showRosterImport && (
          <Card className="mt-4 max-w-4xl p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="scoreboard-text text-accent">NO-LOGIN ROSTER ANALYSIS</p>
                <p className="mt-1 text-sm text-ink-dim">Paste once, review uncertain names, then compare schedule fit by position group. This stays in the current optimizer session.</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <a href="/team"><ExternalLink size={15} />Open My Team</a>
              </Button>
            </div>
            <BulkImportPanel
              allPlayers={players}
              onImport={importRosterPlayers}
              mode="roster"
              embedded
              existingPlayerIds={importedRoster.map((player) => player.id)}
            />
          </Card>
        )}

        {inputMode === 'players' && importedRoster.length > 0 && (
          <div className="mt-4 max-w-4xl rounded-lg border border-line bg-surface-0/60 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{importedRoster.length} roster anchors</p>
                <p className="text-xs text-ink-mute">Choose a position to compare players competing for the same daily lineup slots.</p>
                {keeperPlayers.length > 0 && importedRoster.every((player) => keeperPlayers.some((keeper) => keeper.id === player.id)) && (
                  <p className="mt-1 text-xs text-positive">Keeper foundation · Remaining slots: {remainingKeeperNeeds.map((need) => `${need.position} ×${need.count}`).join(' · ') || 'none'}</p>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={clearImportedRoster}>Clear imported roster</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Imported roster position group">
              {ROSTER_POSITIONS.map((position) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => setRosterPosition(position)}
                  disabled={rosterPositionCounts[position] === 0}
                  aria-pressed={rosterPosition === position}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${rosterPosition === position ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-1 text-ink-dim hover:border-line-strong hover:text-ink'}`}
                >
                  {position} · {rosterPositionCounts[position]}
                </button>
              ))}
            </div>
            {rosterPosition && (
              <p className="mt-3 text-xs text-ink-dim">
                Analyzing {rosterPositionCounts[rosterPosition]} {rosterPosition} player{rosterPositionCounts[rosterPosition] === 1 ? '' : 's'} across {getPositionLineupSlots(rosterPosition, configuredLeagueProfile)} configured daily slot{getPositionLineupSlots(rosterPosition, configuredLeagueProfile) === 1 ? '' : 's'}.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {inputMode === 'players' && anchorPlayers.map((player) => (
            <span key={player.id} className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-ink">
              <img src={getTeamLogoUrl(player.team)} alt="" className="h-5 w-5 object-contain" />{player.name} · {player.pos.join('/')} · {player.team}
              <button aria-label={`Remove ${player.name}`} onClick={() => importedRoster.length > 0 ? removeRosterPlayer(player.id) : setAnchorPlayers((current) => current.filter((anchor) => anchor.id !== player.id))}><X size={14} /></button>
            </span>
          ))}
          {(inputMode === 'players' ? stackedTeams : teamAnchors).map((team) => (
            <span key={team} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
              <img src={getTeamLogoUrl(team)} alt="" className="h-5 w-5 object-contain" />{team}
              <button aria-label={`Remove ${team}`} onClick={() => inputMode === 'players' ? setStackedTeams((current) => current.filter((item) => item !== team)) : setTeamAnchors((current) => current.filter((item) => item !== team))}><X size={14} /></button>
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-4 border-t border-line pt-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <TimeWindow value={timeWindow.state} onPresetChange={timeWindow.setPreset} onCustomRangeChange={timeWindow.setCustomRange} onModeChange={timeWindow.setMode} onPlayoffPresetChange={timeWindow.setPlayoffPreset} onLeagueWeeksChange={timeWindow.setLeagueWeeks} showModeToggle={false} />
          <PlayoffModeToggle mode={timeWindow.state.mode} onChange={timeWindow.setMode} />
          <div><button onClick={() => setCustomSlots((value) => !value)} className="text-xs text-accent hover:underline">Adjust slots</button>{customSlots && <input aria-label="Daily lineup slots" type="number" min="1" max="10" value={slots} onChange={(event) => setSlots(Math.min(10, Math.max(1, Number(event.target.value))))} className="ml-2 w-16 rounded border border-line bg-surface-0 px-2 py-1 text-ink" />}</div>
        </div>
      </Card>

      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-line bg-surface-0 p-1" aria-label="Optimizer result view">
          <button type="button" onClick={() => setResultView('ranked')} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${resultView === 'ranked' ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}><ListOrdered size={16} /> Ranked analysis</button>
          <button type="button" onClick={() => setResultView('matrix')} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${resultView === 'matrix' ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}><Grid3X3 size={16} /> Matrix</button>
        </div>
      </div>

      {resultView === 'matrix' && (
        <ComplementMatrix
          start={timeWindow.state.config.startUtc.slice(0, 10)}
          end={timeWindow.state.config.endUtc.slice(0, 10)}
          windowLabel={timeWindow.state.config.displayLabel ?? 'Selected window'}
          onSelectPair={openMatrixPair}
        />
      )}

      {resultView === 'ranked' && error && <EmptyState title="Pairing unavailable" description={error} />}
      {resultView === 'ranked' && loading && <Card className="p-10 text-center text-ink-dim">Calculating every team against your anchors…</Card>}
      {resultView === 'ranked' && !loading && !error && activeAnchors.length === 0 && <EmptyState icon={<Search size={22} />} title="Search for your first anchor" description="Choose a player to reveal the best schedule pairing." />}

      {resultView === 'ranked' && !loading && selected && (
        <Card className="overflow-hidden border-accent/40">
          <div className="bg-gradient-to-r from-accent/15 via-surface-1 to-surface-1 p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-center gap-4"><img src={getTeamLogoUrl(selected.team)} alt={selected.teamName} className="h-16 w-16 shrink-0 object-contain" /><div className="min-w-0"><p className="scoreboard-text text-accent">{isTopResult ? (pairingMode === 'pair-building' ? 'BEST SCHEDULE PARTNER' : 'BEST NEXT ADD') : 'SELECTED OPTION'}</p><h2 className="break-words font-display text-2xl font-bold uppercase tracking-[0.05em] sm:text-3xl">{isTopResult ? (pairingMode === 'pair-building' ? `Best schedule partner for ${[...new Set(activeAnchors)].join(' + ')}: ${selected.team}` : `Best next add for ${[...new Set(activeAnchors)].join(' + ')}: ${selected.team}`) : `Schedule fit for ${[...new Set(activeAnchors)].join(' + ')}: ${selected.team}`}</h2><p className="mt-1 text-sm text-ink-dim">{selected.teamName}</p></div></div>
              <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" onClick={handleCopyLink}><Link2 size={16} /> Copy link</Button><Button variant="ghost" onClick={handleShareImage}><Share2 size={16} /> Share image</Button><Button onClick={() => addToStack(selected.team)}><Plus size={16} /> Add to stack</Button>{shareStatus && <span aria-live="polite" className="w-full text-right text-xs text-ink-mute">{shareStatus}</span>}</div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
              <div className="rounded-lg border border-accent/30 bg-surface-0/70 p-3"><strong className="block font-mono text-2xl text-accent sm:text-4xl">{pairingMode === 'pair-building' ? selected.separateNights : `+${selected.addedStarts}`}</strong><span className="text-xs text-ink-dim">{pairingMode === 'pair-building' ? 'separate game nights' : 'usable starts'}</span></div>
              <div className="rounded-lg border border-line bg-surface-0/70 p-3"><strong className="block font-mono text-2xl text-ink sm:text-4xl">{pairingMode === 'pair-building' ? selected.sharedNights : averageFppg > 0 ? `~+${Math.round(selected.addedStarts * averageFppg)}` : '—'}</strong><span className="text-xs text-ink-dim">{pairingMode === 'pair-building' ? 'shared / full nights' : 'fantasy pts'}</span></div>
              <div className="rounded-lg border border-line bg-surface-0/70 p-3"><strong className="block font-mono text-2xl text-positive sm:text-4xl">{pairingMode === 'pair-building' ? `${Math.round(selected.offNightShare * 100)}%` : selected.blockedGames}</strong><span className="text-xs text-ink-dim">{pairingMode === 'pair-building' ? 'off-nights' : 'blocked games'}</span></div>
            </div>
            {pairingMode === 'pair-building' ? (
              <p className="mt-3 text-sm text-ink-dim">{[...new Set(activeAnchors)].join(' + ')} and {selected.team} share {selected.sharedNights} game nights. The other {selected.separateNights} {selected.team} games preserve room for a future player at the same position.</p>
            ) : (
              <p className="mt-3 text-sm text-ink-dim">{selected.addedStarts} playable games × {averageFppg.toFixed(2)} {scoringLabel} {anchorPositions[0] ?? (slots === 4 ? 'D' : 'C')} FPPG ({directoryMeta?.statsSeason ?? 'prior-season'} player pool{averageSampleSize ? `, n=${averageSampleSize}` : ''}) = ~{Math.round(selected.addedStarts * averageFppg)} points. Baseline: {baselineStarts} usable starts.</p>
            )}
            <DraftTargetList candidates={rankedTargets} strategyLabel={strategyLabel} compareFromId={anchorPlayers[0]?.id} />
          </div>
          <p className="px-5 pt-4 text-xs text-ink-mute sm:px-6">{SEASON_LABEL} schedule · {directoryMeta?.statsSeason ?? 'Stats season unknown'} stats · {directoryMeta?.scoringKind === 'league-profile' ? scoringLabel : 'Default scoring fallback'} · player data updated {updatedLabel}</p>
          <div className="p-4 sm:p-6"><ScheduleInterleaveStrip anchorTeams={activeAnchors} anchorsGamesByDate={anchorsGamesByDate} candidateTeam={selected.team} candidateGamesByDate={selected.gamesByDate} slots={responseSlots} start={timeWindow.state.config.startUtc.slice(0, 10)} end={timeWindow.state.config.endUtc.slice(0, 10)} /></div>
        </Card>
      )}

      {resultView === 'ranked' && results.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h3 className="brand-title text-lg">Other strong pairings</h3><p className="text-xs text-ink-mute">{pairingMode === 'pair-building' ? 'Ranked by fewest shared nights, then separate nights and off-night share' : 'Ranked by added starts, then off-night share and blocked games'}</p></div><Button variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Top 10' : `Show all ${results.length}`}</Button></div>
          <div className="divide-y divide-line">
            {(showAll ? results : results.slice(0, 10)).map((result, index) => (
              <button key={result.team} onClick={() => setSelectedTeam(result.team)} className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 sm:grid-cols-[2rem_1fr_8rem_7rem_8rem] ${selected?.team === result.team ? 'bg-accent/10' : ''}`}>
                <span className="font-mono text-xs text-ink-mute">{index + 1}</span>
                <span className="flex min-w-0 items-center gap-3"><img src={getTeamLogoUrl(result.team)} alt="" className="h-8 w-8 object-contain" /><span><strong className="block text-ink">{result.team}</strong><span className="hidden text-xs text-ink-mute sm:block">{players.filter((player) => player.team === result.team && (!anchorPositions.length || player.pos.some((position) => anchorPositions.includes(position)))).slice(0, 2).map((player) => player.name).join(', ')}</span></span></span>
                <span className="font-mono text-xl font-bold text-accent sm:text-2xl">{pairingMode === 'pair-building' ? result.separateNights : `+${result.addedStarts}`}</span>
                <span className="hidden text-sm text-ink-dim sm:block">{pairingMode === 'pair-building' ? `${result.sharedNights} shared` : `${result.blockedGames} blocked`}</span>
                <span className="hidden sm:block"><span className="block h-1.5 overflow-hidden rounded-full bg-surface-0"><span className="block h-full rounded-full bg-accent" style={{ width: `${((pairingMode === 'pair-building' ? result.separateNights : result.addedStarts) / maxRankingValue) * 100}%` }} /></span></span>
              </button>
            ))}
          </div>
        </Card>
      )}
      <p className="flex items-center justify-center gap-2 text-xs text-ink-mute"><CalendarDays size={14} /> {timeWindow.state.config.displayLabel}</p>
      {resultView === 'ranked' && selected && (
        <div className="fixed left-[-10000px] top-0" aria-hidden="true">
          <PairingShareFrame ref={shareFrameRef} anchorTeams={activeAnchors} anchorsGamesByDate={anchorsGamesByDate} result={selected} projectedPoints={Math.round(selected.addedStarts * averageFppg)} mode={pairingMode} isTopResult={isTopResult} slots={responseSlots} scoringLabel={scoringLabel} start={timeWindow.state.config.startUtc.slice(0, 10)} end={timeWindow.state.config.endUtc.slice(0, 10)} />
        </div>
      )}
    </div>
  );
}
