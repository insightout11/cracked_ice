import React from 'react';

interface ChevronIconProps {
  className?: string;
  direction?: 'up' | 'down';
  size?: number;
}

export const ChevronIcon: React.FC<ChevronIconProps> = ({
  className = '',
  direction = 'down',
  size = 12
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ transform: direction === 'up' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};
