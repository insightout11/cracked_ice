import { useMemo, useState, type ChangeEvent } from 'react';
import { CheckCircle2, ClipboardPaste, ExternalLink, ImagePlus, RefreshCw, Users, X } from 'lucide-react';
import type { PlayerSearchResult } from '../../types';
import { recordScreenshotAvailability, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { applyDraftResults, draftResultGaps, draftResultTeams, matchDraftResults, parseYahooDraftResults, type DraftResultMatch, type DraftResultRow } from '../../lib/draftResultsImport';
import { applyTransactions, mirrorOnRoster, parseYahooTransactions, type TransactionReplay } from '../../lib/transactionsImport';
import { applyYahooSettings, parseYahooSettings, type YahooLeagueSettings } from '../../lib/settingsImport';
import { SEASON_END } from '../../lib/season';
import { applyStartingRosters, guessMyStartingRosterTeam, matchStartingRosters, parseYahooStartingRosters, yahooLeagueIdFrom, yahooStartingRostersUrl, type StartingRosterMatch, type StartingRosterPlayer, type StartingRosterTeam } from '../../lib/startingRostersImport';
import { matchScreenshotPlayers, MAX_SCREENSHOTS, parseYahooPlayersPaste, readYahooScreenshots, ScreenshotReadError, type ScreenshotMatch, type ScreenshotPlayer } from '../../lib/screenshotImport';

function ago(timestamp: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const localToday = () => new Date().toLocaleDateString('en-CA');

const READ_ERRORS: Record<string, string> = {
  rate_limited: 'Too many reads in a few minutes. Try again shortly.',
  reader_unavailable: 'The screenshot reader is unavailable right now. Try again in a minute.',
  invalid_request: 'Those images could not be sent. Try up to four regular screenshots.',
};

/** Last time availability came from screenshots: the newest screenshot-confirmed candidate. */
export function lastScreenshotRefresh(workspace: LeagueWorkspace): string | null {
  const times = workspace.candidates
    .filter((candidate) => candidate.availability === 'screenshot-confirmed' && candidate.observedAt)
    .map((candidate) => candidate.observedAt as string)
    .sort();
  return times.length ? times[times.length - 1] : null;
}

/**
 * "Update from Yahoo": the manager copies Yahoo's available-players list (computer) or
 * screenshots it (phone, where Yahoo's app won't let you copy). Every player read is
 * marked available, with his waiver date if he's on waivers, and the planner suggests
 * from real availability. Nothing here touches Yahoo.
 */
export function ScreenshotRefresh({ workspace, players, defaultOpen = false }: { workspace: LeagueWorkspace; players: PlayerSearchResult[]; /** Start with the paste box open (first-time setup). */ defaultOpen?: boolean }) {
  const { updateLeague } = useLeagueWorkspace();
  const [open, setOpen] = useState(defaultOpen);
  // One paste box reads whichever Yahoo page was copied; 'rosters', 'draft' and
  // 'transactions' are the review steps it lands on. Screenshots cover the players list on phones.
  const [method, setMethod] = useState<'paste' | 'screenshots' | 'rosters' | 'settings' | 'draft' | 'transactions'>('paste');
  const [settings, setSettings] = useState<YahooLeagueSettings | null>(null);
  const [pasted, setPasted] = useState('');
  const [state, setState] = useState<'idle' | 'reading' | 'review' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<ScreenshotMatch[]>([]);
  const [unmatched, setUnmatched] = useState<ScreenshotPlayer[]>([]);
  const [draftRows, setDraftRows] = useState<DraftResultRow[]>([]);
  const [draftMatches, setDraftMatches] = useState<{ matched: DraftResultMatch[]; unmatched: DraftResultRow[] }>({ matched: [], unmatched: [] });
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const draftTeams = useMemo(() => draftResultTeams(draftRows), [draftRows]);
  const draftGaps = useMemo(() => draftResultGaps(draftRows), [draftRows]);
  const rosteredCount = workspace.leagueRosters?.teams.reduce((sum, team) => sum + team.playerIds.length, 0) ?? 0;
  const [replay, setReplay] = useState<(TransactionReplay & { entries: number }) | null>(null);
  const [mirror, setMirror] = useState(true);
  const [rosterTeams, setRosterTeams] = useState<StartingRosterTeam[]>([]);
  const [rosterMatches, setRosterMatches] = useState<{ matched: StartingRosterMatch[]; unmatched: StartingRosterPlayer[] }>({ matched: [], unmatched: [] });
  const [updateMyRoster, setUpdateMyRoster] = useState(true);
  const [leagueLink, setLeagueLink] = useState('');
  const leagueId = workspace.providerLeagueId ?? null;
  // With league rosters, availability is everyone not on a team; the players-list screenshots are only for leagues without them.
  const methods = rosteredCount ? ([['paste', 'Copy & paste']] as const) : ([['paste', 'Copy & paste'], ['screenshots', 'Screenshots']] as const);
  const activeTab = method === 'screenshots' ? 'screenshots' : 'paste';

  const summary = useMemo(() => {
    const free = matched.filter((match) => match.read.status === 'FA').length;
    const waiverDates = [...new Set(matched.filter((match) => match.read.status === 'W' && match.read.waiverDate).map((match) => match.read.waiverDate as string))].sort();
    const waivers = matched.filter((match) => match.read.status === 'W').length;
    return { free, waivers, waiverDates };
  }, [matched]);

  const review = (rows: ScreenshotPlayer[]) => {
    const match = matchScreenshotPlayers(players, rows);
    setMatched(match.matched);
    setUnmatched(match.unmatched);
    setState('review');
  };

  /** Reads whichever Yahoo page was pasted: Starting Rosters, Draft Results, Transactions or Players. */
  const readPaste = (text = pasted) => {
    setError(null);
    const leagueSettings = parseYahooSettings(text, Number(SEASON_END.slice(0, 4)));
    if (leagueSettings) {
      setSettings(leagueSettings);
      setMethod('settings');
      setState('review');
      return;
    }
    const teams = parseYahooStartingRosters(text);
    if (!players.length) {
      setError("The player list is still loading. Paste again in a moment.");
      return;
    }
    if (teams.length) {
      setRosterTeams(teams);
      setRosterMatches(matchStartingRosters(players, teams));
      setMyTeam(guessMyStartingRosterTeam(workspace, teams));
      setMethod('rosters');
      setState('review');
      return;
    }
    if (parseYahooDraftResults(text).length) { readDraft(text); return; }
    if (workspace.leagueRosters?.teams.length && parseYahooTransactions(text, localToday()).length) { readTransactions(text); return; }
    const rows = parseYahooPlayersPaste(text, localToday());
    if (!rows.length) {
      setError("That doesn't look like a Yahoo page we can read. Open your league's Starting Rosters on Yahoo, select everything (Ctrl+A, or Cmd+A on a Mac), copy, and paste it here.");
      return;
    }
    review(rows);
  };

  const pasteFromClipboard = async () => {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setError('Your clipboard is empty. Copy the Yahoo page first.'); return; }
      setPasted(text);
      readPaste(text);
    } catch {
      setError("Your browser didn't let us read the clipboard. Paste into the box below instead (Ctrl+V, or Cmd+V on a Mac, or press and hold on a phone).");
    }
  };

  const saveLeagueLink = () => {
    const id = yahooLeagueIdFrom(leagueLink);
    if (!id) { setError("That isn't a Yahoo hockey league link. Open your league on Yahoo and copy the address; it looks like hockey.fantasysports.yahoo.com/hockey/12345."); return; }
    setError(null);
    updateLeague({ ...workspace, providerLeagueId: id, updatedAt: new Date().toISOString() });
    setLeagueLink('');
  };

  const applyRosters = () => {
    if (!myTeam) return;
    updateLeague(applyStartingRosters(workspace, rosterMatches.matched, rosterTeams, myTeam, new Date().toISOString(), updateMyRoster));
    setState('saved');
  };

  const readDraft = (text = pasted) => {
    setError(null);
    const rows = parseYahooDraftResults(text);
    if (!rows.length) return;
    setMethod('draft');
    setDraftRows(rows);
    setDraftMatches(matchDraftResults(players, rows));
    setMyTeam(null);
    setState('review');
  };

  const applyDraft = () => {
    if (!myTeam) return;
    updateLeague(applyDraftResults(workspace, draftMatches.matched, myTeam, draftTeams.length, new Date().toISOString()));
    setState('saved');
  };

  const readTransactions = (text = pasted) => {
    setError(null);
    const entries = parseYahooTransactions(text, localToday());
    if (!entries.length) return;
    setMethod('transactions');
    setReplay({ ...applyTransactions(workspace, players, entries, new Date().toISOString()), entries: entries.length });
    setState('review');
  };

  const applyReplay = () => {
    if (!replay) return;
    const next = replay.workspace;
    updateLeague(mirror && (replay.mine.added.length || replay.mine.dropped.length) ? { ...next, roster: mirrorOnRoster(next.roster, replay.mine) } : next);
    setState('saved');
  };

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])].slice(0, MAX_SCREENSHOTS);
    event.target.value = '';
    if (!files.length) return;
    setError(null);
    setState('reading');
    try {
      const result = await readYahooScreenshots(files, localToday());
      if (!result.isPlayerList) {
        setState('idle');
        setError("That doesn't look like Yahoo's player list. Screenshot Players → All Available Players.");
        return;
      }
      review(result.players);
    } catch (caught) {
      setState('idle');
      setError(READ_ERRORS[caught instanceof ScreenshotReadError ? caught.code : ''] ?? 'The screenshots could not be read. Try again, or try fewer at once.');
    }
  };

  const apply = () => {
    const now = new Date().toISOString();
    updateLeague({
      ...workspace,
      candidates: recordScreenshotAvailability(workspace.candidates, matched.map(({ player, read: row }) => ({
        playerId: player.id,
        team: player.team,
        position: player.pos[0],
        waiverUntil: row.status === 'W' ? row.waiverDate : null,
      })), now),
      freshness: { ...workspace.freshness, importedAt: now },
      updatedAt: now,
    });
    setState('saved');
  };

  const close = () => { setOpen(false); setMethod('paste'); setState('idle'); setError(null); };
  const startOver = () => { setMethod((current) => (current === 'screenshots' ? current : 'paste')); setState('idle'); setPasted(''); setError(null); };

  // Rosters change every day; after a few days suggestions may offer players who are taken.
  const stale = !workspace.leagueRosters?.teams.length || Date.now() - new Date(workspace.leagueRosters.updatedAt).getTime() > 3 * 86_400_000;

  return (
    <div id="league-rosters" className={`scroll-mt-20 rounded-md border bg-surface-2 p-3 ${stale ? 'border-warning/60' : 'border-line'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-ink">
          <Users size={15} className={stale ? 'text-warning' : 'text-accent'} aria-hidden="true" />
          {rosteredCount && workspace.leagueRosters ? <span>League rosters · <span className={stale ? 'text-warning' : 'text-ink-dim'}>{rosteredCount} players taken, updated {ago(workspace.leagueRosters.updatedAt)}</span></span> : <span>Add your league's rosters <span className="text-ink-dim">so suggestions only show players nobody has. It takes 30 seconds.</span></span>}
        </p>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="keep-flex inline-flex min-h-9 items-center gap-1.5 rounded-md border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent-muted">
            <RefreshCw size={13} aria-hidden="true" />{rosteredCount ? 'Update' : 'Update from Yahoo'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-0 p-1" role="group" aria-label="How to update">
              {methods.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={activeTab === value} onClick={() => { setMethod(value); setError(null); setPasted(''); if (state !== 'reading') setState('idle'); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${activeTab === value ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={close} className="rounded p-1 text-ink-mute hover:text-ink" aria-label="Close availability update"><X size={15} /></button>
          </div>
          {method === 'paste' && state === 'idle' && (
            <>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-ink-dim">
                <li>
                  {leagueId
                    ? <a href={yahooStartingRostersUrl(leagueId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-2 hover:underline">Open your league's Starting Rosters on Yahoo<ExternalLink size={12} aria-hidden="true" /></a>
                    : <>On Yahoo Fantasy, open your league's <strong className="text-ink">Starting Rosters</strong> page.</>}
                </li>
                <li>Select everything on the page (Ctrl+A, or Cmd+A on a Mac) and copy it.</li>
                <li>Come back and paste. Every team's roster updates at once, yours included.</li>
                <li>New league? Paste its <strong className="text-ink">Settings</strong> page the same way, once: scoring, lineup spots, add limits and playoffs are set for you.{leagueId && <> <a href={`https://hockey.fantasysports.yahoo.com/hockey/${encodeURIComponent(leagueId)}/settings`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-2 hover:underline">Open Settings on Yahoo</a></>}</li>
              </ol>
              {!leagueId && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input value={leagueLink} onChange={(event) => setLeagueLink(event.target.value)} placeholder="Your Yahoo league link (optional)" aria-label="Your Yahoo league link" className="min-h-9 min-w-0 flex-1 rounded-md border border-line bg-surface-0 px-3 text-xs text-ink outline-none placeholder:text-ink-mute focus:border-accent" />
                  <button type="button" onClick={saveLeagueLink} disabled={!leagueLink.trim()} className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs font-semibold text-ink hover:border-accent disabled:opacity-50">Save link</button>
                  <p className="w-full text-[11px] text-ink-mute">Save it once and this becomes a one-tap link to the right page.</p>
                </div>
              )}
            </>
          )}
          {method === 'screenshots' && (state === 'idle' || state === 'reading') && (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-ink-dim">
            <li>On Yahoo Fantasy, open <strong className="text-ink">Players</strong>, set it to <strong className="text-ink">All Available Players</strong>, sorted by rank.</li>
            <li>Take 2 to {MAX_SCREENSHOTS} screenshots as you scroll down the list, and add them here.</li>
            <li>Every player found is marked available, with his waiver date if he's on waivers.</li>
          </ol>
          )}

          {method === 'draft' && state === 'review' && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-ink">Found <strong>{draftRows.length}</strong> picks across <strong>{draftTeams.length}</strong> teams. Which team is yours?</p>
              {draftGaps.missingRounds.length > 0 && (
                <p className="text-xs text-warning" role="alert">
                  {draftGaps.missingRounds.length === 1 ? `Round ${draftGaps.missingRounds[0]} is` : `Rounds ${draftGaps.missingRounds.join(', ')} are`} missing from what was pasted, so those players wouldn't count as taken. Select the whole Draft Results page (Ctrl+A or Cmd+A), copy, and paste again.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Your team">
                {draftTeams.map((team) => (
                  <button key={team.name} type="button" aria-pressed={myTeam === team.name} onClick={() => setMyTeam(team.name)} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${myTeam === team.name ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink hover:border-accent'}`}>{team.name}</button>
                ))}
              </div>
              {draftMatches.unmatched.length > 0 && <p className="text-xs text-ink-mute">Couldn't match: {draftMatches.unmatched.map((row) => row.name).join(', ')}.</p>}
              {draftTeams.length !== workspace.numberOfTeams && <p className="text-xs text-ink-dim">Your league is set to {workspace.numberOfTeams} teams; this changes it to {draftTeams.length}.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={applyDraft} disabled={!myTeam || !draftMatches.matched.length} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
                  <CheckCircle2 size={15} aria-hidden="true" />{myTeam ? `Mark ${draftMatches.matched.length} players taken` : 'Pick your team first'}
                </button>
                <button type="button" onClick={startOver} className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-accent">Start over</button>
              </div>
            </div>
          )}


          {method === 'transactions' && state === 'review' && replay && (
            <div className="mt-3 space-y-2 text-sm">
              {replay.unknownTeams.length > 0 && (
                <p className="text-xs text-warning" role="alert">
                  {replay.applied === 0 ? "None of these teams are in your league" : 'Some teams aren\'t in your league'}: {replay.unknownTeams.join(', ')}. {replay.applied === 0 ? 'Is this the right league\'s Transactions page?' : 'Their moves are skipped.'}
                </p>
              )}
              {replay.applied > 0 && <p className="text-ink">Found <strong>{replay.applied}</strong> add{replay.applied === 1 ? '' : 's'} and drops across {replay.entries} transaction{replay.entries === 1 ? '' : 's'}.</p>}
              {(replay.mine.added.length > 0 || replay.mine.dropped.length > 0) && (
                <label className="flex items-start gap-2 text-xs text-ink">
                  <input type="checkbox" checked={mirror} onChange={(event) => setMirror(event.target.checked)} className="mt-0.5" />
                  <span>Also update My Team{replay.mine.added.length ? `: add ${replay.mine.added.map((player) => player.name).join(', ')} to the bench` : ''}{replay.mine.dropped.length ? `${replay.mine.added.length ? ';' : ':'} drop ${replay.mine.dropped.map((player) => player.name).join(', ')}` : ''}.</span>
                </label>
              )}
              {replay.unreadable.length > 0 && <p className="text-xs text-ink-mute">Skipped {replay.unreadable.length} move{replay.unreadable.length === 1 ? '' : 's'} we can't read yet (trades): {replay.unreadable.map((move) => move.name).join(', ')}.</p>}
              {replay.unmatched.length > 0 && <p className="text-xs text-ink-mute">Couldn't match: {replay.unmatched.join(', ')}.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={applyReplay} disabled={!replay.applied} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
                  <CheckCircle2 size={15} aria-hidden="true" />Update rosters
                </button>
                <button type="button" onClick={startOver} className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-accent">Start over</button>
              </div>
            </div>
          )}

          {method === 'transactions' && state === 'saved' && (
            <p className="mt-3 flex items-center gap-2 text-sm text-positive"><CheckCircle2 size={15} aria-hidden="true" />Rosters updated. Suggestions, your matchup and trade ideas now use them.</p>
          )}

          {method === 'draft' && state === 'saved' && (
            <p className="mt-3 flex items-center gap-2 text-sm text-positive"><CheckCircle2 size={15} aria-hidden="true" />Saved. Suggestions now skip everyone drafted or kept in your league.</p>
          )}

          {method === 'paste' && state === 'idle' && (
            <div className="mt-3 space-y-2">
              <button type="button" onClick={pasteFromClipboard} className="keep-flex inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink sm:w-auto"><ClipboardPaste size={15} aria-hidden="true" />Paste from clipboard</button>
              <textarea value={pasted} onChange={(event) => setPasted(event.target.value)} onPaste={(event) => { const text = event.clipboardData.getData('text'); if (text.trim()) { event.preventDefault(); setPasted(text); readPaste(text); } }} rows={3} placeholder="…or paste the Yahoo page here" aria-label="Pasted Yahoo page" className="w-full rounded-md border border-line bg-surface-0 px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-mute focus:border-accent" />
              {pasted.trim() && <button type="button" onClick={() => readPaste()} className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-accent">Read it</button>}
            </div>
          )}

          {method === 'rosters' && state === 'review' && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-ink">Found <strong>{rosterMatches.matched.length + rosterMatches.unmatched.length}</strong> players on <strong>{rosterTeams.length}</strong> teams. {myTeam ? <>Yours: <strong>{myTeam}</strong>.</> : 'Which team is yours?'}</p>
              {(!myTeam || !guessMyStartingRosterTeam(workspace, rosterTeams)) && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Your team">
                  {rosterTeams.map((team) => (
                    <button key={team.name} type="button" aria-pressed={myTeam === team.name} onClick={() => setMyTeam(team.name)} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${myTeam === team.name ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink hover:border-accent'}`}>{team.name}</button>
                  ))}
                </div>
              )}
              {myTeam && (
                <label className="flex items-start gap-2 text-xs text-ink">
                  <input type="checkbox" checked={updateMyRoster} onChange={(event) => setUpdateMyRoster(event.target.checked)} className="mt-0.5" />
                  <span>Also set My Team to your Yahoo lineup ({rosterMatches.matched.filter((match) => match.fantasyTeam === myTeam).length} players, bench and IR included).</span>
                </label>
              )}
              {rosterMatches.unmatched.length > 0 && <p className="text-xs text-ink-mute">Couldn't match: {rosterMatches.unmatched.map((row) => row.name).join(', ')}.</p>}
              {rosterTeams.length !== workspace.numberOfTeams && <p className="text-xs text-ink-dim">Your league is set to {workspace.numberOfTeams} teams; this changes it to {rosterTeams.length}.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={applyRosters} disabled={!myTeam || !rosterMatches.matched.length} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
                  <CheckCircle2 size={15} aria-hidden="true" />{myTeam ? 'Update rosters' : 'Pick your team first'}
                </button>
                <button type="button" onClick={startOver} className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-accent">Start over</button>
              </div>
            </div>
          )}

          {method === 'settings' && state === 'review' && settings && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-ink">Found the settings for <strong>{settings.leagueName ?? 'your league'}</strong>{settings.scoringType ? <> · {settings.scoringType}</> : null}.</p>
              {!settings.points && <p className="text-xs text-warning" role="alert">This is a categories league. Cracked Ice works in points, so suggestions won't match how your league scores yet.</p>}
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-dim">
                {Object.keys(settings.slots).length > 0 && <li>Lineup: {Object.entries(settings.slots).map(([slot, count]) => `${slot}${count > 1 ? ` ×${count}` : ''}`).join(', ')}</li>}
                {(settings.addsPerWeek !== null || settings.addsPerSeason !== null) && <li>Adds: {settings.addsPerWeek !== null ? `${settings.addsPerWeek} a week` : `${settings.addsPerSeason} a season`}{settings.addsPerWeek !== null && settings.addsPerSeason !== null ? ` (${settings.addsPerSeason} a season isn't tracked yet)` : ''}</li>}
                {settings.waiverDays !== null && <li>Waivers: {settings.waiverDays} day{settings.waiverDays === 1 ? '' : 's'}</li>}
                {settings.lockingMode && <li>Lineups: {settings.lockingMode === 'daily' ? 'set daily' : 'locked weekly'}</li>}
                {settings.playoffs && <li>Playoffs: {settings.playoffs.start} to {settings.playoffs.end}</li>}
                {Object.keys(settings.skater).length + Object.keys(settings.goalie).length > 0 && <li>Scoring: {Object.keys(settings.skater).length} skater and {Object.keys(settings.goalie).length} goalie stats</li>}
              </ul>
              {settings.unsupported.length > 0 && <p className="text-xs text-ink-mute">Not counted (no per-game data): {settings.unsupported.join(', ')}.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { updateLeague(applyYahooSettings(workspace, settings, new Date().toISOString())); setState('saved'); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink">
                  <CheckCircle2 size={15} aria-hidden="true" />Use these settings
                </button>
                <button type="button" onClick={startOver} className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-accent">Start over</button>
              </div>
            </div>
          )}

          {method === 'settings' && state === 'saved' && (
            <p className="mt-3 flex items-center gap-2 text-sm text-positive"><CheckCircle2 size={15} aria-hidden="true" />League set up. Points, lineups, adds and playoffs now follow your Yahoo settings.{!workspace.leagueRosters?.teams.length && ' Paste your Starting Rosters next.'}</p>
          )}

          {method === 'rosters' && state === 'saved' && (
            <p className="mt-3 flex items-center gap-2 text-sm text-positive"><CheckCircle2 size={15} aria-hidden="true" />Rosters updated. Suggestions, your matchup and trade ideas now use them. Paste again whenever your league changes.</p>
          )}

          {method === 'screenshots' && (state === 'idle' || state === 'reading') && (
            <label className={`mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink ${state === 'reading' ? 'pointer-events-none opacity-70' : ''}`}>
              {state === 'reading' ? <><RefreshCw size={15} className="animate-spin" aria-hidden="true" />Reading your screenshots…</> : <><ImagePlus size={15} aria-hidden="true" />Add screenshots</>}
              <input type="file" accept="image/*" multiple onChange={read} disabled={state === 'reading'} className="sr-only" />
            </label>
          )}
          {error && <p className="mt-2 text-xs text-warning" role="alert">{error}</p>}

          {(method === 'paste' || method === 'screenshots') && state === 'review' && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-ink">
                Found <strong>{matched.length}</strong> available player{matched.length === 1 ? '' : 's'}
                {summary.waivers > 0 && <>: {summary.waivers} on waivers{summary.waiverDates.length === 1 ? ` until ${shortDate(summary.waiverDates[0])}` : ''}</>}
                {summary.free > 0 && <>{summary.waivers > 0 ? ', ' : ': '}{summary.free} free agent{summary.free === 1 ? '' : 's'}</>}.
              </p>
              {unmatched.length > 0 && <p className="text-xs text-ink-mute">Couldn't match: {unmatched.map((row) => row.name).join(', ')}.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={apply} disabled={!matched.length} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
                  <CheckCircle2 size={15} aria-hidden="true" />Mark {matched.length} available
                </button>
                <button type="button" onClick={startOver} className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-accent">Start over</button>
              </div>
            </div>
          )}

          {(method === 'paste' || method === 'screenshots') && state === 'saved' && (
            <p className="mt-3 flex items-center gap-2 text-sm text-positive"><CheckCircle2 size={15} aria-hidden="true" />Updated. Suggestions now use these players; waiver players count from the day they clear.</p>
          )}

          <p className="mt-3 text-[11px] text-ink-mute">{method !== 'screenshots' ? 'Pasted text is read in your browser and not sent anywhere.' : "Screenshots are read once by Claude (Anthropic) to find the player names and aren't saved. Crop out anything you'd rather not share."}</p>
        </div>
      )}
    </div>
  );
}
