import { useState, useEffect } from 'react';
import { getPresets, type PresetsResponse } from '../lib/coachApi';

interface LeaguePresetBarProps {
  selectedPreset: string;
  onPresetChange: (preset: string) => void;
}

export function LeaguePresetBar({ selectedPreset, onPresetChange }: LeaguePresetBarProps) {
  const [presets, setPresets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    getPresets(controller.signal)
      .then((response: PresetsResponse) => {
        setPresets(response.presets);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Failed to load presets:', error);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className='[padding:12px_20px] bg-line [border-bottom:1px_solid_var(--line)] flex gap-[8px] items-center'>
        <span className='text-[14px] text-ink'>
          Loading presets...
        </span>
      </div>
    );
  }

  return (
    <div className='[padding:12px_20px] bg-line [border-bottom:1px_solid_var(--line)] flex gap-[12px] items-center [flex-wrap:wrap]'>
      <label className='text-[14px] font-semibold text-ink mr-[4px]'>
        League Preset:
      </label>
      <div className='flex gap-[8px] [flex-wrap:wrap]'>
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onPresetChange(preset)}
            style={{
              border: selectedPreset === preset
                ? '2px solid var(--accent)'
                : '1px solid var(--line)',

              backgroundColor: selectedPreset === preset
                ? 'var(--accent-muted)'
                : 'var(--line)',

              color: selectedPreset === preset
                ? 'var(--accent)'
                : 'var(--ink)'
            }}
            onMouseEnter={(e) => {
              if (selectedPreset !== preset) {
                e.currentTarget.style.backgroundColor = 'var(--line)';
                e.currentTarget.style.borderColor = 'var(--line)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPreset !== preset) {
                e.currentTarget.style.backgroundColor = 'var(--line)';
                e.currentTarget.style.borderColor = 'var(--line)';
              }
            }}
            className='[padding:6px_16px] text-[14px] font-medium rounded-[6px] cursor-pointer [transition:all_0.2s_ease]'>
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
