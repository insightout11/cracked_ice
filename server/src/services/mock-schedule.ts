// Realistic mock schedule data generator for demo purposes

export function generateMockScheduleDates(
  teamId: number, 
  startDate: string, 
  endDate: string
): Set<string> {
  const dates = new Set<string>();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Generate games roughly every 2-3 days with some variation
  let current = new Date(start);
  const msPerDay = 24 * 60 * 60 * 1000;
  
  while (current <= end) {
    // Skip some dates to simulate realistic schedule gaps
    const skipDays = Math.floor(Math.random() * 4); // 0-3 day gaps
    
    if (skipDays === 0) {
      // Team has a game this day
      dates.add(current.toISOString().split('T')[0]);
    }
    
    // Move to next day
    current = new Date(current.getTime() + msPerDay);
  }
  
  return dates;
}

// Generate different patterns for different teams to create realistic complements
export function generateTeamSpecificSchedule(
  teamId: number, 
  startDate: string, 
  endDate: string
): Set<string> {
  const dates = new Set<string>();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Create different schedule patterns based on team ID
  const pattern = teamId % 4;
  
  let current = new Date(start);
  const msPerDay = 24 * 60 * 60 * 1000;
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const shouldHaveGame = getGameProbability(pattern, dayOfWeek);
    
    if (Math.random() < shouldHaveGame) {
      dates.add(current.toISOString().split('T')[0]);
    }
    
    current = new Date(current.getTime() + msPerDay);
  }
  
  return dates;
}

function getGameProbability(pattern: number, dayOfWeek: number): number {
  // Create different schedule patterns
  switch (pattern) {
    case 0: // Heavy weekday team
      return dayOfWeek >= 1 && dayOfWeek <= 5 ? 0.4 : 0.1;
    case 1: // Heavy weekend team  
      return dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 0.2;
    case 2: // Balanced team
      return 0.35;
    case 3: // Tuesday/Thursday heavy
      return dayOfWeek === 2 || dayOfWeek === 4 ? 0.5 : 0.25;
    default:
      return 0.3;
  }
}