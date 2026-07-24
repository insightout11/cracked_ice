// Season config for the serverless analysis functions.
// Single source of truth: config/season.json (repo root). Rolling to a new
// season means editing that one file — see the root README.
import { readFileSync } from 'fs';
import { join } from 'path';

const seasonConfig = JSON.parse(
  readFileSync(join(process.cwd(), 'config', 'season.json'), 'utf8')
);

export interface SeasonConfig {
  seasonId: string;
  label: string;
  regularSeasonStart: string;
  regularSeasonEnd: string;
  gamesPerTeam: number;
  defaultFantasyPlayoffsStart: string;
  scheduleFile: string;
}

export const SEASON: SeasonConfig = seasonConfig;

export const SEASON_ID = SEASON.seasonId;
export const SEASON_LABEL = SEASON.label;
export const SEASON_START = SEASON.regularSeasonStart;
export const SEASON_END = SEASON.regularSeasonEnd;
export const SCHEDULE_FILE = SEASON.scheduleFile;
