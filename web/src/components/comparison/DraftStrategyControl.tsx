import { SlidersHorizontal } from 'lucide-react';
import { DRAFT_STRATEGY_PRESETS, VISIBLE_DRAFT_STRATEGY_PRESET_IDS, type DraftStrategyPresetId, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { SelectControl } from '../ui/select';

type DraftStrategy = LeagueWorkspace['draftStrategy'];
type DraftWeightKey = keyof DraftStrategy['weights'];

interface DraftStrategyControlProps {
  value: DraftStrategy;
  onChange: (value: DraftStrategy) => void;
  compact?: boolean;
}

const WEIGHT_LABELS: Record<DraftWeightKey, string> = {
  production: 'Projected value',
  regularSeason: 'Regular season',
  playoffs: 'Playoffs',
  positionValue: 'Position value',
};

const WEIGHT_TONES: Record<DraftWeightKey, string> = {
  production: 'bg-accent',
  regularSeason: 'bg-positive',
  playoffs: 'bg-warning',
  positionValue: 'bg-ink-dim',
};

export function DraftStrategyControl({ value, onChange, compact = false }: DraftStrategyControlProps) {
  const preset = value.presetId === 'custom' ? null : DRAFT_STRATEGY_PRESETS[value.presetId];
  const weightKeys = Object.keys(value.weights) as DraftWeightKey[];
  const weightTotal = weightKeys.reduce((sum, key) => sum + value.weights[key], 0) || 1;
  const setPreset = (presetId: DraftStrategyPresetId) => {
    if (presetId === 'custom') return onChange({ presetId, weights: value.weights });
    onChange({ presetId, weights: { ...DRAFT_STRATEGY_PRESETS[presetId].weights } });
  };
  const setWeight = (key: DraftWeightKey, weight: number) => onChange({ presetId: 'custom', weights: { ...value.weights, [key]: weight } });

  return <div className={`rounded-xl border border-line-strong bg-surface-1 ${compact ? 'p-3' : 'p-4'}`}>
    <div className={`flex gap-3 ${compact ? 'items-end justify-between' : 'flex-col sm:flex-row sm:items-start sm:justify-between'}`}>
      <div>
        <p className="scoreboard-text flex items-center gap-2 text-accent"><SlidersHorizontal size={14} />Draft strategy</p>
        {!compact && <p className="mt-1 text-xs text-ink-dim">Changes how projected fantasy-season points, regular-season access, playoff weeks, and positional value are weighted.</p>}
      </div>
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Strategy
        <SelectControl
          value={value.presetId}
          onValueChange={(next) => setPreset(next as DraftStrategyPresetId)}
          ariaLabel="Draft strategy"
          className={`${compact ? 'min-w-36' : 'min-w-48'} normal-case tracking-normal`}
          options={[...VISIBLE_DRAFT_STRATEGY_PRESET_IDS.map((id) => ({ value: id, label: DRAFT_STRATEGY_PRESETS[id].label })), { value: 'custom', label: 'Custom' }]}
        />
      </label>
    </div>
    <p className={`${compact ? 'mt-2 max-sm:hidden' : 'mt-3'} text-xs text-ink-mute`}>{preset?.description ?? 'Custom weighting for this league.'}</p>
    <div className={`${compact ? 'mt-3' : 'mt-4'} rounded-lg border border-line bg-surface-0 p-3`} aria-label="Active draft strategy weights">
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {weightKeys.map((key) => <div key={key} className={`${WEIGHT_TONES[key]} transition-[width]`} style={{ width: `${(value.weights[key] / weightTotal) * 100}%` }} title={`${WEIGHT_LABELS[key]} ${value.weights[key]}%`} />)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        {weightKeys.map((key) => <div key={key} className="flex items-center justify-between gap-2 text-[10px]">
          <span className="flex min-w-0 items-center gap-1.5 text-ink-dim"><span className={`size-2 shrink-0 rounded-full ${WEIGHT_TONES[key]}`} /><span className="truncate">{WEIGHT_LABELS[key]}</span></span>
          <strong className="font-mono text-ink">{value.weights[key]}%</strong>
        </div>)}
      </div>
    </div>
    <details className={`${compact ? 'mt-2 pt-2' : 'mt-3 pt-3'} border-t border-line`}>
      <summary className="cursor-pointer text-xs font-semibold text-accent">{compact ? 'Customize weights' : 'View or customize weights'}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {weightKeys.map((key) => <label key={key} className="grid gap-1 text-xs text-ink-dim">
          <span className="flex justify-between"><span>{WEIGHT_LABELS[key]}</span><strong className="font-mono text-ink">{value.weights[key]}%</strong></span>
          <input type="range" min="0" max="80" step="5" value={value.weights[key]} onChange={(event) => setWeight(key, Number(event.target.value))} aria-label={`${WEIGHT_LABELS[key]} weight`} className="w-full accent-[var(--accent)]" />
        </label>)}
      </div>
      <p className="mt-2 text-[11px] text-ink-mute">Weights are normalized automatically, so they do not need to add to exactly 100.</p>
      <p className="mt-1 text-[11px] text-ink-mute">Position value measures projected production above your league's replacement level, with a modest bonus for useful multi-position eligibility.</p>
    </details>
  </div>;
}
