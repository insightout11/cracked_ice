import { ShieldCheck } from 'lucide-react';
import type { IceRatingBreakdown } from '../../lib/coachSchemas';
import { iceRatingTier } from '../../lib/iceRating';

interface IceRatingGaugeProps {
  rating: IceRatingBreakdown;
  compact?: boolean;
}

const componentStyles = {
  impact: { name: 'Impact', text: 'text-accent', bar: 'bg-accent' },
  context: { name: 'Context', text: 'text-positive', bar: 'bg-positive' },
  expectation: { name: 'Expectation', text: 'text-warning', bar: 'bg-warning' },
} as const;

const tierStyles = {
  elite: 'border-accent bg-accent/20 text-ink shadow-accent motion-safe:animate-pulse',
  strong: 'border-accent bg-accent-muted text-ink shadow-accent',
  useful: 'border-accent-muted bg-surface-1 text-accent shadow-accent-soft',
  limited: 'border-line-strong bg-surface-1 text-ink-dim',
  low: 'border-line bg-surface-0 text-ink-mute',
} as const;

interface IceRatingBadgeProps {
  rating: IceRatingBreakdown;
  size?: 'sm' | 'lg';
}

export function IceRatingBadge({ rating, size = 'lg' }: IceRatingBadgeProps) {
  const tier = iceRatingTier(rating.total);
  return (
    <div className="flex flex-col items-center" aria-label={`ICE rating ${rating.total} out of 10, ${rating.confidence.level} confidence`}>
      <div className={`flex items-center justify-center rounded-full border-2 ${size === 'lg' ? 'h-16 w-16 text-lg' : 'h-11 w-11 text-sm'} ${tierStyles[tier]}`}>
        <strong className="scoreboard-number">{rating.total.toFixed(1)}</strong>
      </div>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-dim">ICE</span>
    </div>
  );
}

export function IceRatingGauge({ rating, compact = false }: IceRatingGaugeProps) {
  const tier = iceRatingTier(rating.total);
  const components = (['impact', 'context', 'expectation'] as const).map((key) => ({
    key,
    ...componentStyles[key],
    ...rating[key],
  }));

  return (
    <figure className={`rounded-xl border border-line bg-surface-0 ${compact ? 'p-3' : 'p-5'}`} aria-labelledby="ice-rating-title">
      <div className={`grid items-center ${compact ? 'grid-cols-[6.5rem_minmax(0,1fr)] gap-3' : 'gap-5 lg:grid-cols-[9rem_1fr]'}`}>
        <div className="relative mx-auto aspect-square w-full max-w-36" aria-label={`ICE rating ${rating.total} out of 10`}>
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" strokeWidth="5" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray={`${rating.impact.score * 10} 100`} />
            <circle cx="60" cy="60" r="43" fill="none" stroke="var(--line)" strokeWidth="5" />
            <circle cx="60" cy="60" r="43" fill="none" stroke="var(--positive)" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray={`${rating.context.score * 10} 100`} />
            <circle cx="60" cy="60" r="34" fill="none" stroke="var(--line)" strokeWidth="5" />
            <circle cx="60" cy="60" r="34" fill="none" stroke="var(--warning)" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray={`${rating.expectation.score * 10} 100`} />
          </svg>
          <div className={`absolute inset-[28%] flex flex-col items-center justify-center rounded-full border-2 ${tierStyles[tier]}`}>
            <strong className={`${compact ? 'text-xl' : 'text-3xl'} scoreboard-number leading-none`}>{rating.total.toFixed(1)}</strong>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em]">ICE</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="scoreboard-text text-accent">Impact · Context · Expectation</p>
              <h3 id="ice-rating-title" className="mt-1 text-lg font-semibold text-ink">Personalized ICE rating</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-1 px-2.5 py-1 text-xs text-ink-dim">
              <ShieldCheck size={13} className={rating.confidence.level === 'high' ? 'text-positive' : rating.confidence.level === 'medium' ? 'text-warning' : 'text-ink-mute'} />
              {rating.confidence.level} confidence
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {components.map((component) => (
              <div key={component.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className={`font-semibold ${component.text}`}>{component.name} · {component.label}</span>
                  <strong className="scoreboard-number text-sm text-ink">{component.score.toFixed(1)}</strong>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div className={`h-full rounded-full ${component.bar}`} style={{ width: `${component.score * 10}%` }} />
                </div>
                {!compact && <p className="mt-1 text-xs text-ink-mute">{component.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {!compact && <figcaption className="mt-4 border-t border-line pt-3 text-xs text-ink-mute">This 0–10 rating uses the active league scoring, roster capacity, and selected dates. {rating.confidence.detail}</figcaption>}
    </figure>
  );
}
