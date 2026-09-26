import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { spring, type SpringConfig } from 'remotion';

/** Same palette as the Weekly Edge graphics (scripts/weekly/render-weekly.mjs). */
export const C = {
  bg: '#071522',
  panel: '#0d2032',
  panel2: '#102a40',
  line: '#24465c',
  ink: '#f1f8ff',
  dim: '#9cb6c7',
  mute: '#6f8ea3',
  ice: '#63e6ff',
  iceDeep: '#2fd3c9',
  red: '#ff7d8b',
  green: '#84f7a6',
};

// Archivo 800 is the wordmark's typeface; Inter carries the reading text.
export const display = loadArchivo('normal', { weights: ['800'], subsets: ['latin'] }).fontFamily;
export const body = loadInter('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }).fontFamily;

/** Safe area for TikTok / Reels / Shorts: their UI covers the top, bottom and right edge. */
export const SAFE = { left: 90, right: 150, top: 230, bottom: 380 };

const SETTLE: Partial<SpringConfig> = { damping: 200 };

/** 0 → 1 over about half a second, starting at `delay` frames. */
export function enter(frame: number, fps: number, delay = 0, config: Partial<SpringConfig> = SETTLE): number {
  return spring({ frame: frame - delay, fps, config });
}

export const TEAM_NAMES: Record<string, string> = {
  ANA: 'Ducks', BOS: 'Bruins', BUF: 'Sabres', CAR: 'Hurricanes', CBJ: 'Blue Jackets', CGY: 'Flames', CHI: 'Blackhawks', COL: 'Avalanche', DAL: 'Stars', DET: 'Red Wings', EDM: 'Oilers', FLA: 'Panthers', LAK: 'Kings', MIN: 'Wild', MTL: 'Canadiens', NJD: 'Devils', NSH: 'Predators', NYI: 'Islanders', NYR: 'Rangers', OTT: 'Senators', PHI: 'Flyers', PIT: 'Penguins', SEA: 'Kraken', SJS: 'Sharks', STL: 'Blues', TBL: 'Lightning', TOR: 'Maple Leafs', UTA: 'Mammoth', VAN: 'Canucks', VGK: 'Golden Knights', WPG: 'Jets', WSH: 'Capitals',
};

export const logoUrl = (team: string) => `https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`; // white-outlined, for dark backgrounds
