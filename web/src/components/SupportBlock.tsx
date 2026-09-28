import { Snowflake } from 'lucide-react';
import { CoffeeLink } from './CoffeeLink';

/**
 * "Support independent fantasy hockey tools": the ask at the end of every article, the
 * footer and the phone menu. Compact drops the divider and tightens the spacing.
 */
export function SupportBlock({ compact = false, placement = 'blog', className = '', onClick }: {
  compact?: boolean;
  placement?: 'blog' | 'footer';
  className?: string;
  onClick?: () => void;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface-2/50 text-center ${compact ? 'p-4' : 'p-8'} ${className}`} aria-label="Support Cracked Ice">
      {!compact && (
        <div className="mb-4 flex items-center justify-center"><span className="h-px w-24 bg-line" /><Snowflake className="mx-4 text-accent" size={18} aria-hidden="true" /><span className="h-px w-24 bg-line" /></div>
      )}
      <h2 className={`font-semibold text-ink ${compact ? 'mb-1 text-base' : 'mb-2 text-xl'}`}>Support independent fantasy hockey tools</h2>
      <p className={`max-w-xl text-ink-dim sm:mx-auto ${compact ? 'mb-3 text-sm' : 'mb-5'}`}>Cracked Ice turns schedule data into league-aware decisions without hiding the methodology.</p>
      <CoffeeLink variant={placement} onClick={onClick} />
    </section>
  );
}
