import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readCacheJson } from '../lib/cache';
import { Player } from '../models/types';

interface PlayerPayload extends Player {
  aliases?: string[];
}

interface AliasConfig {
  team?: string;
  aliases: string[];
}

interface ResolveInput {
  name: string;
  team?: string;
}

interface ResolveResult {
  player: Player;
  confidence: number;
  source: 'canonical' | 'alias' | 'fuzzy';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const LOGS_DIR = join(__dirname, '..', '..', 'logs');
const LOG_PATH = join(LOGS_DIR, 'aliases_pending.csv');

let playerFallbackWarned = false;
let aliasFallbackWarned = false;

function loadPlayers(): { players: PlayerPayload[] } {
  try {
    return readCacheJson<{ players: PlayerPayload[] }>('players.json');
  } catch (error) {
    if (!playerFallbackWarned) {
      console.warn('[alias] Falling back to bundled players.json:', error instanceof Error ? error.message : error);
      playerFallbackWarned = true;
    }
    return JSON.parse(readFileSync(join(DATA_DIR, 'players.json'), 'utf8')) as { players: PlayerPayload[] };
  }
}

function loadAliasConfig(): Record<string, AliasConfig> {
  try {
    return readCacheJson<Record<string, AliasConfig>>('aliases.json');
  } catch (error) {
    if (!aliasFallbackWarned) {
      console.warn('[alias] Using bundled aliases.json:', error instanceof Error ? error.message : error);
      aliasFallbackWarned = true;
    }
    if (existsSync(join(DATA_DIR, 'aliases.json'))) {
      return JSON.parse(readFileSync(join(DATA_DIR, 'aliases.json'), 'utf8')) as Record<string, AliasConfig>;
    }
    return {};
  }
}

const playersPayload = loadPlayers();
const aliasConfig = loadAliasConfig();

const canonicalById = new Map<string, PlayerPayload>();
const aliasIndex = new Map<string, PlayerPayload>();

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

for (const player of playersPayload.players) {
  canonicalById.set(player.id, player);
  aliasIndex.set(normalize(player.name), player);
  for (const alias of player.aliases ?? []) {
    aliasIndex.set(normalize(alias), player);
  }
}

for (const [playerId, config] of Object.entries(aliasConfig)) {
  const canonical = canonicalById.get(playerId);
  if (!canonical) {
    continue;
  }
  for (const alias of config.aliases) {
    aliasIndex.set(normalize(alias), canonical);
  }
}

function computeConfidence(input: ResolveInput, candidate: PlayerPayload): number {
  const normalizedInput = normalize(input.name);
  const normalizedCandidate = normalize(candidate.name);

  if (normalizedInput === normalizedCandidate) {
    return 1;
  }

  const tokensInput = tokenize(input.name);
  const tokensCandidate = tokenize(candidate.name);

  if (!tokensInput.length || !tokensCandidate.length) {
    return 0;
  }

  let matches = 0;
  for (const token of tokensInput) {
    if (tokensCandidate.includes(token)) {
      matches += 1;
    }
  }
  let score = matches / tokensCandidate.length;

  const inputFirst = tokensInput[0]?.[0];
  const candidateFirst = tokensCandidate[0]?.[0];
  if (inputFirst && candidateFirst && inputFirst === candidateFirst) {
    score += 0.2;
  }

  const lastInput = tokensInput[tokensInput.length - 1];
  const lastCandidate = tokensCandidate[tokensCandidate.length - 1];
  if (lastInput && lastCandidate && lastInput === lastCandidate) {
    score += 0.15;
  }

  if (input.team && input.team.toUpperCase() === candidate.team.toUpperCase()) {
    score += 0.15;
  }

  return Math.min(Number(score.toFixed(2)), 1);
}

function ensureLogHeader(): void {
  if (existsSync(LOG_PATH)) {
    return;
  }
  mkdirSync(LOGS_DIR, { recursive: true });
  appendFileSync(LOG_PATH, 'timestamp,name,team,best_match,confidence\n', 'utf8');
}

function logPending(input: ResolveInput, candidate: PlayerPayload | null, confidence: number): void {
  ensureLogHeader();
  const row = [
    new Date().toISOString(),
    JSON.stringify(input.name),
    JSON.stringify(input.team ?? ''),
    JSON.stringify(candidate?.id ?? ''),
    confidence ? confidence.toFixed(2) : ''
  ].join(',');
  appendFileSync(LOG_PATH, `\n${row}`, 'utf8');
}

export function resolveAlias(input: ResolveInput): ResolveResult | null {
  const normalizedInput = normalize(input.name);
  const direct = aliasIndex.get(normalizedInput);
  if (direct) {
    const confidence = input.team && input.team.toUpperCase() !== direct.team.toUpperCase() ? 0.85 : 1;
    return {
      player: {
        id: direct.id,
        name: direct.name,
        team: direct.team,
        pos: [...direct.pos],
        rosteredPct: direct.rosteredPct
      },
      confidence,
      source: direct.aliases?.some((alias) => normalize(alias) === normalizedInput) ? 'alias' : 'canonical'
    };
  }

  let bestCandidate: PlayerPayload | null = null;
  let bestScore = 0;

  for (const candidate of canonicalById.values()) {
    const score = computeConfidence(input, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate || bestScore < 0.8) {
    logPending(input, bestCandidate, bestScore);
    return null;
  }

  return {
    player: {
      id: bestCandidate.id,
      name: bestCandidate.name,
      team: bestCandidate.team,
      pos: [...bestCandidate.pos],
      rosteredPct: bestCandidate.rosteredPct
    },
    confidence: bestScore,
    source: 'fuzzy'
  };
}

export function getCanonicalPlayer(playerId: string): Player | null {
  const candidate = canonicalById.get(playerId);
  if (!candidate) {
    return null;
  }
  return {
    id: candidate.id,
    name: candidate.name,
    team: candidate.team,
    pos: [...candidate.pos],
    rosteredPct: candidate.rosteredPct
  };
}
