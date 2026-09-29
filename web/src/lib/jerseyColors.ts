export interface JerseyColors {
  body: string;
  stripe: string;
}

/** Classic sweater combinations (no team names): the first is the Cracked Ice default. */
export const JERSEY_PRESETS: Array<{ name: string; colors: JerseyColors }> = [
  { name: 'Ice', colors: { body: '#16324a', stripe: '#63e6ff' } },
  { name: 'Blue & gold', colors: { body: '#0b3d91', stripe: '#fcb514' } },
  { name: 'Red & black', colors: { body: '#c8102e', stripe: '#111111' } },
  { name: 'Green & gold', colors: { body: '#00543c', stripe: '#f2b01e' } },
  { name: 'Orange & black', colors: { body: '#f47a38', stripe: '#111111' } },
  { name: 'Purple & gold', colors: { body: '#4b2e83', stripe: '#f1be48' } },
  { name: 'Black & white', colors: { body: '#111111', stripe: '#f3f3f3' } },
  { name: 'White & navy', colors: { body: '#f3f3f3', stripe: '#0b2545' } },
  { name: 'Teal & silver', colors: { body: '#00707c', stripe: '#c4ced4' } },
];

export const DEFAULT_JERSEY = JERSEY_PRESETS[0].colors;

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as [number, number, number];
}

/** Mixes a colour toward black by `amount` (0–1): the shadow side of the sweater. */
export function darken(hex: string, amount: number): string {
  return `#${channels(hex).map((channel) => Math.round(channel * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

/** Relative luminance, to pick readable text over a colour. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
