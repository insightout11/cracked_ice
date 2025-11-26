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
    color: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
  },
  {
    value: 'WAIVER',
    label: 'W',
    title: 'Waiver',
    color: 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
  },
  {
    value: 'OWNED_OTHER',
    label: 'Oth',
    title: 'Owned by other team',
    color: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
  },
  {
    value: 'UNKNOWN',
    label: 'Unk',
    title: 'Unknown availability',
    color: 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30',
  },
  {
    value: 'OWNED_ME',
    label: 'Me',
    title: 'Owned by me',
    color: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
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
      className="inline-flex bg-white/5 rounded-md border border-white/10 overflow-hidden"
      role="group"
      aria-label="Player availability status"
    >
      {STATUS_OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`
              ${buttonClasses}
              font-medium transition-all
              ${isActive
                ? option.color.replace('hover:', '')
                : 'bg-transparent text-gray-400 hover:bg-white/10'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              border-r border-white/10 last:border-r-0
            `}
            title={option.title}
            aria-label={option.title}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
