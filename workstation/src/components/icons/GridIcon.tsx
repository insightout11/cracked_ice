import React from 'react';

interface GridIconProps {
  className?: string;
  size?: number;
}

export const GridIcon: React.FC<GridIconProps> = ({
  className = '',
  size = 16
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer border */}
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      {/* Vertical dividers */}
      <line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" strokeWidth="1.5"/>
      {/* Horizontal dividers */}
      <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
};
