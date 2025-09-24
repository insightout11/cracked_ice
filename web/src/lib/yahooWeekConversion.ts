/**
 * Yahoo Week Conversion Utilities
 *
 * Due to the 2026 Olympics break in February, Yahoo Fantasy Hockey counts
 * the extended break as one long week, which shifts all subsequent week
 * numbers down by approximately 3 weeks compared to standard NHL calendar.
 */

/**
 * Convert NHL site week number to Yahoo equivalent
 * Due to Olympics break compression, Yahoo weeks are approximately 3 lower
 */
export function convertSiteWeekToYahoo(siteWeek: number): number {
  // Olympics break causes ~3 week shift
  const YAHOO_WEEK_OFFSET = 3;
  return Math.max(1, siteWeek - YAHOO_WEEK_OFFSET);
}

/**
 * Convert Yahoo week number to NHL site equivalent
 */
export function convertYahooWeekToSite(yahooWeek: number): number {
  const YAHOO_WEEK_OFFSET = 3;
  return yahooWeek + YAHOO_WEEK_OFFSET;
}

/**
 * Convert an array of site weeks to Yahoo equivalents
 */
export function convertSiteWeeksToYahoo(siteWeeks: number[]): number[] {
  return siteWeeks.map(convertSiteWeekToYahoo);
}

/**
 * Format week range with both site and Yahoo numbers
 */
export function formatWeekRangeWithYahoo(startWeek: number, endWeek: number): string {
  const yahooStart = convertSiteWeekToYahoo(startWeek);
  const yahooEnd = convertSiteWeekToYahoo(endWeek);

  if (startWeek === endWeek) {
    return `Week ${startWeek} (Yahoo: ${yahooStart})`;
  }

  return `Weeks ${startWeek}-${endWeek} (Yahoo: ${yahooStart}-${yahooEnd})`;
}

/**
 * Get conversion explanation text
 */
export const YAHOO_WEEK_EXPLANATION = {
  title: "Yahoo Week Numbering Difference",
  description: "Due to the 2026 Olympics break in February, Yahoo counts the extended break as one long week. This makes Yahoo's playoff weeks about 3 numbers lower than standard NHL calendar weeks.",
  example: "If your Yahoo league playoffs are weeks 21-23, use our site's weeks 24-26.",
  tip: "Always verify using actual dates - if your Yahoo playoffs end April 5th, that matches our week 26 end date."
} as const;

/**
 * Common playoff week conversions
 */
export const COMMON_CONVERSIONS = [
  { site: [24, 25, 26], yahoo: [21, 22, 23], label: "Standard 3-week playoffs" },
  { site: [25, 26, 27], yahoo: [22, 23, 24], label: "Late-season playoffs" },
  { site: [22, 23, 24], yahoo: [19, 20, 21], label: "Early playoffs" },
] as const;