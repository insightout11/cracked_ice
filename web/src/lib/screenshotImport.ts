import type { PlayerSearchResult } from '../types';
import { buildRosterImportRows } from './rosterImport';

/** A player row read from a Yahoo available-players screenshot (api/availability-screenshot). */
export interface ScreenshotPlayer {
  name: string;
  team: string | null;
  positions: string[];
  status: 'FA' | 'W' | 'unknown';
  waiverDate: string | null;
}

export interface ScreenshotMatch {
  player: PlayerSearchResult;
  read: ScreenshotPlayer;
}

export const MAX_SCREENSHOTS = 4;
/** Longest image edge sent for reading: enough for small list text, well under upload limits. */
const MAX_EDGE = 1800;

/** Yahoo's team abbreviations where they differ from the NHL's. */
const YAHOO_TEAMS: Record<string, string> = { LA: 'LAK', NJ: 'NJD', SJ: 'SJS', TB: 'TBL', MON: 'MTL', WAS: 'WSH', VEG: 'VGK', CLS: 'CBJ', UTAH: 'UTA', ARI: 'UTA' };
export const nhlTeam = (team: string | null) => (team ? YAHOO_TEAMS[team.toUpperCase()] ?? team.toUpperCase() : null);

/** Shrinks a screenshot to JPEG and returns it base64-encoded. */
export async function encodeScreenshot(file: File): Promise<{ mediaType: 'image/jpeg'; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas_unavailable');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { mediaType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

export class ScreenshotReadError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Sends up to four screenshots to be read; resolves to the player rows found. */
export async function readYahooScreenshots(files: File[], today: string): Promise<{ isPlayerList: boolean; players: ScreenshotPlayer[] }> {
  const images = await Promise.all(files.slice(0, MAX_SCREENSHOTS).map(encodeScreenshot));
  const response = await fetch('/api/availability-screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, today }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ScreenshotReadError(body.error ?? `http_${response.status}`);
  }
  return response.json();
}

/**
 * Matches read rows to the player directory by name; when a name fits several players,
 * the team shown in the screenshot decides. Returns matches and the names left over.
 */
export function matchScreenshotPlayers(directory: PlayerSearchResult[], rows: ScreenshotPlayer[]): { matched: ScreenshotMatch[]; unmatched: ScreenshotPlayer[] } {
  if (!rows.length) return { matched: [], unmatched: [] };
  const importRows = buildRosterImportRows(directory, rows.map((row) => row.name).join('\n'));
  const matched: ScreenshotMatch[] = [];
  const unmatched: ScreenshotPlayer[] = [];
  const used = new Set<string>();
  rows.forEach((read, index) => {
    const row = importRows[index];
    const team = nhlTeam(read.team);
    const byTeam = row?.candidates.filter((candidate) => team && candidate.team === team) ?? [];
    // Same name on the same team (the two Elias Petterssons): the position decides.
    const byPosition = byTeam.filter((candidate) => candidate.pos.some((position) => read.positions.includes(position)));
    const chosen = row?.status === 'matched' && row.selectedPlayerId
      ? directory.find((player) => player.id === row.selectedPlayerId)
      : byTeam.length === 1 ? byTeam[0] : byPosition.length === 1 ? byPosition[0] : nicknameMatch(directory, read, team);
    if (chosen && !used.has(chosen.id)) {
      used.add(chosen.id);
      matched.push({ player: chosen, read });
    } else {
      unmatched.push(read);
    }
  });
  return { matched, unmatched };
}

const plainName = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s'-]/g, '').trim().split(/\s+/);

/**
 * Yahoo and the NHL sometimes use different first names for one player (Thomas/Tommy
 * Novak, Nick/Nicholas Robertson, Maxim/Max Shabanov). When the full name finds no one,
 * accept the one player with the same last name and first initial on the same NHL team,
 * at a matching position. Two or more such players: no match rather than a guess.
 */
function nicknameMatch(directory: PlayerSearchResult[], read: ScreenshotPlayer, team: string | null): PlayerSearchResult | undefined {
  if (!team) return undefined;
  const words = plainName(read.name);
  if (words.length < 2) return undefined;
  const last = words.slice(1).join(' ');
  const initial = words[0][0];
  const found = directory.filter((player) => {
    const candidate = plainName(player.name);
    return candidate.length >= 2 && candidate.slice(1).join(' ') === last && candidate[0][0] === initial && player.team === team
      && (!read.positions.length || player.pos.some((position) => read.positions.includes(position) || (position === 'G') === read.positions.includes('G')));
  });
  return found.length === 1 ? found[0] : undefined;
}

const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/** "Sep 29" as a date, in today's year unless that would be months in the past (the season crosses New Year). */
export function waiverDateFrom(month: string, day: string, today: string): string | null {
  const monthNumber = MONTHS[month.slice(0, 3)];
  if (!monthNumber) return null;
  let year = Number(today.slice(0, 4));
  if (monthNumber < Number(today.slice(5, 7)) - 6) year += 1;
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
}

const TEAM_POSITION = /^([A-Za-z]{2,4})\s+-\s+((?:C|LW|RW|D|G|F|W|Util)(?:\s*,\s*(?:C|LW|RW|D|G|F|W|Util))*)$/;
const WAIVERS = /^W\s*\(\s*([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s*\)$/;
/** Words Yahoo prints right after a player's name in copied text. */
const NAME_SUFFIXES = /(No new player Notes?|New Player Notes?|Player Notes?|DTD|IR-LT|IR-NR|IR\+?|NA|O|SUSP)+$/;

/**
 * Reads text copied from Yahoo's Players page (select all, copy): each player's name
 * line, his "TEAM - POS" line, then "W (Sep 29)" or "FA". Same rows as a screenshot read.
 */
export function parseYahooPlayersPaste(text: string, today: string): ScreenshotPlayer[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const players: ScreenshotPlayer[] = [];
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    const teamPosition = line.match(TEAM_POSITION);
    if (!teamPosition || index === 0) return;
    const name = lines[index - 1].replace(NAME_SUFFIXES, '').trim();
    if (!/^[\p{L}\p{M} .'’-]{2,40}$/u.test(name)) return;
    const next = lines[index + 1] ?? '';
    const waivers = next.match(WAIVERS);
    const status: ScreenshotPlayer['status'] = waivers ? 'W' : next === 'FA' ? 'FA' : 'unknown';
    const key = `${name.toLowerCase()}|${teamPosition[1].toUpperCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    players.push({
      name,
      team: teamPosition[1].toUpperCase(),
      positions: teamPosition[2].split(',').map((position) => position.trim().toUpperCase()),
      status,
      waiverDate: waivers ? waiverDateFrom(waivers[1], waivers[2], today) : null,
    });
  });
  return players;
}
