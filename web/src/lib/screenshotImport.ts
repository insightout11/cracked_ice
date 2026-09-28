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
    const chosen = row?.status === 'matched' && row.selectedPlayerId
      ? directory.find((player) => player.id === row.selectedPlayerId)
      : byTeam.length === 1 ? byTeam[0] : undefined;
    if (chosen && !used.has(chosen.id)) {
      used.add(chosen.id);
      matched.push({ player: chosen, read });
    } else {
      unmatched.push(read);
    }
  });
  return { matched, unmatched };
}
