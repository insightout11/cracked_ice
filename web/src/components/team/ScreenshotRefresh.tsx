import { useMemo, useState, type ChangeEvent } from 'react';
import { Camera, CheckCircle2, ClipboardPaste, ImagePlus, RefreshCw, X } from 'lucide-react';
import type { PlayerSearchResult } from '../../types';
import { recordScreenshotAvailability, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
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
export function ScreenshotRefresh({ workspace, players }: { workspace: LeagueWorkspace; players: PlayerSearchResult[] }) {
  const { updateLeague } = useLeagueWorkspace();
  const [open, setOpen] = useState(false);
  // Phones screenshot; computers copy and paste.
  const [method, setMethod] = useState<'paste' | 'screenshots'>(() => (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 ? 'screenshots' : 'paste'));
  const [pasted, setPasted] = useState('');
  const [state, setState] = useState<'idle' | 'reading' | 'review' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<ScreenshotMatch[]>([]);
  const [unmatched, setUnmatched] = useState<ScreenshotPlayer[]>([]);
  const last = lastScreenshotRefresh(workspace);

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

  const readPaste = () => {
    setError(null);
    const rows = parseYahooPlayersPaste(pasted, localToday());
    if (!rows.length) {
      setError("No players found in that text. On Yahoo's Players page, select everything (Ctrl+A or Cmd+A), copy, and paste it here.");
      return;
    }
    review(rows);
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

  const close = () => { setOpen(false); setState('idle'); setError(null); };

  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-ink">
          <Camera size={15} className="text-accent" aria-hidden="true" />
          {last ? <span>Availability from Yahoo · <span className="text-ink-dim">updated {ago(last)}</span></span> : <span>Availability not checked yet. <span className="text-ink-dim">Suggestions are estimates.</span></span>}
        </p>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent-muted">
            <RefreshCw size={13} aria-hidden="true" />{last ? 'Update' : 'Update from Yahoo'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-1 rounded-lg border border-line bg-surface-0 p-1" role="group" aria-label="How to update">
              {([['paste', 'Paste (computer)'], ['screenshots', 'Screenshots (phone)']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={method === value} onClick={() => { setMethod(value); setError(null); if (state !== 'reading') setState('idle'); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${method === value ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={close} className="rounded p-1 text-ink-mute hover:text-ink" aria-label="Close availability update"><X size={15} /></button>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-ink-dim">
            <li>On Yahoo Fantasy, open <strong className="text-ink">Players</strong>, set it to <strong className="text-ink">All Available Players</strong>, sorted by rank.</li>
            {method === 'paste'
              ? <li>Select everything on the page (Ctrl+A, or Cmd+A on a Mac), copy, and paste it below. For more than 25 players, paste the next page too.</li>
              : <li>Take 2 to {MAX_SCREENSHOTS} screenshots as you scroll down the list, and add them here.</li>}
            <li>Every player found is marked available, with his waiver date if he's on waivers.</li>
          </ol>

          {method === 'paste' && state === 'idle' && (
            <div className="mt-3 space-y-2">
              <textarea value={pasted} onChange={(event) => setPasted(event.target.value)} rows={4} placeholder="Paste Yahoo's Players page here" aria-label="Pasted Yahoo player list" className="w-full rounded-md border border-line bg-surface-0 px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-mute focus:border-accent" />
              <button type="button" onClick={readPaste} disabled={!pasted.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50"><ClipboardPaste size={15} aria-hidden="true" />Read the list</button>
            </div>
          )}

          {method === 'screenshots' && (state === 'idle' || state === 'reading') && (
            <label className={`mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink ${state === 'reading' ? 'pointer-events-none opacity-70' : ''}`}>
              {state === 'reading' ? <><RefreshCw size={15} className="animate-spin" aria-hidden="true" />Reading your screenshots…</> : <><ImagePlus size={15} aria-hidden="true" />Add screenshots</>}
              <input type="file" accept="image/*" multiple onChange={read} disabled={state === 'reading'} className="sr-only" />
            </label>
          )}
          {error && <p className="mt-2 text-xs text-warning" role="alert">{error}</p>}

          {state === 'review' && (
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
                <button type="button" onClick={() => { setState('idle'); setPasted(''); }} className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-accent">Start over</button>
              </div>
            </div>
          )}

          {state === 'saved' && (
            <p className="mt-3 flex items-center gap-2 text-sm text-positive"><CheckCircle2 size={15} aria-hidden="true" />Updated. Suggestions now use these players; waiver players count from the day they clear.</p>
          )}

          <p className="mt-3 text-[11px] text-ink-mute">{method === 'paste' ? 'Pasted text is read in your browser and not sent anywhere.' : "Screenshots are read once by Claude (Anthropic) to find the player names and aren't saved. Crop out anything you'd rather not share."}</p>
        </div>
      )}
    </div>
  );
}
