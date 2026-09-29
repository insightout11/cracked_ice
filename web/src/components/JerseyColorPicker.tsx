import { DEFAULT_JERSEY, JERSEY_PRESETS, type JerseyColors } from '../lib/jerseyColors';

/** A sweater swatch: body colour with a stripe band. */
function Swatch({ colors, size = 28 }: { colors: JerseyColors; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M8 3 L11 2 Q14 5 17 2 L20 3 L27 8 L25 14 L21 13 L21 26 L7 26 L7 13 L3 14 L1 8 Z" fill={colors.body} stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <rect x="7" y="20" width="14" height="2.5" fill={colors.stripe} />
      <path d="M2 10.5 L7 9 L7 11 L2 12.5 Z M26 10.5 L21 9 L21 11 L26 12.5 Z" fill={colors.stripe} />
    </svg>
  );
}

/**
 * Sweater colours for the team card: a row of classic combinations, plus body and
 * stripe pickers for exact colours.
 */
export function JerseyColorPicker({ value, onChange }: { value: JerseyColors | null; onChange: (colors: JerseyColors) => void }) {
  const current = value ?? DEFAULT_JERSEY;
  const same = (colors: JerseyColors) => colors.body.toLowerCase() === current.body.toLowerCase() && colors.stripe.toLowerCase() === current.stripe.toLowerCase();
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sweater colours">
        {JERSEY_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            title={preset.name}
            aria-label={preset.name}
            aria-pressed={same(preset.colors)}
            onClick={() => onChange(preset.colors)}
            className={`keep-flex grid size-10 place-items-center rounded-lg border ${same(preset.colors) ? 'border-accent bg-accent-muted' : 'border-line bg-surface-0 hover:border-accent/60'}`}
          >
            <Swatch colors={preset.colors} />
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-dim">
        <label className="flex items-center gap-2">
          <input type="color" value={current.body} onChange={(event) => onChange({ ...current, body: event.target.value })} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" aria-label="Sweater body colour" />
          Body
        </label>
        <label className="flex items-center gap-2">
          <input type="color" value={current.stripe} onChange={(event) => onChange({ ...current, stripe: event.target.value })} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" aria-label="Sweater stripe colour" />
          Stripes
        </label>
      </div>
    </div>
  );
}
