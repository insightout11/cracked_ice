import React from 'react';
import { AlertCircle } from 'lucide-react';

interface InjuryBadgeProps {
  injuryStatus?: string;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const InjuryBadge: React.FC<InjuryBadgeProps> = ({
  injuryStatus,
  isActive,
  size = 'md',
}) => {
  // Don't show badge if no injury data or if player is active
  if (isActive === true || (injuryStatus === undefined && isActive === undefined)) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1'
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14
  };

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border font-bold bg-red-500/20 text-red-400 border-red-500/40 ${sizeClasses[size]}`}
      title="Player is not currently active"
    >
      <AlertCircle size={iconSizes[size]} />
      <span>{injuryStatus || 'INACTIVE'}</span>
    </div>
  );
};
