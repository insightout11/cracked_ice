import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, Download, Link2, ListPlus, RefreshCw, Share2, Shuffle, X } from 'lucide-react';
import { CARD_HEIGHT, CARD_WIDTH, ScaledRosterCard } from '../components/rosterCard/RosterCardView';
import { Footer } from '../components/Footer';
import { useLeagueWorkspace } from '../contexts/LeagueWorkspaceContext';
import { track } from '../lib/analytics';
import { buildRosterCard, buildWeekPreview, loadPlayerBio, matchRosterText, type BioPlayer } from '../lib/rosterCard';
import { rosterTeamNames } from '../lib/rosterCardNames';
import { getCurrentWeekIso } from '../lib/schedule';
import { loadSeasonSchedule, type SeasonScheduleData } from '../lib/schedulePlanning';
import { renderFixedElementToPng, shareOrDownloadPng } from '../lib/shareImage';

const MIN_PLAYERS = 5;
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
  const cardRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const today = useMemo(localToday, []);

  useEffect(() => {
    loadPlayerBio().then(setBio).catch(() => setBioError(true));
    loadSeasonSchedule().then(setSchedule).catch(() => undefined);
  }, []);

  const savedIds = useMemo(() => activeLeague.roster.map((entry) => bare(entry.playerId)), [activeLeague.roster]);
  const savedPlayers = useMemo(() => (bio ? savedIds.map((id) => bio.find((player) => player.id === id)).filter((player): player is BioPlayer => Boolean(player)) : []), [bio, savedIds]);
  const samplePlayers = useMemo(() => (bio ? matchRosterText(SAMPLE_ROSTER, bio) : []), [bio]);
  const shown = players ?? samplePlayers;
  const card = useMemo(() => (shown.length ? buildRosterCard(shown, today, nameIndex) : null), [nameIndex, shown, today]);
  const nameCount = useMemo(() => rosterTeamNames(shown).length, [shown]);
  const week = useMemo(() => (players && schedule ? buildWeekPreview(players, schedule.games, getCurrentWeekIso()) : null), [players, schedule]);

  const reveal = (next: BioPlayer[], nextSource: Source) => {
    setPlayers(next);
    setSource(nextSource);
    setNameIndex(0);
    setSaveState(null);
    setCardVersion((version) => version + 1);
    setShareStatus(null);
    const verdict = buildRosterCard(next, today).verdict.key;
    track('roster_card_created', { source: nextSource, players: next.length, verdict });
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
    if (!players || !card) return;
    const league = createLeague();
    const now = new Date().toISOString();
    updateLeague({ ...league, name: card.teamName, roster: toRoster(players), updatedAt: now });
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
    if (!cardRef.current || !card) return;
    setShareStatus('Making your image…');
    try {
      const blob = await renderFixedElementToPng(cardRef.current, CARD_WIDTH, CARD_HEIGHT, 2);
      const filename = `${card.teamName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'roster'}-cracked-ice.png`;
      const result = await shareOrDownloadPng(blob, filename, { title: card.teamName, text: `${card.verdict.title}. What does your draft say about you? ${CARD_URL}` });
      track('roster_card_shared', { format: result });
      setShareStatus(result === 'shared' ? 'Shared' : 'Image downloaded');
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === 'AbortError' ? null : 'The image could not be made. Try again.');
    }
  };

  const copyLink = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(`My fantasy hockey team is "${card.verdict.title}". What does your draft say about you? ${CARD_URL}`);
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

          <div className="mt-7 rounded-2xl border border-line-strong bg-surface-1 p-4 sm:p-5">
            <label htmlFor="roster-paste" className="text-sm font-semibold text-ink">Your roster</label>
            <p id="roster-paste-help" className="mt-1 text-sm text-ink-mute">On Yahoo, ESPN or Fleaflicker, open your team page, select all, copy, and paste it here. A plain list of names works too.</p>
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

          {players && (
            <section className="mt-8 rounded-2xl border border-accent/40 bg-surface-1 p-5" aria-labelledby="next-heading">
              <h2 id="next-heading" className="font-display text-2xl font-bold text-ink">Now make the team win</h2>
              <SaveNote state={saveState} leagueName={activeLeague.name} onSaveNew={saveAsNewLeague} />
              {week && <WeekStrip week={week} />}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/season?start=${week?.weekStart ?? ''}`} onClick={() => track('roster_card_next', { destination: 'season' })} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink"><CalendarDays size={16} aria-hidden="true" />See your open nights</Link>
                <Link to="/team#pickup-board" onClick={() => track('roster_card_next', { destination: 'team' })} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-accent"><ListPlus size={16} aria-hidden="true" />Find pickups for this week</Link>
              </div>
            </section>
          )}
        </div>

        <div ref={resultRef} className="min-w-0 scroll-mt-20 lg:sticky lg:top-24 lg:self-start">
          {card ? (
            <>
              {!players && <p className="mb-3 text-sm text-ink-mute">Example card. Paste your roster to get yours.</p>}
              <ScaledRosterCard card={card} cardRef={cardRef} animateKey={`${cardVersion}`} />
              {players && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={shareImage} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink">{navigator.maxTouchPoints > 0 ? <Share2 size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}{navigator.maxTouchPoints > 0 ? 'Share image' : 'Download image'}</button>
                  <button type="button" onClick={copyLink} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-accent"><Link2 size={16} aria-hidden="true" />Copy link for your league</button>
                  {nameCount > 1 && <button type="button" onClick={() => setNameIndex((index) => index + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-accent"><Shuffle size={16} aria-hidden="true" />Another name</button>}
                </div>
              )}
              {shareStatus && <p className="mt-2 text-sm text-ink-dim" role="status">{shareStatus}</p>}
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
