type DateStr = string;
type TeamId = number;

const cache: Record<string, Set<DateStr>> = {};

export async function getTeamDatesCached(
  teamId: TeamId, 
  start: DateStr, 
  end: DateStr,
  fetchTeamDates: (teamId: TeamId, start: DateStr, end: DateStr) => Promise<Set<DateStr>>
): Promise<Set<DateStr>> {
  const key = `${teamId}:${start}:${end}`;
  
  if (cache[key]) {
    return cache[key];
  }
  
  const dates = await fetchTeamDates(teamId, start, end);
  cache[key] = dates;
  return dates;
}

export function clearCache(): void {
  Object.keys(cache).forEach(key => delete cache[key]);
}