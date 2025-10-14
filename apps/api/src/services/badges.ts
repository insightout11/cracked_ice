import { Window } from '../models/types';
import { getTeamGames } from './schedule';

type Tier = 'Cyan' | 'Blue' | 'Green' | 'Red';

const TEAM_TIERS: Record<string, Tier> = {
  STL: 'Cyan',
  PHI: 'Blue',
  BUF: 'Green',
  NYR: 'Green'
};

const PP1_PLAYERS = new Set<string>(['nhl:8479343']);

export function tierBadge(team: string): Tier {
  return TEAM_TIERS[team] ?? 'Green';
}

export function roleBadges(playerId: string): string[] {
  return PP1_PLAYERS.has(playerId) ? ['PP1'] : [];
}

export function b2bBadges(team: string, window: Window): string[] {
  const games = getTeamGames(team, window).sort();
  for (let i = 1; i < games.length; i += 1) {
    const prev = new Date(`${games[i - 1]}T00:00:00Z`).getTime();
    const current = new Date(`${games[i]}T00:00:00Z`).getTime();
    if (current - prev === 86_400_000) {
      return ['B2B'];
    }
  }
  return [];
}
