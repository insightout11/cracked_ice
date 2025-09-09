// NHL team ID mapping for official logo URLs (based on actual API data)
const teamIdMap: Record<string, number> = {
  'ANA': 24, // Anaheim Ducks
  'BOS': 6,  // Boston Bruins
  'BUF': 7,  // Buffalo Sabres
  'CAR': 12, // Carolina Hurricanes
  'CBJ': 28, // Columbus Blue Jackets
  'CGY': 20, // Calgary Flames
  'CHI': 16, // Chicago Blackhawks
  'COL': 21, // Colorado Avalanche
  'DAL': 25, // Dallas Stars
  'DET': 17, // Detroit Red Wings
  'EDM': 22, // Edmonton Oilers
  'FLA': 13, // Florida Panthers
  'LAK': 26, // Los Angeles Kings
  'MIN': 29, // Minnesota Wild
  'MTL': 8,  // Montreal Canadiens
  'NJD': 1,  // New Jersey Devils
  'NSH': 18, // Nashville Predators
  'NYI': 2,  // New York Islanders
  'NYR': 3,  // New York Rangers
  'OTT': 9,  // Ottawa Senators
  'PHI': 4,  // Philadelphia Flyers
  'PIT': 5,  // Pittsburgh Penguins
  'SEA': 54, // Seattle Kraken
  'SJS': 27, // San Jose Sharks
  'STL': 19, // St. Louis Blues
  'TBL': 14, // Tampa Bay Lightning
  'TOR': 10, // Toronto Maple Leafs
  'UTA': 55, // Utah Hockey Club (formerly Arizona)
  'VAN': 23, // Vancouver Canucks
  'VGK': 53, // Vegas Golden Knights
  'WPG': 30, // Winnipeg Jets
  'WSH': 15  // Washington Capitals
};

// Get team logo URL using official NHL team IDs
export const getTeamLogoUrl = (abbreviation: string): string => {
  const teamId = teamIdMap[abbreviation];
  if (!teamId) {
    console.warn(`No team ID found for abbreviation: ${abbreviation}`);
    return ''; // Return empty string for missing teams
  }
  
  console.log(`Getting logo for: ${abbreviation}`);
  
  // Handle special cases and ESPN abbreviation differences
  let logoAbbrev = abbreviation.toLowerCase();
  
  // Special handling for Utah Mammoth
  if (abbreviation === 'UTA') {
    // Try the official NHL team logo
    console.log('Using NHL official logo for Utah');
    return `https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/${teamId}.svg`;
  }
  
  // ESPN uses different abbreviations for some teams
  const espnAbbreviations: Record<string, string> = {
    'LAK': 'la',   // Los Angeles Kings → LA
    'SJS': 'sj',   // San Jose Sharks → SJ  
    'TBL': 'tb',   // Tampa Bay Lightning → TB
  };
  
  if (espnAbbreviations[abbreviation]) {
    logoAbbrev = espnAbbreviations[abbreviation];
  }
  
  // ESPN NHL logos (widely used and reliable)
  const url = `https://a.espncdn.com/i/teamlogos/nhl/500/${logoAbbrev}.png`;
  console.log(`Generated URL: ${url}`);
  return url;
};

// Team colors for fallback styling
export const teamColors: Record<string, { primary: string; secondary: string }> = {
  'ANA': { primary: '#F47A38', secondary: '#B9975B' },
  'BOS': { primary: '#FFB81C', secondary: '#000000' },
  'BUF': { primary: '#003087', secondary: '#FFB81C' },
  'CAR': { primary: '#CC0000', secondary: '#000000' },
  'CBJ': { primary: '#002654', secondary: '#CE1126' },
  'CGY': { primary: '#C8102E', secondary: '#F1BE48' },
  'CHI': { primary: '#CF0A2C', secondary: '#000000' },
  'COL': { primary: '#6F263D', secondary: '#236192' },
  'DAL': { primary: '#006847', secondary: '#8F8F8C' },
  'DET': { primary: '#CE1126', secondary: '#FFFFFF' },
  'EDM': { primary: '#041E42', secondary: '#FF4C00' },
  'FLA': { primary: '#041E42', secondary: '#C8102E' },
  'LAK': { primary: '#111111', secondary: '#A2AAAD' },
  'MIN': { primary: '#154734', secondary: '#A6192E' },
  'MTL': { primary: '#AF1E2D', secondary: '#192168' },
  'NSH': { primary: '#FFB81C', secondary: '#041E42' },
  'NJD': { primary: '#CE1126', secondary: '#000000' },
  'NYI': { primary: '#00539B', secondary: '#F47D30' },
  'NYR': { primary: '#0038A8', secondary: '#CE1126' },
  'OTT': { primary: '#C8102E', secondary: '#C2912C' },
  'PHI': { primary: '#F74902', secondary: '#000000' },
  'PIT': { primary: '#FCB514', secondary: '#000000' },
  'SEA': { primary: '#001628', secondary: '#99D9D9' },
  'SJS': { primary: '#006D75', secondary: '#EA7200' },
  'STL': { primary: '#002F87', secondary: '#FCB514' },
  'TBL': { primary: '#002868', secondary: '#FFFFFF' },
  'TOR': { primary: '#003E7E', secondary: '#FFFFFF' },
  'UTA': { primary: '#69BE28', secondary: '#154734' },
  'VAN': { primary: '#001F5B', secondary: '#00843D' },
  'VGK': { primary: '#B4975A', secondary: '#333F42' },
  'WPG': { primary: '#041E42', secondary: '#004C97' },
  'WSH': { primary: '#C8102E', secondary: '#041E42' }
};

// Team name mappings for consistent display
export const teamNames: Record<string, string> = {
  'ANA': 'Anaheim Ducks',
  'ARI': 'Arizona Coyotes', 
  'BOS': 'Boston Bruins',
  'BUF': 'Buffalo Sabres',
  'CAR': 'Carolina Hurricanes',
  'CBJ': 'Columbus Blue Jackets',
  'CGY': 'Calgary Flames',
  'CHI': 'Chicago Blackhawks',
  'COL': 'Colorado Avalanche',
  'DAL': 'Dallas Stars',
  'DET': 'Detroit Red Wings',
  'EDM': 'Edmonton Oilers',
  'FLA': 'Florida Panthers',
  'LAK': 'Los Angeles Kings',
  'MIN': 'Minnesota Wild',
  'MTL': 'Montreal Canadiens',
  'NSH': 'Nashville Predators',
  'NJD': 'New Jersey Devils',
  'NYI': 'New York Islanders',
  'NYR': 'New York Rangers',
  'OTT': 'Ottawa Senators',
  'PHI': 'Philadelphia Flyers',
  'PIT': 'Pittsburgh Penguins',
  'SEA': 'Seattle Kraken',
  'SJS': 'San Jose Sharks',
  'STL': 'St. Louis Blues',
  'TBL': 'Tampa Bay Lightning',
  'TOR': 'Toronto Maple Leafs',
  'UTA': 'Utah Mammoth',
  'VAN': 'Vancouver Canucks',
  'VGK': 'Vegas Golden Knights',
  'WPG': 'Winnipeg Jets',
  'WSH': 'Washington Capitals'
};