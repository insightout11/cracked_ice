import React from 'react';
import { PuckRating } from './player/PuckRating';

interface ShareIceRatingProps {
  value: number;
  compact?: boolean;
  size?: number;
}

/** Export-safe ICE treatment shared by the roster and game-day cards. */
export const ShareIceRating: React.FC<ShareIceRatingProps> = ({
  value,
  compact = false,
  size,
}) => {
  const resolvedSize = size ?? (compact ? 38 : 46);

  return (
    <div className="ml-1 flex shrink-0 flex-col items-center justify-center">
      <PuckRating value={value} size={resolvedSize} />
      <span className={`scoreboard-text text-accent ${compact ? 'text-[7px]' : 'mt-0.5 text-[8px]'}`}>ICE</span>
    </div>
  );
};
