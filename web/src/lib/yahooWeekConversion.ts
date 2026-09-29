/**
 * Yahoo week numbers vs ours.
 *
 * Both count the week holding opening night as week 1, so in a normal season the numbers
 * match. A long break Yahoo folds into one week (2025-26's Olympics) pushes Yahoo's numbers
 * behind ours; config/season.json's yahooWeekOffset says by how many for the season.
 */
import { SEASON } from './season';

const YAHOO_WEEK_OFFSET = SEASON.yahooWeekOffset ?? 0;

/** True when Yahoo numbers this season's weeks differently from us. */
export function yahooWeeksDiffer(): boolean {
  return YAHOO_WEEK_OFFSET !== 0;
}

/** Our week number to Yahoo's. */
export function convertSiteWeekToYahoo(siteWeek: number): number {
  return Math.max(1, siteWeek - YAHOO_WEEK_OFFSET);
}

/** Yahoo's week number to ours. */
export function convertYahooWeekToSite(yahooWeek: number): number {
  return yahooWeek + YAHOO_WEEK_OFFSET;
}

export function convertSiteWeeksToYahoo(siteWeeks: number[]): number[] {
  return siteWeeks.map(convertSiteWeekToYahoo);
}

/** "Weeks 26-28", with Yahoo's numbers alongside only in a season they differ. */
export function formatWeekRangeWithYahoo(startWeek: number, endWeek: number): string {
  const site = startWeek === endWeek ? `Week ${startWeek}` : `Weeks ${startWeek}-${endWeek}`;
  if (!yahooWeeksDiffer()) return site;
  const yahooStart = convertSiteWeekToYahoo(startWeek);
  const yahooEnd = convertSiteWeekToYahoo(endWeek);
  return `${site} (Yahoo: ${startWeek === endWeek ? yahooStart : `${yahooStart}-${yahooEnd}`})`;
}

/** Shown only when yahooWeeksDiffer(). */
export const YAHOO_WEEK_EXPLANATION = {
  title: 'Yahoo week numbering difference',
  short: `Yahoo's week numbers are ${Math.abs(YAHOO_WEEK_OFFSET)} ${YAHOO_WEEK_OFFSET > 0 ? 'lower' : 'higher'} than ours this season.`,
  description: `Yahoo counts a long break as one week this season, so its week numbers run ${Math.abs(YAHOO_WEEK_OFFSET)} ${YAHOO_WEEK_OFFSET > 0 ? 'behind' : 'ahead of'} ours after it.`,
  example: `If your Yahoo playoffs are weeks ${convertSiteWeekToYahoo(26)}-${convertSiteWeekToYahoo(28)}, pick our weeks 26-28.`,
  tip: 'When in doubt, match by dates: the week ranges are listed beside each number.',
} as const;

/** A few playoff windows in both numberings, for the explanation. */
export const COMMON_CONVERSIONS = [[24, 26], [25, 27], [26, 28]].map(([first, last]) => {
  const site = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  return { site, yahoo: convertSiteWeeksToYahoo(site), label: `Weeks ${first}-${last}` };
});
