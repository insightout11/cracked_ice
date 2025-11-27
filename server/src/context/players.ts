import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PLAYERS_PATH } from '../../../apps/api/src/config/cachePaths';

export interface PlayerDirectoryEntry {
  id: string;
  name: string;
  team: string;
  pos: string[];
  aliases: string[];
}

interface PlayersFile {
  generatedAt?: string;
  players?: Array<{
    id: string;
    name: string;
    team: string;
    pos: string[];
    aliases?: string[];
  }>;
}

export interface PlayersContext {
  meta: {
    sourcePath: string;
    generatedAt: string | null;
    playerCount: number;
  };
  entries: PlayerDirectoryEntry[];
}


const LEGACY_PLAYER_PATHS = [
  join(process.cwd(), 'apps', 'api', 'cache', 'players.json'),
  join(process.cwd(), 'server', 'data', 'players.json')
];

let warnedLegacyPlayers = false;

const PLAYERS_PATH_CANDIDATES = [
  PLAYERS_PATH,
  ...LEGACY_PLAYER_PATHS,
  typeof __dirname === 'string' ? join(__dirname, '..', 'data', 'players.json') : undefined,
  join(process.cwd(), 'data', 'players.json'),
  join(process.cwd(), 'apps', 'api', 'src', 'data', 'players.json')
].filter((candidate): candidate is string => Boolean(candidate));

function resolvePlayersPath(): string {
  if (existsSync(PLAYERS_PATH)) {
    return PLAYERS_PATH;
  }

  const legacyPath = LEGACY_PLAYER_PATHS.find((candidate) => existsSync(candidate));
  if (legacyPath) {
    if (!warnedLegacyPlayers) {
      warnedLegacyPlayers = true;
      console.warn('[players] Using legacy player source:', legacyPath);
    }
    return legacyPath;
  }

  const fallback = PLAYERS_PATH_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!fallback) {
    throw new Error(
      `Player directory not found. Checked: ${PLAYERS_PATH_CANDIDATES.join(', ')}`
    );
  }
  return fallback;
}

function normaliseEntry(raw: PlayerDirectoryEntry): PlayerDirectoryEntry {
  return {
    ...raw,
    aliases: raw.aliases.filter(Boolean)
  };
}

export function loadPlayers(): PlayersContext {
  console.log('[players] Loading players...');
  console.log('[players] Checking paths:', PLAYERS_PATH_CANDIDATES);
  console.log('[players] cwd:', process.cwd());

  const path = resolvePlayersPath();
  console.log('[players] Resolved path:', path);

  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as PlayersFile;
  const players = Array.isArray(parsed.players) ? parsed.players : [];

  const entries = players.map((player) => normaliseEntry({
    id: player.id,
    name: player.name,
    team: player.team,
    pos: player.pos,
    aliases: Array.isArray(player.aliases) ? player.aliases : []
  }));

  console.log('[players] Loaded', entries.length, 'players from', path);

  return {
    meta: {
      sourcePath: path,
      generatedAt: parsed.generatedAt ?? null,
      playerCount: entries.length
    },
    entries
  };
}

function scoreCandidate(query: string, entry: PlayerDirectoryEntry): number {
  const normalized = query.toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);

  const name = entry.name.toLowerCase();
  const aliases = entry.aliases.map((alias) => alias.toLowerCase());
  const team = entry.team.toLowerCase();
  const nameParts = name.split(/\s+/).filter(Boolean);
  const lastName = nameParts[nameParts.length - 1];

  let score = 0;

  if (entry.id.toLowerCase() === normalized) {
    score += 6;
  }
  if (name === normalized) {
    score += 5;
  } else if (name.startsWith(normalized)) {
    score += 4;
  } else if (name.includes(normalized)) {
    score += 2;
  }

  for (const alias of aliases) {
    if (alias === normalized) {
      score += 4;
    } else if (alias.startsWith(normalized)) {
      score += 3;
    } else if (alias.includes(normalized)) {
      score += 1;
    }
  }

  for (const token of tokens) {
    if (!token) continue;
    // Exact last name match gets high priority
    if (lastName === token) {
      score += 3;
    }
    // Partial name match
    else if (name.includes(token)) {
      score += 1;
    }
    if (aliases.some((alias) => alias.includes(token))) {
      score += 1;
    }
    if (team === token) {
      score += 1;
    }
  }

  return score;
}

export function searchPlayers(
  query: string,
  context: PlayersContext,
  limit = 10
): PlayerDirectoryEntry[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const normalized = trimmed.toLowerCase();
  if (normalized.length < 2 && !/^[a-z]$/.test(normalized)) {
    // Guard against noisy single character lookups
    return [];
  }

  const ranked = context.entries
    .map((entry) => ({ entry, score: scoreCandidate(normalized, entry) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, Math.max(1, limit));

  return ranked.map((candidate) => candidate.entry);
}

