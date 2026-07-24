import { SlidersHorizontal } from 'lucide-react';
import { DRAFT_STRATEGY_PRESETS, type DraftStrategyPresetId, type LeagueWorkspace } from '../../lib/leagueWorkspace';

type DraftStrategy = LeagueWorkspace['draftStrategy'];
type DraftWeightKey = keyof DraftStrategy['weights'];

interface DraftStrategyControlProps {
  value: DraftStrategy;
  onChange: (value: DraftStrategy) => void;
}

const WEIGHT_LABELS: Record<DraftWeightKey, string> = {
  production: 'Production',
  regularSeason: 'Regular season',
  playoffs: 'Playoffs',
  positionValue: 'Position value',
};

export function DraftStrategyControl({ value, onChange }: DraftStrategyControlProps) {
  const preset = value.presetId === 'custom' ? null : DRAFT_STRATEGY_PRESETS[value.presetId];
  const setPreset = (presetId: DraftStrategyPresetId) => {
    if (presetId === 'custom') return onChange({ presetId, weights: value.weights });
    onChange({ presetId, weights: { ...DRAFT_STRATEGY_PRESETS[presetId].weights } });
  };
  const setWeight = (key: DraftWeightKey, weight: number) => onChange({ presetId: 'custom', weights: { ...value.weights, [key]: weight } });

  return <div className="rounded-xl border border-line-strong bg-surface-1 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="scoreboard-text flex items-center gap-2 text-accent"><SlidersHorizontal size={14} />Draft strategy</p>
        <p className="mt-1 text-xs text-ink-dim">Changes how production, regular-season access, playoff weeks, and scarcity are weighted.</p>
      </div>
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Strategy
        <select value={value.presetId} onChange={(event) => setPreset(event.target.value as DraftStrategyPresetId)} className="min-h-10 rounded-md border border-line bg-surface-0 px-3 text-sm font-semibold normal-case tracking-normal text-ink">
          {Object.entries(DRAFT_STRATEGY_PRESETS).map(([id, option]) => <option key={id} value={id}>{option.label}</option>)}
          <option value="custom">Custom</option>
        </select>
      </label>
    </div>
    <p className="mt-3 text-xs text-ink-mute">{preset?.description ?? 'Custom weighting for this league.'}</p>
    <details className="mt-3 border-t border-line pt-3">
      <summary className="cursor-pointer text-xs font-semibold text-accent">View or customize weights</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(Object.keys(value.weights) as DraftWeightKey[]).map((key) => <label key={key} className="grid gap-1 text-xs text-ink-dim">
          <span className="flex justify-between"><span>{WEIGHT_LABELS[key]}</span><strong className="font-mono text-ink">{value.weights[key]}%</strong></span>
          <input type="range" min="0" max="80" step="5" value={value.weights[key]} onChange={(event) => setWeight(key, Number(event.target.value))} aria-label={`${WEIGHT_LABELS[key]} weight`} className="accent-[var(--accent)]" />
        </label>)}
      </div>
      <p className="mt-2 text-[11px] text-ink-mute">Weights are normalized automatically, so they do not need to add to exactly 100.</p>
    </details>
  </div>;
}
