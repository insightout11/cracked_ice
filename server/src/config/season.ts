// Season config for the coach backend.
// Single source of truth: config/season.json (repo root), imported directly so
// tsc bundles it into server/dist. Rolling to a new season means editing that
// one file — see the root README.
import seasonConfig from '../../../config/season.json';

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

/**
 * The last day of the "before playoffs" window: the day before the season's configured
 * fantasy playoffs start (2027-03-21 for 2026-27). One date for every endpoint, instead of
 * each counting its own week number from the opener.
 */
export const BEFORE_PLAYOFFS_END = (() => {
  const day = new Date(`${SEASON.defaultFantasyPlayoffsStart}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
})();
