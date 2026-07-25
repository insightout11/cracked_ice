import React from 'react';
import { normalizeIceScore } from '../../lib/iceScore';

interface PuckRatingProps {
  value: number;
  /** Range of ICE ratings in the current view, used for glacial brightness. */
  min?: number;
  max?: number;
  /** Rendered width/height in px. */
  size?: number;
  pulse?: boolean;
  className?: string;
}

/**
 * ICE rating rendered as the Cracked Ice puck: a black rubber disc with the
 * brand fracture running through its face. Brightness of the crack and rim
 * tracks where this rating sits in the current view (glacial brightness).
 */
export const PuckRating: React.FC<PuckRatingProps> = ({
  value,
  min = 0,
  max = 4,
  size = 64,
  pulse = false,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const t = normalizeIceScore(value, min, max);
  const text = Number.isFinite(value) ? value.toFixed(1) : '—';
  const fontSize = text.length >= 4 ? 17 : 21;

  const crackOpacity = 0.45 + t * 0.5;
  const rimOpacity = 0.28 + t * 0.5;
  const glowAlpha = 0.12 + t * 0.4;
  const glowSize = 4 + t * 10;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      className={`${pulse ? 'animate-ice-pulse' : ''} ${className}`}
      style={{ filter: `drop-shadow(0 0 ${glowSize}px rgba(99, 230, 255, ${glowAlpha}))` }}
      role="img"
      aria-label={`ICE rating ${text}`}
    >
      <defs>
        <radialGradient id={`pf-${uid}`} cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#24405c" />
          <stop offset="1" stopColor="#0b1826" />
        </radialGradient>
        <linearGradient id={`pc-${uid}`} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#a6f3ff" />
          <stop offset="0.5" stopColor="#63e6ff" />
          <stop offset="1" stopColor="#2fd3c9" />
        </linearGradient>
        <clipPath id={`pk-${uid}`}>
          <circle cx="36" cy="34" r="27.5" />
        </clipPath>
      </defs>

      {/* rubber side wall */}
      <ellipse cx="36" cy="41" rx="27.5" ry="26" fill="#04090f" />
      {/* top face */}
      <circle cx="36" cy="34" r="27.5" fill={`url(#pf-${uid})`} />
      {/* the fracture, clipped to the face so it reads as a break in the rubber */}
      <g clipPath={`url(#pk-${uid})`}>
        <path
          d="M20 2 L15 22 L23 32 L13 46 L18 68"
          fill="none"
          stroke={`url(#pc-${uid})`}
          strokeWidth="2.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={crackOpacity}
        />
      </g>
      <circle cx="36" cy="34" r="27.5" fill="none" stroke="#31536f" strokeWidth="1.2" />
      {/* rim light */}
      <path
        d="M36 6.5 A27.5 27.5 0 0 1 63 31"
        fill="none"
        stroke="#63e6ff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={rimOpacity}
      />
      <text
        x="42"
        y="42"
        textAnchor="middle"
        fill="#f3fbff"
        fontSize={fontSize}
        fontWeight="700"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </text>
    </svg>
  );
};
