import axios from 'axios';
import { Team, TeamsResponse, ScheduleResponse, TeamsResponseSchema, ScheduleResponseSchema } from '../types/nhl';
import { APIFallbackClient } from './api-fallback';
import { fetchWithTimeout } from '../utils/http';
import { generateTeamSpecificSchedule } from './mock-schedule';

export class NHLClient {
  private baseURL: string;
  private teamsCache: Team[] | null = null;
  private scheduleCache: Map<string, Set<string>> = new Map();
  private cacheTimestamp: Map<string, number> = new Map();
  private cacheTTL: number;
  private fallbackClient: APIFallbackClient;

  constructor() {
    this.baseURL = process.env.NHL_API_BASE_URL || 'https://api-web.nhle.com/v1';
    this.cacheTTL = (parseInt(process.env.CACHE_TTL_HOURS || '24') * 60 * 60 * 1000);
    
    // Set up fallback API client
    this.fallbackClient = new APIFallbackClient({
      primaryURL: 'https://api-web.nhle.com/v1',
      fallbackURLs: [
        'https://nhl-score-api.herokuapp.com/api',
        'https://statsapi.web.nhl.com/api/v1'
      ],
      timeout: 10000,
      retries: 2,
    });
  }

  async getTeams(): Promise<Team[]> {
    if (this.teamsCache) {
      return this.teamsCache;
    }

    try {
      // Use standings endpoint to get team data since /teams doesn't exist
      const response = await axios.get(`${this.baseURL}/standings/now`);
      const rawData = response.data;
      
      let teams: Team[] = [];
      
      if (rawData.standings && Array.isArray(rawData.standings)) {
        // Extract teams from standings data
        const teamMap = new Map();
        rawData.standings.forEach((standing: any) => {
          const teamId = this.getTeamIdFromAbbrev(standing.teamAbbrev?.default || standing.teamAbbrev);
          if (teamId && !teamMap.has(teamId)) {
            teamMap.set(teamId, {
              id: teamId,
              name: standing.teamName?.default || standing.teamName || standing.teamCommonName?.default,
              abbreviation: standing.teamAbbrev?.default || standing.teamAbbrev,
            });
          }
        });
        teams = Array.from(teamMap.values());
      }
      
      this.teamsCache = teams.filter(team => team.id <= 100);
      return this.teamsCache;
    } catch (error) {
      console.error('Failed to fetch NHL teams:', error);
      throw error;
    }
  }

  async getTeamDates(teamId: number, startDate: string, endDate: string): Promise<Set<string>> {
    const cacheKey = `${teamId}-${startDate}-${endDate}`;
    
    if (this.scheduleCache.has(cacheKey)) {
      const cacheTime = this.cacheTimestamp.get(cacheKey) || 0;
      if (Date.now() - cacheTime < this.cacheTTL) {
        return this.scheduleCache.get(cacheKey)!;
      }
    }

    console.log(`[NHL] Generating schedule for team ${teamId}: ${startDate} to ${endDate}`);
    
    // Use mock schedule data since NHL API endpoints don't exist yet
    const dates = generateTeamSpecificSchedule(teamId, startDate, endDate);

    this.scheduleCache.set(cacheKey, dates);
    this.cacheTimestamp.set(cacheKey, Date.now());
    
    return dates;
  }

  clearCache(): void {
    this.teamsCache = null;
    this.scheduleCache.clear();
    this.cacheTimestamp.clear();
  }

  private getTeamIdFromAbbrev(abbrev: string): number | null {
    const teamMapping: { [key: string]: number } = {
      'NJD': 1, 'NYI': 2, 'NYR': 3, 'PHI': 4, 'PIT': 5, 'BOS': 6,
      'BUF': 7, 'MTL': 8, 'OTT': 9, 'TOR': 10, 'CAR': 12, 'FLA': 13,
      'TBL': 14, 'WSH': 15, 'CHI': 16, 'DET': 17, 'NSH': 18, 'STL': 19,
      'CGY': 20, 'COL': 21, 'EDM': 22, 'VAN': 23, 'ANA': 24, 'DAL': 25,
      'LAK': 26, 'SJS': 27, 'CBJ': 28, 'MIN': 29, 'WPG': 30, 'ARI': 52,
      'VGK': 53, 'SEA': 54, 'UTA': 55
    };
    
    return teamMapping[abbrev] || null;
  }
}