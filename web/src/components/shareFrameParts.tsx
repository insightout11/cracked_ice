import React from 'react';
import type { RosterPlayer } from '../lib/coachSchemas';
import { mugshotSeason } from '../lib/season';

/*
 * Share images are drawn with html2canvas, which places HTML text unreliably (flex-
 * centred text drifts down; clipped text loses its descenders). Text on share cards
 * is SVG instead, which it draws exactly.
 */

/** Card colours as values: SVG drawn by html2canvas can't resolve CSS variables. From styles/tokens.css. */
export const CARD = { ink: '#f3fbff', dim: '#b6d3df', mute: '#7f9ba8', accent: '#63e6ff', positive: '#84f7a6', warning: '#ffd27e' } as const;

type Anchor = 'start' | 'middle' | 'end';

/** One line of text as SVG: shrinks to fit `width` instead of wrapping or clipping. `spans` mixes colours in the line. */
export function SvgText({ text, spans, width, size, weight = 700, color = CARD.ink as string, anchor = 'start', family = 'Arial, Helvetica, sans-serif', letterSpacing }: {
  text?: string;
  spans?: Array<{ text: string; color?: string; weight?: number }>;
  width: number;
  size: number;
  weight?: number;
  color?: string;
  anchor?: Anchor;
  family?: string;
  letterSpacing?: number;
}) {
  const full = spans ? spans.map((span) => span.text).join('') : text ?? '';
  const height = Math.round(size * 1.3);
  // Squeeze only text that clearly overflows: forcing a length on shorter text stretches it.
  const estimated = full.length * size * (weight >= 800 ? 0.6 : 0.52) + (letterSpacing ?? 0) * full.length;
  const fitted = estimated > width * 1.06 ? width : undefined;
  const x = anchor === 'start' ? 0 : anchor === 'middle' ? width / 2 : width;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block shrink-0" aria-label={full}>
      <text x={x} y={Math.round(size * 1.0)} fill={color} fontFamily={family} fontSize={size} fontWeight={weight} textAnchor={anchor} letterSpacing={letterSpacing} textLength={fitted} lengthAdjust={fitted ? 'spacingAndGlyphs' : undefined}>
        {spans ? spans.map((span, index) => <tspan key={index} fill={span.color ?? color} fontWeight={span.weight ?? weight}>{span.text}</tspan>) : full}
      </text>
    </svg>
  );
}

/** Game time as hockey fans read it: Eastern, e.g. "7:00 PM ET". */
export function gameTimeEt(startTime?: string): string {
  if (!startTime || !startTime.includes('T')) return '';
  return `${new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET`;
}

export const headshotUrl = (player: RosterPlayer) => `/api/coach/share-assets/headshot/${mugshotSeason}/${player.team}/${player.id.replace(/^nhl:/, '')}`;
export const logoUrl = (team: string) => `/api/coach/share-assets/logo/${team}`;

/** A round headshot with the team logo tucked at the corner. */
export function Headshot({ player, size }: { player: RosterPlayer; size: number }) {
  const badge = Math.round(size * 0.36);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <img src={headshotUrl(player)} alt="" crossOrigin="anonymous" className="rounded-full border border-line bg-surface-0 object-cover" style={{ width: size, height: size }} />
      <img src={logoUrl(player.team)} alt="" crossOrigin="anonymous" className="absolute object-contain" style={{ width: badge, height: badge, right: -2, bottom: -2 }} />
    </div>
  );
}

/** The dark rink backdrop shared by every card. */
export function CardBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-surface-0 via-surface-1 to-surface-0" />
      <img src="/hockey-rink-bg.png" alt="" className="absolute inset-0 size-full object-cover opacity-[0.06]" />
    </>
  );
}

export const lastName = (player: RosterPlayer) => player.full_name.split(' ').slice(1).join(' ') || player.full_name;
