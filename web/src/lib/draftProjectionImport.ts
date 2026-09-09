import type { DraftPlayer } from './playerSearch';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/^nhl:/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface ProjectionImportResult {
  projections: Record<string, number>;
  unmatched: string[];
  ambiguous: string[];
}

export function parseDraftProjectionImport(text: string, players: DraftPlayer[]): ProjectionImportResult {
  const byKey = new Map<string, DraftPlayer[]>();
  for (const player of players) {
    for (const key of [player.id, player.name, ...(player.aliases ?? [])].map(normalize).filter(Boolean)) {
      byKey.set(key, [...(byKey.get(key) ?? []), player]);
    }
  }

  const projections: Record<string, number> = {};
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    if (!rawLine.trim()) continue;
    const cells = rawLine.split(rawLine.includes('\t') ? '\t' : ',').map((cell) => cell.trim());
    const fppg = Number(cells[cells.length - 1]);
    if (index === 0 && !Number.isFinite(fppg)) continue;
    const lookup = normalize(cells.slice(0, -1).join(' '));
    const matches = [...new Map((byKey.get(lookup) ?? []).map((player) => [player.id, player])).values()];
    if (!Number.isFinite(fppg) || fppg <= 0 || matches.length === 0) unmatched.push(rawLine);
    else if (matches.length > 1) ambiguous.push(rawLine);
    else projections[matches[0].id.replace(/^nhl:/, '')] = fppg;
  }
  return { projections, unmatched, ambiguous };
}
