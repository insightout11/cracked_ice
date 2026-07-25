const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface TeamTierWindowQuery {
  start?: unknown;
  end?: unknown;
  playoffStart?: unknown;
  playoffEnd?: unknown;
}

export interface TeamTierWindow {
  start: string;
  end: string;
  playoffStart: string;
  playoffEnd: string;
}

function validDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return fallback;
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? fallback : value;
}

export function resolveTeamTierWindow(
  query: TeamTierWindowQuery,
  seasonStart: string,
  seasonEnd: string,
  fallbackPlayoffStart: string,
): TeamTierWindow {
  const start = validDate(query.start, seasonStart);
  const end = validDate(query.end, seasonEnd);
  const boundedStart = start <= end ? start : seasonStart;
  const boundedEnd = start <= end ? end : seasonEnd;
  const requestedPlayoffStart = validDate(query.playoffStart, fallbackPlayoffStart);
  const requestedPlayoffEnd = validDate(query.playoffEnd, boundedEnd);
  const playoffStart = requestedPlayoffStart < boundedStart
    ? boundedStart
    : requestedPlayoffStart > boundedEnd
      ? boundedEnd
      : requestedPlayoffStart;
  const playoffEnd = requestedPlayoffEnd < playoffStart
    ? playoffStart
    : requestedPlayoffEnd > boundedEnd
      ? boundedEnd
      : requestedPlayoffEnd;

  return {
    start: boundedStart,
    end: boundedEnd,
    playoffStart,
    playoffEnd,
  };
}

export function splitTeamTierDates(dates: Iterable<string>, window: TeamTierWindow) {
  const inSeason = Array.from(dates).filter(date => date >= window.start && date <= window.end);

  return {
    regularSeasonDates: inSeason.filter(date => date < window.playoffStart),
    playoffDates: inSeason.filter(date => date >= window.playoffStart && date <= window.playoffEnd),
  };
}
