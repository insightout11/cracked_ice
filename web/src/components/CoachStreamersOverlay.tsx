import { TooltipLabel } from './ui/tooltip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type { CoachStreamersResponse, CoachRecommendation, CoachWindow, CoachUserStatus } from '../types';

const COACH_PRO_ENABLED = (import.meta.env.VITE_COACH_PRO ?? 'true') !== 'false';
const BADGE_COPY: Record<string, string> = {
  Cyan: 'Top-tier stream: elite off-night mix in window',
  Blue: 'Strong schedule advantage over baseline',
  Green: 'Solid streaming schedule',
  Red: 'Tough schedule - monitor starts',
  B2B: 'Back-to-back inside selected window',
  PP1: 'Projected top power-play usage',
  MattPick: 'Highlighted in the weekly human picks'
};

const MOVES_OPTIONS = [1, 2];
const MISSING_DATA_MESSAGE = 'Upload league settings and roster before running the coach.';

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeWindow(preset: '7d' | '14d'): CoachWindow {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (preset === '7d' ? 6 : 13));
  return { start: toIso(start), end: toIso(end) };
}

function formatTeam(team: string): string {
  return team.toUpperCase();
}

interface CoachStreamersOverlayProps {

  coachStatus: CoachUserStatus | null;

}



export function CoachStreamersOverlay({ coachStatus }: CoachStreamersOverlayProps) {
  const defaultWindow = useMemo(() => computeWindow('7d'), []);
  const [preset, setPreset] = useState<'7d' | '14d' | 'custom'>('7d');
  const [customWindow, setCustomWindow] = useState<CoachWindow>({ start: '', end: '' });
  const [currentWindow, setCurrentWindow] = useState<CoachWindow | null>(defaultWindow);
  const [movesThisWeek, setMovesThisWeek] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachStreamersResponse | null>(null);

  const hasRequiredData = Boolean(
    coachStatus &&
    coachStatus.components.settings.present &&
    coachStatus.components.roster.present
  );



  const handleFetch = useCallback(

    async (window: CoachWindow) => {

      if (!hasRequiredData) {

        setError(MISSING_DATA_MESSAGE);

        return;

      }

      try {

        setLoading(true);

        setError(null);

        const response = await apiService.getCoachStreamers(window);

        setResult(response);

      } catch (err) {

        console.error('coach streamers failed', err);

        setError('Could not reach the coach API. Make sure the backend at http://localhost:3000 is running.');

      } finally {

        setLoading(false);

      }

    },

    [hasRequiredData]

  );

  useEffect(() => {

    if (!COACH_PRO_ENABLED) return;

    if (!currentWindow) return;

    if (!hasRequiredData) return;

    void handleFetch(currentWindow);

  }, [currentWindow, handleFetch, hasRequiredData]);

  useEffect(() => {
    if (hasRequiredData && error === MISSING_DATA_MESSAGE) {
      setError(null);
    }
  }, [hasRequiredData, error]);

  useEffect(() => {
    if (preset === '7d' || preset === '14d') {
      setCurrentWindow(computeWindow(preset));
    } else {
      if (customWindow.start && customWindow.end) {
        setCurrentWindow({ ...customWindow });
      } else {
        setCurrentWindow(null);
      }
    }
  }, [preset, customWindow]);

  const onCustomChange = (field: 'start' | 'end', value: string) => {
    setCustomWindow((prev) => ({ ...prev, [field]: value }));
  };

  const renderBadge = (badge: string) => (
    <TooltipLabel label={BADGE_COPY[badge] ?? ''}><span
        key={badge}
        className="rounded-full bg-surface-2/40 px-3 py-1 text-xs uppercase tracking-wide text-[var(--accent)]">
        {badge}
      </span></TooltipLabel>
  );

  const renderRecommendation = (rec: CoachRecommendation, index: number) => (
    <div key={`${rec.player.id}-${index}`} className="rounded-xl border border-line bg-surface-1/5 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">Streamer #{index + 1}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-lg font-semibold text-[var(--ink)]">{rec.player.name}</h4>
            <span className="text-sm font-medium text-[var(--accent)]">{formatTeam(rec.player.team)}</span>
            <span className="text-xs text-[var(--ink-mute)]">{rec.player.pos.join(' / ')}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">? Points</p>
          <p className="text-2xl font-semibold text-[var(--accent)]">{rec.deltaPoints.toFixed(2)}</p>
          <p className="text-xs text-[var(--ink-mute)]">? GP {rec.deltaGp >= 0 ? `+${rec.deltaGp}` : rec.deltaGp}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-[var(--ink-mute)]">
        <span>
          Best drop: <span className="font-medium text-[var(--ink)]">{rec.bestDrop.player.name}</span> ({rec.bestDrop.player.team})
          {' '}(<span className="font-mono">{rec.bestDrop.lostPoints.toFixed(2)} pts</span>)
        </span>
        <a className="text-xs font-medium text-[var(--accent)] hover:underline" href="#" onClick={(e) => e.preventDefault()}>
          View alternates
        </a>
      </div>
      {rec.badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rec.badges.map(renderBadge)}
        </div>
      )}
    </div>
  );

  return (
    <section className="rounded-2xl border border-line bg-surface-1/5 p-6 shadow-lg backdrop-blur-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--ink)]">AI Coach Streamers</h2>
          <p className="text-xs text-[var(--ink-mute)]">Using Yahoo default scoring  Off-nights auto-accounted via lineup sim</p>
        </div>
        <div className="flex items-center gap-3">
          {!COACH_PRO_ENABLED && (
            <span className="rounded-lg bg-warning-muted px-3 py-2 text-xs font-medium uppercase text-warning">
              Upgrade to Pro to unlock
            </span>
          )}
          <div className="flex gap-2">
            {MOVES_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMovesThisWeek(value)}
                className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                  movesThisWeek === value
                    ? 'border-[var(--accent)] bg-surface-2/60 text-[var(--accent)]'
                    : 'border-line bg-surface-glass text-[var(--ink-mute)] hover:border-accent/40'
                }`}
              >
                {value} move{value > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(['7d', '14d', 'custom'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPreset(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
              preset === value
                ? 'bg-accent/90 text-accent-ink shadow-[0_0_12px_var(--accent-muted)]'
                : 'bg-surface-glass text-[var(--ink-mute)] hover:bg-accent/20'
            }`}
          >
            {value === '7d' && 'Next 7 days'}
            {value === '14d' && 'Next 14 days'}
            {value === 'custom' && 'Custom window'}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--ink-mute)]">
          <label className="flex items-center gap-2">
            <span>Start</span>
            <input
              type="date"
              className="rounded-md border border-line bg-surface-glass px-2 py-1 text-[var(--ink)]"
              value={customWindow.start}
              onChange={(event) => onCustomChange('start', event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <span>End</span>
            <input
              type="date"
              className="rounded-md border border-line bg-surface-glass px-2 py-1 text-[var(--ink)]"
              value={customWindow.end}
              onChange={(event) => onCustomChange('end', event.target.value)}
            />
          </label>
          {!customWindow.start || !customWindow.end ? (
            <span className="text-xs text-warning">Select a start and end date to run the coach.</span>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--ink-mute)]">
        <span>
          Window {currentWindow ? `${currentWindow.start} - ${currentWindow.end}` : 'not selected'}
        </span>
        <button
          type="button"
          onClick={() => currentWindow && COACH_PRO_ENABLED && void handleFetch(currentWindow)}
          disabled={loading || !COACH_PRO_ENABLED || !currentWindow || !hasRequiredData}
          className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-ink shadow-[0_0_12px_var(--accent-muted)] transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-[var(--surface-glass)] disabled:text-[var(--ink-mute)]"
        >
          {loading ? 'Running...' : 'Run Coach'}
        </button>
      </div>

      {!hasRequiredData && (
        <div className="mt-2 text-xs text-warning">{MISSING_DATA_MESSAGE}</div>
      )}
      {coachStatus && coachStatus.contextError && (
        <div className="mt-2 text-xs text-warning">{coachStatus.contextError}</div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-negative bg-negative-muted px-4 py-3 text-sm text-negative">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-glass px-4 py-3 text-sm text-[var(--ink-mute)]">
            <span>
              Baseline projection: <strong className="text-[var(--ink)]">{result.baseline_points.toFixed(2)} pts</strong>
            </span>
            {result.meta && (
              <span>Req {result.meta.reqId.slice(0, 8)}  {result.meta.durationMs} ms</span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {result.recommendations.length === 0 && (
              <div className="rounded-xl border border-line bg-surface-1/5 p-4 text-sm text-[var(--ink-mute)]">
                No winning single-move streams in this window.
              </div>
            )}
            {result.recommendations.map(renderRecommendation)}
          </div>
        </div>
      )}
    </section>
  );
}





