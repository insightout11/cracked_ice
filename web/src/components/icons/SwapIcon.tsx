import React from 'react';

interface SwapIconProps {
  className?: string;
  size?: number;
}

export const SwapIcon: React.FC<SwapIconProps> = ({
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
      {/* Left circle */}
      <circle cx="5" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      {/* Right circle */}
      <circle cx="11" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      {/* Top curved arrow (left to right) */}
      <path d="M7.5 5.5C8.2 5 9.3 5 10 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M10 5.5L10.5 5L10.8 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Bottom curved arrow (right to left) */}
      <path d="M8.5 10.5C7.8 11 6.7 11 6 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M6 10.5L5.5 11L5.2 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};
