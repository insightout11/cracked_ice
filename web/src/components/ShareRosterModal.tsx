import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ClipboardCopy, Download, LayoutGrid, Loader2, RefreshCw, Scale, Share2, Shirt, X } from 'lucide-react';
import { RosterShareFrame } from './RosterShareFrame';
import { StartSitShareFrame } from './StartSitShareFrame';
import { WeekShareFrame } from './WeekShareFrame';
import { TeamCardShareFrame } from './TeamCardShareFrame';
import { Button } from './ui/button';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { renderElementToPng, shareOrDownloadPng } from '../lib/shareImage';
import { SEASON_END, SEASON_START, SCHEDULE_URL } from '../lib/season';
import type { LeagueWorkspace } from '../lib/leagueWorkspace';
import { getPlayerProjection } from '../lib/playerProjection';
import { useInjuries, withInjuries } from '../lib/injuries';
import { busyNights, startSitDecision, startSitText, type StartSitGame } from '../lib/startSit';
import { weekShare } from '../lib/weekShare';
import { track } from '../lib/analytics';

const SQUARE_IMAGE = { width: 1080, height: 1080 };
const PORTRAIT_IMAGE = { width: 1080, height: 1350 };
const LANDSCAPE_IMAGE = { width: 1200, height: 675 };
const BUSY_NIGHT_DAYS = 14;

type ShareMode = 'startsit' | 'week' | 'roster' | 'teamcard';

const MODES: Array<{ id: ShareMode; label: string; detail: string; icon: React.ReactNode }> = [
  { id: 'startsit', label: 'Start / sit', detail: 'Ask who to bench on a busy night', icon: <Scale size={16} /> },
  { id: 'week', label: 'My week', detail: 'Games, starts and off-nights at a glance', icon: <CalendarDays size={16} /> },
  { id: 'roster', label: 'Full roster', detail: 'Your whole team, lines and pairs', icon: <LayoutGrid size={16} /> },
  { id: 'teamcard', label: 'Team card', detail: 'A hockey card of your team, sized for posts', icon: <Shirt size={16} /> },
];

interface SeasonSchedule {
  games: Record<string, StartSitGame[]>;
}

interface ShareRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
  fantasyTeam: LeagueWorkspace['fantasyTeam'];
  workspace: LeagueWorkspace;
}

function localDateKey(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function defaultLineupDate(schedule: SeasonSchedule, roster: RosterPlayer[]): string {
  const today = localDateKey();
  if (today >= SEASON_START && today <= SEASON_END) return today;
  const teams = new Set(roster.map((player) => player.team));
  const dates = Object.entries(schedule.games)
    .filter(([team]) => teams.has(team))
    .flatMap(([, games]) => games.map((game) => game.date))
    .sort();
  return dates.find((date) => date >= today) ?? dates[dates.length - 1] ?? SEASON_START;
}

const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export const ShareRosterModal: React.FC<ShareRosterModalProps> = ({
  isOpen,
  onClose,
  roster,
  leagueProfile,
  projections,
  timeWindow,
  fantasyTeam,
  workspace,
}) => {
  const renderFrameRef = useRef<HTMLDivElement | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode>('startsit');
  const [schedule, setSchedule] = useState<SeasonSchedule | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [lineupDate, setLineupDate] = useState(localDateKey);
  // Start/sit: the tool's own pick stays off by default, so people answer honestly.
  const [showPick, setShowPick] = useState(false);
  const [creditText, setCreditText] = useState(true);
  // A busy night can hold separate decisions (at RW, at D): one card each.
  const [groupIndex, setGroupIndex] = useState(0);
  const injuries = useInjuries();
  const healthyRoster = useMemo(() => withInjuries(roster, injuries), [injuries, roster]);
  const fppgOf = useMemo(() => (player: RosterPlayer) => getPlayerProjection(projections, player.id)?.fppg ?? player.blendedFppg ?? player.seasonFppg ?? 0, [projections]);
  const teamName = fantasyTeam.name.trim();

  const decision = useMemo(() => (schedule ? startSitDecision(workspace, healthyRoster, schedule.games, lineupDate, fppgOf) : null), [fppgOf, healthyRoster, lineupDate, schedule, workspace]);
  const busy = useMemo(() => (schedule ? busyNights(workspace, healthyRoster, schedule.games, [localDateKey(), SEASON_START].sort()[1], BUSY_NIGHT_DAYS, fppgOf) : []), [fppgOf, healthyRoster, schedule, workspace]);
  const week = useMemo(() => (schedule ? weekShare(workspace, healthyRoster, schedule.games, lineupDate, fppgOf) : null), [fppgOf, healthyRoster, lineupDate, schedule, workspace]);
  const group = decision?.groups[Math.min(groupIndex, decision.groups.length - 1)] ?? null;
  const decisionText = useMemo(() => (group ? startSitText(lineupDate, group, { showPick, credit: creditText }) : ''), [creditText, group, lineupDate, showPick]);
  useEffect(() => { setGroupIndex(0); }, [lineupDate]);

  const previewUrl = useMemo(
    () => imageBlob ? URL.createObjectURL(imageBlob) : null,
    [imageBlob],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!isOpen || schedule) return;
    let cancelled = false;
    setIsLoadingSchedule(true);
    fetch(SCHEDULE_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Schedule request failed with ${response.status}`);
        return response.json() as Promise<SeasonSchedule>;
      })
      .then((data) => {
        if (cancelled) return;
        setSchedule(data);
        // Open on the next night someone has to sit, when there is one.
        const firstBusy = busyNights(workspace, withInjuries(roster, injuries), data.games, [localDateKey(), SEASON_START].sort()[1], BUSY_NIGHT_DAYS, fppgOf)[0]?.date;
        setLineupDate(firstBusy ?? defaultLineupDate(data, roster));
      })
      .catch((scheduleError) => {
        console.error('Failed to load schedule for lineup sharing:', scheduleError);
        if (!cancelled) setError('The season schedule could not be loaded. Try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSchedule(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, roster, schedule]);

  const imageSize = shareMode === 'roster' || shareMode === 'week' ? PORTRAIT_IMAGE : shareMode === 'teamcard' ? LANDSCAPE_IMAGE : SQUARE_IMAGE;

  useEffect(() => {
    if (!isOpen) {
      setImageBlob(null);
      setStatus(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const render = async () => {
      setIsRendering(true);
      setImageBlob(null);
      setStatus(null);
      setError(null);
      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const node = renderFrameRef.current;
        if (!node) throw new Error('Share frame is unavailable.');
        const blob = await renderElementToPng(node, imageSize);
        if (!cancelled) setImageBlob(blob);
      } catch (renderError) {
        console.error('Failed to render share image:', renderError);
        if (!cancelled) setError('The social image could not be created. Try again.');
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [isOpen, renderVersion, shareMode, lineupDate, schedule, showPick, group, week]);

  const shareCopy = (): { filename: string; title: string; text: string; label: string } => {
    const name = teamName || leagueProfile.league_name;
    if (shareMode === 'startsit') return { filename: `cracked-ice-start-sit-${lineupDate}.png`, title: `Start/sit, ${shortDate(lineupDate)}`, text: decisionText || 'Who would you start?', label: 'Start/sit card' };
    if (shareMode === 'week') return { filename: `cracked-ice-week-${week?.start ?? lineupDate}.png`, title: `${name}: my week`, text: 'Rate my week. Who should I stream?', label: 'Week card' };
    if (shareMode === 'teamcard') return { filename: 'cracked-ice-team-card.png', title: `${name} team card`, text: `${name}: my team for the season.`, label: 'Team card' };
    return { filename: 'cracked-ice-roster.png', title: `${name} fantasy hockey roster`, text: 'What would you change? Who should I add, drop, start, or sit?', label: 'Roster' };
  };

  const handleShare = async () => {
    if (!imageBlob || isSharing) return;
    setIsSharing(true);
    setStatus(null);
    setError(null);
    try {
      const copy = shareCopy();
      const result = await shareOrDownloadPng(imageBlob, copy.filename, { title: copy.title, text: copy.text });
      track('roster_shared', { mode: shareMode, result: result === 'shared' ? 'shared' : 'downloaded' });
      setStatus(result === 'shared' ? `${copy.label} shared.` : 'Image downloaded. Attach it to your post anywhere.');
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      console.error('Failed to share image:', shareError);
      setError('Sharing was unavailable. Try again to download the image.');
    } finally {
      setIsSharing(false);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(decisionText);
      track('roster_shared', { mode: 'startsit-text', result: 'copied' });
      setStatus('Copied. Paste it into any chat or comment thread.');
    } catch {
      setError('Copying was blocked. Select the text below and copy it.');
    }
  };

  if (!isOpen) return null;

  const needsDate = shareMode === 'startsit' || shareMode === 'week';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-surface-0/90 p-3 backdrop-blur-md sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-roster-title"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-raised"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="scoreboard-text text-accent">SOCIAL SHARE CARD</p>
            <h2 id="share-roster-title" className="mt-1 text-xl font-bold text-ink">Share your team</h2>
            <p className="mt-1 text-sm text-ink-dim">Ask the community: an image for anywhere, or text for comment threads.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-line p-2 text-ink-dim transition-colors hover:border-line-strong hover:text-ink" aria-label="Close share roster">
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="mx-auto w-full max-w-[540px]">
            <div className={`${imageSize === SQUARE_IMAGE ? 'aspect-square' : imageSize === LANDSCAPE_IMAGE ? 'aspect-[16/9]' : 'aspect-[4/5]'} overflow-hidden rounded-xl border border-line bg-surface-0 shadow-card`}>
              {isRendering ? (
                <div className="grid h-full place-items-center text-center"><div><Loader2 className="mx-auto size-8 animate-spin text-accent" /><p className="mt-3 text-sm text-ink-dim">Building your card…</p></div></div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="Preview of the Cracked Ice share card" className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full place-items-center px-8 text-center"><div><p className="text-sm text-negative">{error ?? 'Preview unavailable.'}</p><Button variant="ghost" className="mt-4" onClick={() => setRenderVersion((value) => value + 1)}><RefreshCw size={15} /> Try again</Button></div></div>
              )}
            </div>
          </div>

          <aside className="flex flex-col">
            <div className="grid gap-1.5" role="group" aria-label="Card type">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={shareMode === mode.id}
                  onClick={() => setShareMode(mode.id)}
                  className={`keep-flex flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${shareMode === mode.id ? 'border-accent bg-accent-muted' : 'border-line bg-surface-0 hover:border-line-strong'}`}
                >
                  <span className={shareMode === mode.id ? 'text-accent' : 'text-ink-mute'}>{mode.icon}</span>
                  <span className="min-w-0"><span className="block text-sm font-bold text-ink">{mode.label}</span><span className="block text-xs text-ink-dim">{mode.detail}</span></span>
                </button>
              ))}
            </div>

            {needsDate && (
              <div className="mt-4 rounded-xl border border-line bg-surface-0 p-4">
                <label htmlFor="lineup-share-date" className="scoreboard-text text-accent">{shareMode === 'week' ? 'ANY DAY IN THE WEEK' : 'GAME DATE'}</label>
                <input id="lineup-share-date" type="date" min={SEASON_START} max={SEASON_END} value={lineupDate} onChange={(event) => setLineupDate(event.target.value)} className="mt-2 w-full rounded-lg border border-line-strong bg-surface-1 px-3 py-2 text-sm text-ink" />

                {shareMode === 'startsit' && (
                  <>
                    <p className="mt-3 text-xs text-ink-dim">{busy.length ? 'Busy nights coming up:' : isLoadingSchedule ? 'Loading matchups…' : `Nobody has to sit in the next ${BUSY_NIGHT_DAYS} days.`}</p>
                    {busy.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {busy.map((night) => (
                          <button key={night.date} type="button" aria-pressed={night.date === lineupDate} onClick={() => setLineupDate(night.date)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${night.date === lineupDate ? 'border-accent bg-accent-muted text-ink' : 'border-line text-ink-dim hover:border-accent'}`}>
                            {shortDate(night.date)} <span className="text-warning">· {night.sits} sit{night.sits === 1 ? 's' : ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {decision && decision.groups.length > 1 && (
                      <div className="mt-3">
                        <p className="text-xs text-ink-dim">{decision.groups.length} separate decisions this night:</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Decision">
                          {decision.groups.map((item, index) => (
                            <button key={item.label + index} type="button" aria-pressed={item === group} onClick={() => setGroupIndex(index)} className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${item === group ? 'border-accent bg-accent-muted text-ink' : 'border-line text-ink-dim hover:border-accent'}`}>
                              <span className="capitalize">{item.label}</span> · {item.sits} sit{item.sits === 1 ? 's' : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <label className="mt-3 flex items-center gap-2 text-xs text-ink">
                      <input type="checkbox" checked={showPick} onChange={(event) => setShowPick(event.target.checked)} className="accent-[var(--accent)]" />
                      Show our pick
                    </label>
                  </>
                )}

              </div>
            )}

            {shareMode === 'startsit' && group && (
              <div className="mt-4 rounded-xl border border-line bg-surface-0 p-4">
                <p className="scoreboard-text text-accent">FOR COMMENT THREADS</p>
                <textarea readOnly value={decisionText} rows={Math.min(8, decisionText.split('\n').length + 1)} aria-label="Start/sit question as text" className="mt-2 w-full resize-none rounded-lg border border-line bg-surface-1 p-2 font-mono text-[11px] leading-relaxed text-ink" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-ink-dim">
                    <input type="checkbox" checked={creditText} onChange={(event) => setCreditText(event.target.checked)} className="accent-[var(--accent)]" />
                    Add site link
                  </label>
                  <Button size="sm" variant="ghost" onClick={copyText}><ClipboardCopy size={14} /> Copy text</Button>
                </div>
              </div>
            )}

            <div className="mt-auto pt-5">
              <Button className="w-full justify-center py-3" onClick={handleShare} disabled={!imageBlob || isRendering || isSharing}>
                {isSharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
                {isSharing ? 'Preparing share…' : 'Share image'}
              </Button>
              <p className="mt-3 text-center text-xs text-ink-mute">Share on your phone or download the image to post anywhere.</p>
              {status && <p aria-live="polite" className="mt-3 flex items-start gap-2 text-xs text-positive"><Download size={14} className="mt-0.5 shrink-0" />{status}</p>}
              {error && previewUrl && <p aria-live="assertive" className="mt-3 text-xs text-negative">{error}</p>}
            </div>
          </aside>
        </div>

        <div ref={renderFrameRef} aria-hidden="true" className="fixed left-[-12000px] top-0">
          {shareMode === 'roster' && <RosterShareFrame roster={roster} leagueProfile={leagueProfile} projections={projections} timeWindow={timeWindow} fantasyTeam={fantasyTeam} />}
          {shareMode === 'teamcard' && <TeamCardShareFrame roster={roster} leagueProfile={leagueProfile} projections={projections} fantasyTeam={fantasyTeam} />}
          {shareMode === 'startsit' && <StartSitShareFrame group={group} locked={decision?.locked ?? []} date={lineupDate} showPick={showPick} teamName={teamName} />}
          {shareMode === 'week' && week && <WeekShareFrame week={week} teamName={teamName} />}
        </div>
      </section>
    </div>
  );
};
