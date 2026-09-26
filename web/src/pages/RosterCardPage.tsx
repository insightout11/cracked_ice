import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, ClipboardList, Download, FlipHorizontal2, Link2, ListPlus, Pencil, RefreshCw, Share2, Shuffle, X } from 'lucide-react';
import { CARD_HEIGHT, CARD_WIDTH, ScaledRosterCard } from '../components/rosterCard/RosterCardView';
import { Footer } from '../components/Footer';
import { useLeagueWorkspace } from '../contexts/LeagueWorkspaceContext';
import { track } from '../lib/analytics';
import { loadInjuries } from '../lib/injuries';
import { buildRosterCard, buildWeekPreview, loadPlayerBio, matchRosterText, rosterCardText, withInjuryStatus, type BioPlayer, type RosterCard } from '../lib/rosterCard';
import { rosterTeamNames } from '../lib/rosterCardNames';
import { getCurrentWeekIso } from '../lib/schedule';
import { loadSeasonSchedule, type SeasonScheduleData } from '../lib/schedulePlanning';
import { renderFixedElementToPng, shareOrDownloadPng } from '../lib/shareImage';

const MIN_PLAYERS = 5;
/** How long to wait for the written roast before showing the card with our own copy. */
const ROAST_TIMEOUT_MS = 8000;
const WRITING_LINES = ['Reviewing the tape…', 'Checking the medical reports…', 'Consulting the intermission panel…', 'Sharpening the roast…'];

interface WrittenRoast { teamNames: string[]; title: string; roast: string }
const CARD_URL = 'https://www.crackedicehockey.com/card';
const SAMPLE_ROSTER = [
  'Sidney Crosby', 'Alex Ovechkin', 'Evgeni Malkin', 'Steven Stamkos', 'Brad Marchand', 'John Tavares', 'Patrick Kane',
  'Erik Karlsson', 'Drew Doughty', 'Kris Letang', 'Ryan O\'Reilly', 'Sergei Bobrovsky', 'Jonathan Quick', 'Mark Stone',
].join('\n');

type Source = 'paste' | 'saved' | 'sample';
type SaveState = 'saved-active' | 'same' | 'offer' | 'saved-new' | null;

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dayLabel(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

const bare = (id: string) => id.replace(/^nhl:/, '');

export function RosterCardPage() {
  const { activeLeague, updateLeague, createLeague } = useLeagueWorkspace();
  const [searchParams] = useSearchParams();
  const [bio, setBio] = useState<BioPlayer[] | null>(null);
  const [bioError, setBioError] = useState(false);
  const [text, setText] = useState('');
  const [players, setPlayers] = useState<BioPlayer[] | null>(null);
  const [source, setSource] = useState<Source>('sample');
  const [nameIndex, setNameIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<SeasonScheduleData | null>(null);
  const [cardVersion, setCardVersion] = useState(0);
  const [side, setSide] = useState<'front' | 'back'>('front');
  // Once a card is made, the paste box folds away to a one-line summary.
  const [editing, setEditing] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const today = useMemo(localToday, []);

  useEffect(() => {
    // Injuries matter to the card ("you drafted 3 players who are already hurt").
    Promise.all([loadPlayerBio(), loadInjuries()])
      .then(([players, injuries]) => setBio(withInjuryStatus(players, Object.fromEntries(Object.entries(injuries?.players ?? {}).map(([id, entry]) => [id, entry.status])))))
      .catch(() => setBioError(true));
    loadSeasonSchedule().then(setSchedule).catch(() => undefined);
  }, []);

  const savedIds = useMemo(() => activeLeague.roster.map((entry) => bare(entry.playerId)), [activeLeague.roster]);
  const savedPlayers = useMemo(() => (bio ? savedIds.map((id) => bio.find((player) => player.id === id)).filter((player): player is BioPlayer => Boolean(player)) : []), [bio, savedIds]);
  const samplePlayers = useMemo(() => (bio ? matchRosterText(SAMPLE_ROSTER, bio) : []), [bio]);
  const shown = players ?? samplePlayers;
  const card = useMemo(() => (shown.length && bio ? buildRosterCard(shown, today, 0, bio) : null), [bio, shown, today]);
  const rosterKey = players ? players.map((player) => player.id).sort().join(',') : '';
  const [level, setLevel] = useState<'friendly' | 'savage'>('friendly');
  const writtenKey = `${rosterKey}|${level}`;
  const [written, setWritten] = useState<{ key: string; roast: WrittenRoast } | null>(null);
  const [writing, setWriting] = useState(false);
  const writtenRoast = written && written.key === writtenKey ? written.roast : null;
  const names = useMemo(() => [...new Set([...(writtenRoast?.teamNames ?? []), ...rosterTeamNames(shown)])], [shown, writtenRoast]);
  const nameCount = names.length;
  const display = useMemo<RosterCard | null>(() => (card ? {
    ...card,
    teamName: names[nameIndex % names.length] ?? card.teamName,
    verdict: writtenRoast ? { ...card.verdict, title: writtenRoast.title, roast: writtenRoast.roast } : card.verdict,
  } : null), [card, nameIndex, names, writtenRoast]);

  // Ask for a written team name and roast; the card waits briefly for it, then falls back to our own copy.
  const roastRequest = useRef(0);
  useEffect(() => {
    if (!players || !card || source === 'sample' || written?.key === writtenKey) return undefined;
    const request = ++roastRequest.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ROAST_TIMEOUT_MS);
    setWriting(true);
    fetch('/api/roster-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: players.map((player) => player.id), level, verdict: { title: card.verdict.title, roast: card.verdict.roast }, highlights: card.highlights.map((highlight) => highlight.text) }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() as Promise<WrittenRoast> : null))
      .then((roast) => {
        const ok = Boolean(roast?.title && roast.roast);
        if (ok && request === roastRequest.current) setWritten({ key: writtenKey, roast: roast as WrittenRoast });
        track('roster_card_created', { source, players: players.length, verdict: card.verdict.key, writer: ok ? 'ai' : 'local', level });
      })
      .catch(() => track('roster_card_created', { source, players: players.length, verdict: card.verdict.key, writer: 'local', level }))
      .finally(() => {
        window.clearTimeout(timer);
        if (request !== roastRequest.current) return;
        setWriting(false);
        setCardVersion((version) => version + 1);
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [writtenKey, card]);
  const week = useMemo(() => (players && schedule ? buildWeekPreview(players, schedule.games, getCurrentWeekIso()) : null), [players, schedule]);

  const reveal = (next: BioPlayer[], nextSource: Source) => {
    setPlayers(next);
    setSource(nextSource);
    setNameIndex(0);
    setSaveState(null);
    setSide('front');
    setEditing(false);
    setCardVersion((version) => version + 1);
    setShareStatus(null);
    // Keep the card in view on phones, where it sits under the paste box.
    window.requestAnimationFrame(() => {
      if (window.innerWidth < 1024) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const readPaste = () => {
    if (!bio) return;
    const found = matchRosterText(text, bio);
    if (found.length < MIN_PLAYERS) {
      setMessage(found.length === 0
        ? "We couldn't find any NHL players in that. Paste your team page or a list of names, one per line."
        : `We found ${found.length} ${found.length === 1 ? 'player' : 'players'}. Paste at least ${MIN_PLAYERS} so there's something to roast.`);
      return;
    }
    setMessage(null);
    reveal(found, 'paste');
  };

  const readSaved = () => {
    if (savedPlayers.length < MIN_PLAYERS) return;
    setText(savedPlayers.map((player) => player.name).join('\n'));
    setMessage(null);
    reveal(savedPlayers, 'saved');
  };

  // /card?use=saved (from Home) opens straight onto the saved team's card.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || searchParams.get('use') !== 'saved' || savedPlayers.length < MIN_PLAYERS) return;
    autoOpened.current = true;
    readSaved();
  }, [savedPlayers, searchParams]);

  // A pasted roster becomes the user's team when they have none yet; otherwise offer a new league.
  useEffect(() => {
    if (!players || source === 'sample') { setSaveState(null); return; }
    if (source === 'saved') { setSaveState('same'); return; }
    const pasted = new Set(players.map((player) => player.id));
    if (savedIds.length === 0) {
      const now = new Date().toISOString();
      updateLeague({ ...activeLeague, roster: toRoster(players), updatedAt: now });
      setSaveState('saved-active');
      track('roster_card_saved', { destination: 'active' });
      return;
    }
    const same = savedIds.length === pasted.size && savedIds.every((id) => pasted.has(id));
    // A saved card stays saved while players are removed from it (removePlayer re-runs this).
    setSaveState((current) => (current === 'saved-new' || current === 'saved-active' ? current : same ? 'same' : 'offer'));
    // Runs per card and per removal; saving changes savedIds, which must not re-trigger a save.
  }, [players, source]);

  const saveAsNewLeague = () => {
    if (!players || !display) return;
    const league = createLeague();
    const now = new Date().toISOString();
    updateLeague({ ...league, name: display.teamName, roster: toRoster(players), updatedAt: now });
    setSaveState('saved-new');
    track('roster_card_saved', { destination: 'new-league' });
  };

  const removePlayer = (id: string) => {
    if (!players) return;
    const next = players.filter((player) => player.id !== id);
    if (next.length < MIN_PLAYERS) return;
    setPlayers(next);
    // Keep the team we just saved in step with the card.
    if (saveState === 'saved-active') updateLeague({ ...activeLeague, roster: toRoster(next), updatedAt: new Date().toISOString() });
  };

  const shareImage = async () => {
    if (!cardRef.current || !display) return;
    setShareStatus('Making your image…');
    try {
      const blob = await renderFixedElementToPng(cardRef.current, CARD_WIDTH, CARD_HEIGHT, 2);
      const filename = `${side === 'back' ? 'lineup-' : ''}${display.teamName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'roster'}-cracked-ice.png`;
      const result = await shareOrDownloadPng(blob, filename, { title: display.teamName, text: `${display.verdict.title}. What does your draft say about you? ${CARD_URL}` });
      track('roster_card_shared', { format: result, side });
      setShareStatus(result === 'shared' ? 'Shared' : 'Image downloaded');
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === 'AbortError' ? null : 'The image could not be made. Try again.');
    }
  };

  const copyText = async () => {
    if (!display) return;
    try {
      await navigator.clipboard.writeText(rosterCardText(display, CARD_URL));
      track('roster_card_shared', { format: 'text' });
      setShareStatus('Team copied. Paste it in your league chat.');
    } catch {
      setShareStatus('Copy failed. Try again.');
    }
  };

  const copyLink = async () => {
    if (!display) return;
    try {
      await navigator.clipboard.writeText(`My fantasy hockey team is "${display.verdict.title}". What does your draft say about you? ${CARD_URL}`);
      track('roster_card_shared', { format: 'link' });
      setShareStatus('Link copied, ready to paste in your league chat');
    } catch {
      setShareStatus('Copy failed. The link is crackedicehockey.com/card');
    }
  };

  return (
    <div className="min-h-screen">
      {/* ml-auto/mr-auto and max-w-[72rem]: the legacy mobile stylesheet forces 4px padding on .mx-auto and .max-w-6xl. */}
      <main className="ml-auto mr-auto grid max-w-[72rem] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_540px] lg:gap-12 lg:px-8 lg:py-12">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-extrabold leading-[1.02] text-ink sm:text-5xl">What does your draft say about you?</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-dim">Paste your roster. Get a team name, a verdict, and a few facts nobody asked for. It takes about a second, and there's nothing to sign up for.</p>

          {players && !editing ? (
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface-1 p-4 sm:p-5">
              <p className="text-sm text-ink-dim"><strong className="text-ink">{players.length} players</strong> read from your roster.</p>
              <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-accent"><Pencil size={15} aria-hidden="true" />Edit roster</button>
            </div>
          ) : (
          <div className="mt-7 rounded-2xl border border-line-strong bg-surface-1 p-4 sm:p-5">
            <label htmlFor="roster-paste" className="text-sm font-semibold text-ink">Your roster</label>
            <p id="roster-paste-help" className="mt-1 text-sm text-ink-mute">No typing needed. Open your team page on Yahoo, ESPN or Fantrax, select everything (Ctrl+A, or ⌘A on a Mac), copy, and paste it all here. Stats, menus and ads are fine: we only pick out the player names. A plain list of names works too.</p>
            <textarea
              id="roster-paste"
              aria-describedby="roster-paste-help"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              placeholder={'Connor McDavid\nCale Makar\nNikita Kucherov\n…'}
              className="mt-3 w-full resize-y rounded-lg border border-line bg-surface-0 p-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {message && <p className="mt-2 text-sm text-warning" role="alert">{message}</p>}
            {bioError && <p className="mt-2 text-sm text-negative" role="alert">The player list didn't load. Check your connection and reload the page.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={readPaste} disabled={!bio || !text.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-50">Read my team</button>
              {savedPlayers.length >= MIN_PLAYERS && <button type="button" onClick={readSaved} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-accent">Use my saved team ({savedPlayers.length})</button>}
            </div>
          </div>
          )}

          {players && (
            <section className="mt-6" aria-labelledby="found-heading">
              <h2 id="found-heading" className="text-sm font-semibold text-ink">We found {players.length} players</h2>
              <p className="mt-1 text-xs text-ink-mute">Tap a name to leave him out. Missing someone? Check the spelling and read the team again.</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {players.map((player) => (
                  <li key={player.id}>
                    <button type="button" onClick={() => removePlayer(player.id)} disabled={players.length <= MIN_PLAYERS} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line bg-surface-1 px-2.5 text-xs text-ink-dim hover:border-negative hover:text-ink disabled:hover:border-line" aria-label={`Leave out ${player.name}`}>
                      {player.name}<X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>

        <div ref={resultRef} className={`min-w-0 scroll-mt-20 ${players ? '' : 'lg:sticky lg:top-24 lg:self-start'}`}>
          {players && writing ? (
            <WritingCard />
          ) : display ? (
            <>
              {!players && <p className="mb-3 text-sm text-ink-mute">Example card. Paste your roster to get yours.</p>}
              {players && (
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-ink-dim">Roast level</span>
                  <div className="flex rounded-lg border border-line bg-surface-1 p-1" role="group" aria-label="Roast level">
                    {([['friendly', 'Friendly'], ['savage', 'Savage']] as const).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={level === value} disabled={writing} onClick={() => { setLevel(value); setNameIndex(0); }} className={`min-h-10 rounded-md px-4 text-sm font-semibold transition-colors ${level === value ? (value === 'savage' ? 'bg-negative text-surface-0' : 'bg-accent text-accent-ink') : 'text-ink-dim hover:text-ink'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <ScaledRosterCard card={display} cardRef={cardRef} animateKey={`${cardVersion}`} side={side} />
              {players && (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={shareImage} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink">{navigator.maxTouchPoints > 0 ? <Share2 size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}{navigator.maxTouchPoints > 0 ? 'Share this side' : 'Download this side'}</button>
                    <button type="button" onClick={() => setSide((current) => (current === 'front' ? 'back' : 'front'))} aria-pressed={side === 'back'} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-accent"><FlipHorizontal2 size={16} aria-hidden="true" />{side === 'front' ? 'Flip to the lineup' : 'Flip to the roast'}</button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <button type="button" onClick={copyText} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent hover:underline"><ClipboardList size={15} aria-hidden="true" />Copy as text</button>
                    <button type="button" onClick={copyLink} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent hover:underline"><Link2 size={15} aria-hidden="true" />Copy link</button>
                    {nameCount > 1 && <button type="button" onClick={() => setNameIndex((index) => index + 1)} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent hover:underline"><Shuffle size={15} aria-hidden="true" />Another name</button>}
                  </div>
                </>
              )}
              {shareStatus && <p className="mt-1 text-sm text-ink-dim" role="status">{shareStatus}</p>}
          {players && (
            <section className="mt-6 max-w-[540px] rounded-2xl border border-accent/40 bg-surface-1 p-5" aria-labelledby="next-heading">
              <h2 id="next-heading" className="font-display text-2xl font-bold text-ink">Now make the team win</h2>
              <p className="mt-1 text-sm text-ink-dim">Cracked Ice plans your lineups around the NHL schedule: which nights your players play, where your open spots are, and who to pick up.</p>
              <SaveNote state={saveState} leagueName={activeLeague.name} onSaveNew={saveAsNewLeague} />
              {week && <WeekStrip week={week} />}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/season?start=${week?.weekStart ?? ''}`} onClick={() => track('roster_card_next', { destination: 'season' })} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink"><CalendarDays size={16} aria-hidden="true" />See your open nights</Link>
                <Link to="/team#pickup-board" onClick={() => track('roster_card_next', { destination: 'team' })} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-accent"><ListPlus size={16} aria-hidden="true" />Find pickups for this week</Link>
              </div>
            </section>
          )}

            </>
          ) : (
            <div className="flex aspect-[4/5] w-full max-w-[540px] items-center justify-center rounded-[30px] border border-line bg-surface-1 text-sm text-ink-mute">
              {bioError ? 'Cards are unavailable right now.' : <span className="inline-flex items-center gap-2"><RefreshCw size={16} className="animate-spin" aria-hidden="true" />Loading players…</span>}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** Shown while the roast is being written: a card-shaped placeholder that cycles through a few lines. */
function WritingCard() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setLine((value) => (value + 1) % WRITING_LINES.length), 1400);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="roster-card-foil w-full max-w-[540px] rounded-[30px] p-[4px]" role="status">
      <div className="roster-card-face flex aspect-[4/5] flex-col items-center justify-center gap-4 rounded-[26px] text-center">
        <RefreshCw size={28} className="animate-spin text-accent" aria-hidden="true" />
        <p className="font-display text-xl font-bold text-ink">{WRITING_LINES[line]}</p>
      </div>
    </div>
  );
}

function toRoster(players: BioPlayer[]) {
  return players.map((player) => ({
    playerId: `nhl:${player.id}`,
    fullName: player.name,
    team: player.team,
    positions: player.pos,
    keeper: false,
    protected: false,
    undroppable: false,
  }));
}

function SaveNote({ state, leagueName, onSaveNew }: { state: SaveState; leagueName: string; onSaveNew: () => void }) {
  if (state === 'saved-active') return <p className="mt-2 flex items-start gap-2 text-sm text-ink-dim"><Check size={16} className="mt-0.5 shrink-0 text-positive" aria-hidden="true" />Saved as your team on this device. Your schedule, lineups and pickups are now built around it.</p>;
  if (state === 'saved-new') return <p className="mt-2 flex items-start gap-2 text-sm text-ink-dim"><Check size={16} className="mt-0.5 shrink-0 text-positive" aria-hidden="true" />Saved as a new league. Switch leagues any time from the league menu.</p>;
  if (state === 'same') return <p className="mt-2 text-sm text-ink-dim">This is your saved team in {leagueName}. Here's how its week looks.</p>;
  if (state === 'offer') return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-dim">
      <span>You already have a team saved in {leagueName}; we left it alone.</span>
      <button type="button" onClick={onSaveNew} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-accent px-3 text-sm font-semibold text-accent hover:bg-accent-muted">Save this one as a new league</button>
    </div>
  );
  return null;
}

function WeekStrip({ week }: { week: ReturnType<typeof buildWeekPreview> }) {
  const packed = week.packedNights.filter((day) => day.yourPlayers > 0);
  const stream = week.bestStreamNight;
  return (
    <div className="mt-4">
      <p className="text-sm text-ink">
        Week of {dayLabel(week.weekStart, { month: 'short', day: 'numeric' })}: your players have <strong>{week.yourGames} games</strong>.
        {packed.length > 0 && <> {packed.map((day) => dayLabel(day.date, { weekday: 'long' })).join(' and ')} {packed.length === 1 ? 'is a packed night' : 'are packed nights'}, when lineups jam up.</>}
        {stream && <> {dayLabel(stream.date, { weekday: 'long' })} is light, and only {stream.yourPlayers} of yours {stream.yourPlayers === 1 ? 'plays' : 'play'}: a good night to stream someone in.</>}
      </p>
      <p className="mt-3 text-xs text-ink-mute">Big number: your players in action that night. Blue nights are light, red nights are packed.</p>
      <ol className="mt-2 grid grid-cols-7 gap-1.5" aria-label="Your players' games each night this week">
        {week.days.map((day) => {
          const tone = day.nhlGames >= 13 ? 'border-negative/50 bg-negative-muted ice-cracks' : day.nhlGames > 0 && day.nhlGames <= 8 ? 'border-accent/40 bg-accent-muted' : 'border-line bg-surface-0';
          return (
            <li key={day.date} className={`rounded-lg border p-1.5 text-center ${tone}`}>
              <span className="block text-[10px] text-ink-mute">{dayLabel(day.date, { weekday: 'short' })}</span>
              <strong className="scoreboard-number block text-lg leading-tight text-ink">{day.yourPlayers}</strong>
              <span className="block text-[10px] text-ink-mute">{day.nhlGames} {day.nhlGames === 1 ? 'game' : 'games'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
