import { TooltipLabel } from '../ui/tooltip';
import React from 'react';
import type { AvailabilityStatus } from '../../types';

interface AvailabilityToggleProps {
  value: AvailabilityStatus;
  onChange: (status: AvailabilityStatus) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const STATUS_OPTIONS: Array<{
  value: AvailabilityStatus;
  label: string;
  title: string;
  color: string;
}> = [
  {
    value: 'FA',
    label: 'FA',
    title: 'Free Agent',
    color: 'bg-positive-muted text-positive hover:bg-positive-muted',
  },
  {
    value: 'WAIVER',
    label: 'W',
    title: 'Waiver',
    color: 'bg-warning-muted text-warning hover:bg-warning-muted',
  },
  {
    value: 'OWNED_OTHER',
    label: 'Oth',
    title: 'Owned by other team',
    color: 'bg-negative-muted text-negative hover:bg-negative-muted',
  },
  {
    value: 'UNKNOWN',
    label: 'Unk',
    title: 'Unknown availability',
    color: 'bg-surface-2/20 text-ink-dim hover:bg-surface-2/30',
  },
  {
    value: 'OWNED_ME',
    label: 'Me',
    title: 'Owned by me',
    color: 'bg-accent-muted text-accent hover:bg-accent-muted',
  },
];

export const AvailabilityToggle: React.FC<AvailabilityToggleProps> = ({
  value,
  onChange,
  size = 'sm',
  disabled = false,
}) => {
  const buttonClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2 py-1 text-sm';

  return (
    <div
      className="inline-flex bg-surface-1/5 rounded-md border border-line overflow-hidden"
      role="group"
      aria-label="Player availability status"
    >
      {STATUS_OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <TooltipLabel label={option.title}><button
              key={option.value}
              type="button"
              onClick={() => !disabled && onChange(option.value)}
              disabled={disabled}
              className={`
                ${buttonClasses}
                font-medium transition-all
                ${isActive
                  ? option.color.replace('hover:', '')
                  : 'bg-transparent text-ink-dim hover:bg-surface-1/10'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                border-r border-line last:border-r-0
              `}
              aria-label={option.title}
              aria-pressed={isActive}>
              {option.label}
            </button></TooltipLabel>
        );
      })}
    </div>
  );
};
