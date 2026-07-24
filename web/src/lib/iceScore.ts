/**
 * ICE Score Glacial Brightness System
 *
 * A dynamic color system that maps ICE scores to a dark-to-bright cyan gradient.
 * The coldest player in the current view appears almost black, the hottest glows neon cyan.
 */

export interface IceScoreStyle {
  textColor: string;
  glowColor: string;
  backgroundColor: string;
  boxShadow: string;
  border: string;
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;

  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Normalize an ICE score to 0-1 range based on min/max in current dataset
 */
export function normalizeIceScore(
  score: number,
  minScore: number,
  maxScore: number
): number {
  if (!isFinite(score)) return 0.5; // neutral for invalid scores
  const span = Math.max(maxScore - minScore, 0.1); // avoid divide-by-zero
  return Math.min(Math.max((score - minScore) / span, 0), 1);
}

/**
 * Get the glacial brightness style for an ICE score circle
 *
 * Color progression:
 * - 0.0 (t=0): #000814 (almost black) - Ice Block
 * - 0.25: #002338 (very dark blue) - Chilled
 * - 0.5: #004d78 (medium blue) - Solid/Average
 * - 0.75: #0090c9 (bright blue) - Good
 * - 1.0 (t=1): #00f7ff (neon cyan) - Elite/Peak Ice Mode
 */
export function getIceCircleStyle(
  score: number,
  minScore: number,
  maxScore: number
): IceScoreStyle {
  const t = normalizeIceScore(score, minScore, maxScore);

  // Multi-stop gradient for more nuanced progression
  let glowColor: string;
  if (t < 0.25) {
    glowColor = interpolateColor('#000814', '#002338', t * 4);
  } else if (t < 0.5) {
    glowColor = interpolateColor('#002338', '#004d78', (t - 0.25) * 4);
  } else if (t < 0.75) {
    glowColor = interpolateColor('#004d78', '#0090c9', (t - 0.5) * 4);
  } else {
    glowColor = interpolateColor('#0090c9', '#00f7ff', (t - 0.75) * 4);
  }

  // Text color: always white for maximum visibility
  const textColor = '#ffffff';

  // Glow intensity increases with brightness
  const glowSize = 6 + t * 16; // 6px to 22px
  const glowOpacity = 0.2 + t * 0.6; // 0.2 to 0.8
  const glow = `0 0 ${glowSize}px var(--accent)`;

  // Background: subtle gradient for depth
  const bgColor1 = interpolateColor(glowColor, '#ffffff', 0.15);
  const bgColor2 = interpolateColor(glowColor, '#000000', 0.1);
  const background = `linear-gradient(135deg, ${bgColor1}, ${bgColor2})`;

  // Border matches the glow color but slightly brighter
  const borderColor = interpolateColor(glowColor, '#ffffff', 0.2);

  return {
    textColor,
    glowColor,
    backgroundColor: background,
    boxShadow: glow,
    border: `2px solid ${borderColor}`
  };
}

/**
 * Get percentile-based Hot/Cold/Moderate classification
 */
export function getPerformanceLabel(
  score: number,
  scores: number[]
): { label: string; color: string; icon: string } {
  const validScores = scores.filter(isFinite).sort((a, b) => a - b);
  if (validScores.length === 0) return { label: '', color: '', icon: '' };

  const p33Index = Math.floor(validScores.length * 0.33);
  const p66Index = Math.floor(validScores.length * 0.66);
  const p33 = validScores[p33Index];
  const p66 = validScores[p66Index];

  if (score < p33) {
 return { label: 'Cold', color: 'text-accent', icon: '' };
  } else if (score >= p66) {
 return { label: 'Hot', color: 'text-warning', icon: '' };
  } else {
 return { label: 'Moderate', color: 'text-ink-mute', icon: '' };
  }
}

/**
 * Add pulse animation class for elite players (top 10%)
 */
export function shouldPulse(score: number, minScore: number, maxScore: number): boolean {
  const normalized = normalizeIceScore(score, minScore, maxScore);
  return normalized >= 0.9; // Top 10% get pulse effect
}
