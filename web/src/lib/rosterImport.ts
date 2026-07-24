import type { PlayerSearchResult } from '../types';
import type { LeagueProfile } from './coachSchemas';

export const ROSTER_POSITIONS = ['C', 'LW', 'RW', 'D', 'G'] as const;
export type RosterPosition = typeof ROSTER_POSITIONS[number];

export type RosterImportStatus = 'matched' | 'ambiguous' | 'unmatched' | 'duplicate';

export interface RosterImportRow {
  key: string;
  source: string;
  status: RosterImportStatus;
  candidates: PlayerSearchResult[];
  selectedPlayerId: string | null;
}

export function normalizeRosterPlayerId(value: string): string {
  return String(value).replace(/^nhl:/, '');
}

export function countRosterPositions(players: Array<Pick<PlayerSearchResult, 'pos'>>): Record<RosterPosition, number> {
  return Object.fromEntries(ROSTER_POSITIONS.map((position) => [
    position,
    players.filter((player) => player.pos.includes(position)).length,
  ])) as Record<RosterPosition, number>;
}

export function getPositionLineupSlots(position: RosterPosition, leagueProfile: LeagueProfile | null): number {
  const fallback: Record<RosterPosition, number> = { C: 2, LW: 2, RW: 2, D: 4, G: 2 };
  const lineup = leagueProfile?.lineup_slots;
  if (!lineup) return fallback[position];

  const direct = Number(lineup[position] ?? 0);
  const forwardFlex = ['C', 'LW', 'RW'].includes(position) ? Number(lineup.F ?? 0) : 0;
  const utility = position !== 'G' ? Number(lineup.UTIL ?? 0) : 0;
  return Math.max(1, direct + forwardFlex + utility || fallback[position]);
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanSourceLine(value: string): string {
  return value
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/\u00a0/g, ' ')
    .trim();
}

export function mergeRosterImportText(currentText: string, additions: string[]): string {
  const merged: string[] = [];
  const seen = new Set<string>();
  [...currentText.split(/\r?\n/), ...additions].forEach((value) => {
    const cleaned = cleanSourceLine(value);
    const key = normalize(cleaned);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(cleaned);
  });
  return merged.join('\n');
}

function identityValues(player: PlayerSearchResult): string[] {
  return [player.name, ...(player.aliases ?? [])]
    .map(normalize)
    .filter(Boolean);
}

function containsIdentity(source: string, identity: string): boolean {
  return source === identity || ` ${source} `.includes(` ${identity} `);
}

export function findRosterImportCandidates(
  players: PlayerSearchResult[],
  rawQuery: string,
  limit = 6,
): PlayerSearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];

  return players
    .map((player) => {
      const identities = identityValues(player);
      const score = identities.reduce((best, identity) => {
        if (identity === query) return Math.min(best, 0);
        if (identity.startsWith(query)) return Math.min(best, 1);
        const identityParts = identity.split(' ');
        if (identityParts[identityParts.length - 1] === query) return Math.min(best, 2);
        if (identity.includes(query)) return Math.min(best, 3);
        return best;
      }, 99);
      return { player, score };
    })
    .filter(({ score }) => score < 99)
    .sort((a, b) =>
      a.score - b.score ||
      (b.player.blendedFppg ?? -1) - (a.player.blendedFppg ?? -1) ||
      a.player.name.localeCompare(b.player.name)
    )
    .slice(0, limit)
    .map(({ player }) => player);
}

export function buildRosterImportRows(
  players: PlayerSearchResult[],
  text: string,
  existingPlayerIds: Iterable<string> = [],
): RosterImportRow[] {
  const existing = new Set([...existingPlayerIds].map(normalizeRosterPlayerId));
  const claimed = new Set<string>();
  const lines = text.split(/\r?\n/).map(cleanSourceLine).filter(Boolean);

  return lines.map((source, index) => {
    const normalizedSource = normalize(source);
    const embedded = players
      .map((player) => ({
        player,
        matchLength: Math.max(
          ...identityValues(player)
            .filter((identity) => containsIdentity(normalizedSource, identity))
            .map((identity) => identity.length),
          0,
        ),
      }))
      .filter(({ matchLength }) => matchLength > 0);
    const longestMatch = Math.max(...embedded.map(({ matchLength }) => matchLength), 0);
    const exactCandidates = embedded
      .filter(({ matchLength }) => matchLength === longestMatch)
      .map(({ player }) => player);
    const candidates = exactCandidates.length > 0
      ? exactCandidates
      : findRosterImportCandidates(players, source);
    const exactPlayer = exactCandidates.length === 1 ? exactCandidates[0] : null;
    const canonicalPlayerId = exactPlayer ? normalizeRosterPlayerId(exactPlayer.id) : null;
    const isDuplicate = exactPlayer && canonicalPlayerId && (existing.has(canonicalPlayerId) || claimed.has(canonicalPlayerId));

    if (canonicalPlayerId && !isDuplicate) claimed.add(canonicalPlayerId);

    return {
      key: `row-${index}`,
      source,
      status: isDuplicate
        ? 'duplicate'
        : exactPlayer
          ? 'matched'
          : candidates.length > 0
            ? 'ambiguous'
            : 'unmatched',
      candidates,
      selectedPlayerId: exactPlayer?.id ?? null,
    };
  });
}
