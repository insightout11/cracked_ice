import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RefreshCw, Share2, X } from 'lucide-react';
import { RosterShareFrame } from './RosterShareFrame';
import { TonightLineupShareFrame, type LineupShareGame, type TonightLineupPlayer } from './TonightLineupShareFrame';
import { Button } from './ui/button';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { renderElementToPng, shareOrDownloadPng } from '../lib/shareImage';
import { SEASON_END, SEASON_START, SCHEDULE_URL } from '../lib/season';
import type { LeagueWorkspace } from '../lib/leagueWorkspace';

const SOCIAL_IMAGE = { width: 1080, height: 1350 };
const RESERVE_SLOTS = new Set(['BN', 'IR', 'IR+']);

type ShareMode = 'roster' | 'tonight';

interface SeasonSchedule {
  games: Record<string, LineupShareGame[]>;
}

interface ShareRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
  fantasyTeam: LeagueWorkspace['fantasyTeam'];
}

function localDateKey(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function baseSlot(slot = ''): string {
  return slot.toUpperCase().match(/^([A-Z+]+)/)?.[1] ?? '';
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

export const ShareRosterModal: React.FC<ShareRosterModalProps> = ({
  isOpen,
  onClose,
  roster,
  leagueProfile,
  projections,
  timeWindow,
  fantasyTeam,
}) => {
  const renderFrameRef = useRef<HTMLDivElement | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode>('roster');
  const [schedule, setSchedule] = useState<SeasonSchedule | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [lineupDate, setLineupDate] = useState(localDateKey);
  const [startedPlayerIds, setStartedPlayerIds] = useState<Set<string>>(new Set());

  const tonightPlayers = useMemo<TonightLineupPlayer[]>(() => {
    if (!schedule) return [];
    return roster.flatMap((player) => {
      const game = schedule.games[player.team]?.find((candidate) => candidate.date === lineupDate);
      return game ? [{ player, game }] : [];
    });
  }, [lineupDate, roster, schedule]);

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
        setLineupDate(defaultLineupDate(data, roster));
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

  useEffect(() => {
    setStartedPlayerIds(new Set(
      tonightPlayers
        .filter(({ player }) => !RESERVE_SLOTS.has(baseSlot(player.current_slot)))
        .map(({ player }) => player.id),
    ));
  }, [tonightPlayers]);

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
        const blob = await renderElementToPng(node, SOCIAL_IMAGE);
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
  }, [isOpen, renderVersion, shareMode, lineupDate, startedPlayerIds, schedule]);

  const handleShare = async () => {
    if (!imageBlob || isSharing) return;
    setIsSharing(true);
    setStatus(null);
    setError(null);
    try {
      const isTonight = shareMode === 'tonight';
      const result = await shareOrDownloadPng(
        imageBlob,
        isTonight ? `cracked-ice-lineup-${lineupDate}.png` : 'cracked-ice-roster.png',
        {
          title: isTonight ? `${fantasyTeam.name.trim() || leagueProfile.league_name} lineup for ${lineupDate}` : `${fantasyTeam.name.trim() || leagueProfile.league_name} fantasy hockey roster`,
          text: isTonight
            ? 'Who would you start tonight? Check my matchup-aware lineup from Cracked Ice.'
            : 'Here is my fantasy hockey roster. Build yours with schedule math at crackedicehockey.com.',
        },
      );
      setStatus(result === 'shared'
        ? `${isTonight ? 'Lineup' : 'Roster'} shared.`
        : 'Social image downloaded—attach it to your post anywhere.');
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      console.error('Failed to share image:', shareError);
      setError('Sharing was unavailable. Try again to download the image.');
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen) return null;

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
            <p className="mt-1 text-sm text-ink-dim">A roster snapshot or tonight&apos;s start/sit conversation.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-line p-2 text-ink-dim transition-colors hover:border-line-strong hover:text-ink" aria-label="Close share roster">
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="mx-auto w-full max-w-[540px]">
            <div className="aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface-0 shadow-card">
              {isRendering ? (
                <div className="grid h-full place-items-center text-center"><div><Loader2 className="mx-auto size-8 animate-spin text-accent" /><p className="mt-3 text-sm text-ink-dim">Building your social card…</p></div></div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="Preview of the Cracked Ice social card" className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full place-items-center px-8 text-center"><div><p className="text-sm text-negative">{error ?? 'Preview unavailable.'}</p><Button variant="ghost" className="mt-4" onClick={() => setRenderVersion((value) => value + 1)}><RefreshCw size={15} /> Try again</Button></div></div>
              )}
            </div>
          </div>

          <aside className="flex flex-col">
            <div className="grid grid-cols-2 rounded-xl border border-line bg-surface-0 p-1">
              <button type="button" aria-pressed={shareMode === 'roster'} onClick={() => setShareMode('roster')} className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${shareMode === 'roster' ? 'bg-accent text-surface-0' : 'text-ink-dim hover:text-ink'}`}>Full roster</button>
              <button type="button" aria-pressed={shareMode === 'tonight'} onClick={() => setShareMode('tonight')} className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${shareMode === 'tonight' ? 'bg-accent text-surface-0' : 'text-ink-dim hover:text-ink'}`}>Tonight&apos;s lineup</button>
            </div>

            {shareMode === 'tonight' && (
              <div className="mt-4 rounded-xl border border-line bg-surface-0 p-4">
                <label htmlFor="lineup-share-date" className="scoreboard-text text-accent">GAME DATE</label>
                <input id="lineup-share-date" type="date" min={SEASON_START} max={SEASON_END} value={lineupDate} onChange={(event) => setLineupDate(event.target.value)} className="mt-2 w-full rounded-lg border border-line-strong bg-surface-1 px-3 py-2 text-sm text-ink" />
                <p className="mt-3 text-xs text-ink-dim">Tap anyone playing to move them between your lineup and bench.</p>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {isLoadingSchedule ? (
                    <p className="py-3 text-center text-xs text-ink-dim">Loading matchups…</p>
                  ) : tonightPlayers.length > 0 ? tonightPlayers.map(({ player, game }) => {
                    const isStarted = startedPlayerIds.has(player.id);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => setStartedPlayerIds((current) => {
                          const next = new Set(current);
                          if (next.has(player.id)) next.delete(player.id);
                          else next.add(player.id);
                          return next;
                        })}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${isStarted ? 'border-accent bg-accent-muted' : 'border-line bg-surface-1'}`}
                      >
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{player.full_name}</span><span className="block text-xs text-ink-dim">{game.isHome ? 'vs' : '@'} {game.opponent}</span></span>
                        <span className={`shrink-0 text-[11px] font-black uppercase ${isStarted ? 'text-accent' : 'text-warning'}`}>{isStarted ? 'Start' : 'Sit'}</span>
                      </button>
                    );
                  }) : (
                    <p className="py-3 text-center text-xs text-ink-dim">No players on your roster play this date.</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-line bg-surface-0 p-4">
              <p className="scoreboard-text text-accent">INCLUDED</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-dim">
                <li>Cracked Ice branding and site link</li>
                {shareMode === 'roster' ? (
                  <><li>League, scoring, season, and date context</li><li>Player headshots, teams, positions, and slots</li><li>Games, usable starts, off-nights, and projected points</li></>
                ) : (
                  <><li>Opponent, home/away, and local start time</li><li>Your starters, sits, off-nights, and projected points</li><li>A discussion-ready “Who would you start?” prompt</li></>
                )}
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-surface-0 p-4 text-sm text-ink-dim">On supported phones, the button opens the native share menu. On desktop, it downloads the same social-ready PNG.</div>

            <div className="mt-auto pt-5">
              <Button className="w-full justify-center py-3" onClick={handleShare} disabled={!imageBlob || isRendering || isSharing}>
                {isSharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
                {isSharing ? 'Preparing share…' : shareMode === 'tonight' ? 'Share lineup' : 'Share roster'}
              </Button>
              {status && <p aria-live="polite" className="mt-3 flex items-start gap-2 text-xs text-positive"><Download size={14} className="mt-0.5 shrink-0" />{status}</p>}
              {error && previewUrl && <p aria-live="assertive" className="mt-3 text-xs text-negative">{error}</p>}
            </div>
          </aside>
        </div>

        <div ref={renderFrameRef} aria-hidden="true" className="fixed left-[-12000px] top-0">
          {shareMode === 'roster' ? (
            <RosterShareFrame roster={roster} leagueProfile={leagueProfile} projections={projections} timeWindow={timeWindow} fantasyTeam={fantasyTeam} />
          ) : (
            <TonightLineupShareFrame leagueProfile={leagueProfile} lineupDate={lineupDate} players={tonightPlayers} projections={projections} startedPlayerIds={startedPlayerIds} fantasyTeam={fantasyTeam} />
          )}
        </div>
      </section>
    </div>
  );
};
