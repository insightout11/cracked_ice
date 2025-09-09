import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatWeekLabel, getPrevWeekIso, getNextWeekIso, getWeekOptions } from '../lib/schedule';
import { IceDropdown } from './IceDropdown';

interface ScoreboardBannerProps {
  weekIso: string;
  onWeekChange: (iso: string) => void;
}

export function ScoreboardBanner({ weekIso, onWeekChange }: ScoreboardBannerProps) {
  const weekOptions = getWeekOptions(weekIso);

  const handlePrevWeek = () => {
    onWeekChange(getPrevWeekIso(weekIso));
  };

  const handleNextWeek = () => {
    onWeekChange(getNextWeekIso(weekIso));
  };

  const handleWeekSelect = (value: string | number) => {
    onWeekChange(String(value));
  };

  return (
    <div className="glass glow-border px-6 py-6 md:px-8 md:py-8 rounded-xl">
      <div className="flex items-center justify-center gap-8">
        <div 
          className="text-[var(--ci-white)] font-semibold tracking-wide brand-title text-lg md:text-xl"
          style={{
            textShadow: '0 0 8px rgba(93, 227, 255, 0.6), 0 0 16px rgba(93, 227, 255, 0.3)',
            border: '1px solid rgba(93, 227, 255, 0.3)',
            borderRadius: '8px',
            padding: '8px 16px',
            background: 'rgba(93, 227, 255, 0.05)',
            backdropFilter: 'blur(8px)'
          }}
        >
          NHL Weekly Schedule
        </div>
        
        <div className="flex items-center gap-2">
        <button
          onClick={handlePrevWeek}
          className="p-2 rounded-lg transition-all"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'var(--ice-text-100)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(93, 227, 255, 0.2)';
            e.currentTarget.style.borderColor = '#9FE8FF';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(93, 227, 255, 0.3)';
            e.currentTarget.style.color = '#0E1A2B';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.color = 'var(--ice-text-100)';
          }}
          aria-label="Previous week"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--laser-cyan)]" />
        </button>
        
        <div className="w-[240px]">
          <IceDropdown
            options={weekOptions}
            value={weekIso}
            onChange={handleWeekSelect}
            placeholder="Pick week"
            aria-label="Select week"
          />
        </div>
        
        <button
          onClick={handleNextWeek}
          className="p-2 rounded-lg transition-all"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'var(--ice-text-100)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(93, 227, 255, 0.2)';
            e.currentTarget.style.borderColor = '#9FE8FF';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(93, 227, 255, 0.3)';
            e.currentTarget.style.color = '#0E1A2B';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.color = 'var(--ice-text-100)';
          }}
          aria-label="Next week"
        >
          <ChevronRight className="w-5 h-5 text-[var(--laser-cyan)]" />
        </button>
        </div>
      </div>
    </div>
  );
}