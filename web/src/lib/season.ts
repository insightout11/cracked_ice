// Season config for the frontend.
// Single source of truth: config/season.json (repo root), imported directly
// (Vite inlines it at build). Rolling to a new season means editing that one
// file — see the root README.
import seasonConfig from '../../../config/season.json';

export interface SeasonConfig {
  seasonId: string;
  label: string;
  regularSeasonStart: string;
  regularSeasonEnd: string;
  gamesPerTeam: number;
  defaultFantasyPlayoffsStart: string;
  defaultFantasyPlayoffsEnd: string;
  scheduleFile: string;
}

export const SEASON: SeasonConfig = seasonConfig;

export const SEASON_ID = SEASON.seasonId;
export const SEASON_LABEL = SEASON.label;
export const SEASON_START = SEASON.regularSeasonStart;
/** Games each team plays in the configured season (84 from 2026-27, 82 before). */
export const SEASON_GAMES_PER_TEAM = SEASON.gamesPerTeam;

/**
 * Games a team played in the season a stat block came from. Goalie workload has to
 * be measured against team games, not the goalie's own appearances.
 */
export const teamGamesForSeason = (statsSeasonId?: string): number =>
  !statsSeasonId || statsSeasonId === SEASON.seasonId ? SEASON.gamesPerTeam : 82;
export const SEASON_END = SEASON.regularSeasonEnd;
export const SCHEDULE_URL = `/${SEASON.scheduleFile}`;

export const seasonStartDate = (): Date => new Date(SEASON.regularSeasonStart);
export const seasonEndDate = (): Date => new Date(SEASON.regularSeasonEnd);

// Number of fantasy weeks the regular season spans (used for the "Season End"
// range preset). Derived so it tracks the configured season bounds.
export const seasonWeeks = Math.ceil(
  (seasonEndDate().getTime() - seasonStartDate().getTime()) / (7 * 24 * 60 * 60 * 1000)
);

// Player headshot mugshots are published per season by the NHL CDN.
export const mugshotSeason = SEASON.seasonId;
