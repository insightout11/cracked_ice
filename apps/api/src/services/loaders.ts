import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { FreeAgents, LeagueProfile, Player, Roster } from '../models/types';
import { getBlendedFppg } from './stats';

export const MAX_FREE_AGENTS = 30;
export const MAX_DROP_POOL = 8;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');

const USER_FIXTURES: Record<string, {
  league: string;
  roster: string;
  freeAgents: string;
}> = {
  demo: {
    league: 'fixtures/league.demo.json',
    roster: 'fixtures/roster.me.json',
    freeAgents: 'fixtures/free_agents.me.json'
  }
};

export class UserDataError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'UserDataError';
  }
}

function getUserFixtures(userId: string) {
  const fixtures = USER_FIXTURES[userId];
  if (!fixtures) {
    throw new UserDataError(`No fixtures available for user ${userId}`);
  }
  return fixtures;
}

function readJson<T>(relativePath: string): T {
  const payload = readFileSync(join(DATA_DIR, relativePath), 'utf8');
  return JSON.parse(payload) as T;
}

export function loadLeagueProfile(userId: string): LeagueProfile {
  const fixtures = getUserFixtures(userId);
  return readJson<LeagueProfile>(fixtures.league);
}

export function loadRoster(userId: string): Roster {
  const fixtures = getUserFixtures(userId);
  return readJson<Roster>(fixtures.roster);
}

export function loadFreeAgents(userId: string): FreeAgents {
  const fixtures = getUserFixtures(userId);
  const data = readJson<FreeAgents>(fixtures.freeAgents);
  if (data.candidates.length > MAX_FREE_AGENTS) {
    console.warn(`[coach] trimming free agents from ${data.candidates.length} to ${MAX_FREE_AGENTS}`);
  }
  return {
    ...data,
    candidates: data.candidates.slice(0, MAX_FREE_AGENTS)
  };
}

export function buildDropPool(players: Player[]): Player[] {
  const sorted = [...players].sort(
    (a, b) => getBlendedFppg(a.id) - getBlendedFppg(b.id)
  );
  return sorted.slice(0, MAX_DROP_POOL);
}