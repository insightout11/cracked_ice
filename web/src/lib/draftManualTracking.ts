import type { DraftPlayer } from './playerSearch';

export type ManualDraftImportState = 'matched' | 'already-drafted' | 'duplicate' | 'unresolved';

export interface ManualDraftImportRow {
  raw: string;
  state: ManualDraftImportState;
  player?: DraftPlayer;
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

export function splitDraftImportText(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return text.split(/[;,]+/).map((entry) => entry.trim()).filter(Boolean);
}

export function previewManualDraftImport(
  text: string,
  players: DraftPlayer[],
  draftedPlayerIds: Iterable<string>,
): ManualDraftImportRow[] {
  const drafted = new Set([...draftedPlayerIds].map(normalizeId));
  const seen = new Set<string>();
  const directory = players.map((player) => ({ player, normalizedName: normalize(player.name) }));

  return splitDraftImportText(text).map((raw) => {
    const normalizedRaw = ` ${normalize(raw)} `;
    const matches = directory.filter(({ normalizedName }) =>
      normalizedName.length >= 4 && normalizedRaw.includes(` ${normalizedName} `));
    if (matches.length !== 1) return { raw, state: 'unresolved' };
    const player = matches[0].player;
    const id = normalizeId(player.id);
    if (drafted.has(id)) return { raw, state: 'already-drafted', player };
    if (seen.has(id)) return { raw, state: 'duplicate', player };
    seen.add(id);
    return { raw, state: 'matched', player };
  });
}

export function findQuickDraftPlayers(
  query: string,
  players: DraftPlayer[],
  draftedPlayerIds: Iterable<string>,
  limit = 5,
): DraftPlayer[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];
  const drafted = new Set([...draftedPlayerIds].map(normalizeId));
  return players
    .filter((player) => !drafted.has(normalizeId(player.id)))
    .map((player) => {
      const name = normalize(player.name);
      const team = normalize(player.team);
      const score = name === normalizedQuery ? 0 : name.startsWith(normalizedQuery) ? 1 : name.includes(normalizedQuery) ? 2 : team === normalizedQuery ? 3 : 99;
      return { player, score };
    })
    .filter(({ score }) => score < 99)
    .sort((a, b) => a.score - b.score || (b.player.blendedFppg ?? 0) - (a.player.blendedFppg ?? 0) || a.player.name.localeCompare(b.player.name))
    .slice(0, limit)
    .map(({ player }) => player);
}
