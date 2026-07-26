import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RefreshCw, Share2, X } from 'lucide-react';
import { RosterShareFrame } from './RosterShareFrame';
import { Button } from './ui/button';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { renderElementToPng, shareOrDownloadPng } from '../lib/shareImage';

const SOCIAL_IMAGE = { width: 1080, height: 1350 };

interface ShareRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
}

export const ShareRosterModal: React.FC<ShareRosterModalProps> = ({
  isOpen,
  onClose,
  roster,
  leagueProfile,
  projections,
  timeWindow,
}) => {
  const renderFrameRef = useRef<HTMLDivElement | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => imageBlob ? URL.createObjectURL(imageBlob) : null,
    [imageBlob],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
        if (!node) throw new Error('Roster share frame is unavailable.');
        const blob = await renderElementToPng(node, SOCIAL_IMAGE);
        if (!cancelled) setImageBlob(blob);
      } catch (renderError) {
        console.error('Failed to render roster share image:', renderError);
        if (!cancelled) setError('The roster image could not be created. Try again.');
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [isOpen, renderVersion]);

  const handleShare = async () => {
    if (!imageBlob || isSharing) return;
    setIsSharing(true);
    setStatus(null);
    setError(null);
    try {
      const result = await shareOrDownloadPng(
        imageBlob,
        'cracked-ice-roster.png',
        {
          title: `${leagueProfile.league_name} fantasy hockey roster`,
          text: 'Here is my fantasy hockey roster. Build yours with schedule math at crackedicehockey.com.',
        },
      );
      setStatus(result === 'shared'
        ? 'Roster shared.'
        : 'Social image downloaded—attach it to your post anywhere.');
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      console.error('Failed to share roster image:', shareError);
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
            <p className="scoreboard-text text-accent">SOCIAL ROSTER CARD</p>
            <h2 id="share-roster-title" className="mt-1 text-xl font-bold text-ink">Share your roster</h2>
            <p className="mt-1 text-sm text-ink-dim">One polished image, ready for any social feed.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line p-2 text-ink-dim transition-colors hover:border-line-strong hover:text-ink"
            aria-label="Close share roster"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="mx-auto w-full max-w-[540px]">
            <div className="aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface-0 shadow-card">
              {isRendering ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <Loader2 className="mx-auto size-8 animate-spin text-accent" />
                    <p className="mt-3 text-sm text-ink-dim">Building your social card…</p>
                  </div>
                </div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="Preview of the Cracked Ice roster social card" className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full place-items-center px-8 text-center">
                  <div>
                    <p className="text-sm text-negative">{error ?? 'Preview unavailable.'}</p>
                    <Button variant="ghost" className="mt-4" onClick={() => setRenderVersion((value) => value + 1)}>
                      <RefreshCw size={15} /> Try again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col">
            <div className="rounded-xl border border-line bg-surface-0 p-4">
              <p className="scoreboard-text text-accent">INCLUDED</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-dim">
                <li>Cracked Ice branding and site link</li>
                <li>League, scoring, season, and date context</li>
                <li>Player headshots, teams, positions, and slots</li>
                <li>Games, usable starts, off-nights, and projected points</li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-surface-0 p-4 text-sm text-ink-dim">
              On supported phones, the button opens the native share menu. On desktop, it downloads the same social-ready PNG.
            </div>

            <div className="mt-auto pt-5">
              <Button className="w-full justify-center py-3" onClick={handleShare} disabled={!imageBlob || isRendering || isSharing}>
                {isSharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
                {isSharing ? 'Preparing share…' : 'Share roster'}
              </Button>
              {status && (
                <p aria-live="polite" className="mt-3 flex items-start gap-2 text-xs text-positive">
                  <Download size={14} className="mt-0.5 shrink-0" />{status}
                </p>
              )}
              {error && previewUrl && <p aria-live="assertive" className="mt-3 text-xs text-negative">{error}</p>}
            </div>
          </aside>
        </div>

        <div ref={renderFrameRef} aria-hidden="true" className="fixed left-[-12000px] top-0">
          <RosterShareFrame
            roster={roster}
            leagueProfile={leagueProfile}
            projections={projections}
            timeWindow={timeWindow}
          />
        </div>
      </section>
    </div>
  );
};
