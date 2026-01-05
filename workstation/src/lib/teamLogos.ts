// NHL team logo URLs from NHL API
export function getTeamLogoUrl(teamAbbr: string): string {
  // NHL team IDs mapping
  const teamIds: Record<string, number> = {
    'ANA': 24, 'ARI': 53, 'BOS': 6, 'BUF': 7, 'CAR': 12, 'CBJ': 29,
    'CGY': 20, 'CHI': 16, 'COL': 21, 'DAL': 25, 'DET': 17, 'EDM': 22,
    'FLA': 13, 'LAK': 26, 'MIN': 30, 'MTL': 8, 'NJD': 1, 'NSH': 18,
    'NYI': 2, 'NYR': 3, 'OTT': 9, 'PHI': 4, 'PIT': 5, 'SEA': 55,
    'SJS': 28, 'STL': 19, 'TBL': 14, 'TOR': 10, 'UTA': 59, 'VAN': 23,
    'VGK': 54, 'WPG': 52, 'WSH': 15,
  };

  const teamId = teamIds[teamAbbr];
  if (!teamId) {
    // Fallback to a generic hockey icon
    return `https://www-league.nhlstatic.com/images/logos/league-dark/133-flat.svg`;
  }

  return `https://assets.nhle.com/logos/nhl/svg/${teamAbbr}_light.svg`;
}

export function getTeamColor(teamAbbr: string): string {
  const colors: Record<string, string> = {
    'ANA': '#F47A38', 'ARI': '#8C2633', 'BOS': '#FFB81C', 'BUF': '#002654',
    'CAR': '#CC0000', 'CBJ': '#002654', 'CGY': '#C8102E', 'CHI': '#CF0A2C',
    'COL': '#6F263D', 'DAL': '#006847', 'DET': '#CE1126', 'EDM': '#FF4C00',
    'FLA': '#041E42', 'LAK': '#111111', 'MIN': '#154734', 'MTL': '#AF1E2D',
    'NJD': '#CE1126', 'NSH': '#FFB81C', 'NYI': '#00539B', 'NYR': '#0038A8',
    'OTT': '#C52032', 'PHI': '#F74902', 'PIT': '#000000', 'SEA': '#001628',
    'SJS': '#006D75', 'STL': '#002F87', 'TBL': '#002868', 'TOR': '#00205B',
    'UTA': '#69B3E7', 'VAN': '#00205B', 'VGK': '#B4975A', 'WPG': '#041E42',
    'WSH': '#C8102E',
  };

  return colors[teamAbbr] || '#666666';
}
