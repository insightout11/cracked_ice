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
      <div style={{
        padding: '12px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
          Loading presets...
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px 20px',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap'
    }}>
      <label style={{
        fontSize: '14px',
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.9)',
        marginRight: '4px'
      }}>
        League Preset:
      </label>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onPresetChange(preset)}
            style={{
              padding: '6px 16px',
              fontSize: '14px',
              fontWeight: 500,
              border: selectedPreset === preset
                ? '2px solid #3b82f6'
                : '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: selectedPreset === preset
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              color: selectedPreset === preset
                ? '#60a5fa'
                : 'rgba(255, 255, 255, 0.8)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedPreset !== preset) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPreset !== preset) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }
            }}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
