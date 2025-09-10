import axios from 'axios';
import { Team, ComplementResult, AddedStartsRequest, AddedStartsResult, MockPlayer, OffNightResult, BackToBackResult } from '../types';

const api = axios.create({
  baseURL: 'http://localhost:8082/api',
  timeout: 30000,
});

export const apiService = {
  async getTeams(): Promise<Team[]> {
    const response = await api.get<Team[]>('/teams');
    return response.data;
  },

  async getComplements(
    seedTeamCode: string,
    startDate?: string,
    endDate?: string
  ): Promise<ComplementResult[]> {
    const params: any = { seedTeamCode };
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;
    
    const response = await api.get<ComplementResult[]>('/complement', { params });
    return response.data;
  },

  async getAddedStarts(request: AddedStartsRequest): Promise<AddedStartsResult> {
    const response = await api.post<AddedStartsResult>('/added-starts', request);
    return response.data;
  },

  async getAddedStartsBulk(request: {
    rosterTeamCodes: string[];
    start?: string;
    end?: string;
    slotsPerDay?: number;
  }): Promise<{
    rows: Array<{
      team: string;
      candidateGamesInWindow: number;
      usableStarts: number;
      teamName: string;
      abbreviation: string;
    }>;
  }> {
    const response = await api.post('/added-starts-bulk', request);
    return response.data;
  },

  async getOffNights(
    startDate?: string,
    endDate?: string
  ): Promise<OffNightResult[]> {
    const params: any = {};
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;
    
    const response = await api.get<OffNightResult[]>('/offnights', { params });
    return response.data;
  },

  async getBackTobacks(
    startDate?: string,
    endDate?: string
  ): Promise<BackToBackResult[]> {
    const params: any = {};
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;
    
    const response = await api.get<BackToBackResult[]>('/backtobacks', { params });
    return response.data;
  },

  getMockPlayers(teamAbbreviation: string): MockPlayer[] {
    const mockPlayers: { [key: string]: MockPlayer[] } = {
      'ANA': [
        { id: 'ana-1', name: 'Ryan Strome', position: 'C', team: 'ANA', projectedPoints: 45 },
        { id: 'ana-2', name: 'Mason McTavish', position: 'C', team: 'ANA', projectedPoints: 42 },
        { id: 'ana-3', name: 'Trevor Zegras', position: 'C/W', team: 'ANA', projectedPoints: 52 },
      ],
      'BOS': [
        { id: 'bos-1', name: 'Pavel Zacha', position: 'C/W', team: 'BOS', projectedPoints: 48 },
        { id: 'bos-2', name: 'Charlie Coyle', position: 'C', team: 'BOS', projectedPoints: 44 },
        { id: 'bos-3', name: 'Trent Frederic', position: 'C/W', team: 'BOS', projectedPoints: 32 },
      ],
      'BUF': [
        { id: 'buf-1', name: 'Tage Thompson', position: 'C/W', team: 'BUF', projectedPoints: 78 },
        { id: 'buf-2', name: 'Dylan Cozens', position: 'C', team: 'BUF', projectedPoints: 55 },
        { id: 'buf-3', name: 'Casey Mittelstadt', position: 'C', team: 'BUF', projectedPoints: 52 },
      ],
    };

    return mockPlayers[teamAbbreviation] || [
      { id: `${teamAbbreviation.toLowerCase()}-1`, name: 'Mock Center 1', position: 'C', team: teamAbbreviation, projectedPoints: 45 },
      { id: `${teamAbbreviation.toLowerCase()}-2`, name: 'Mock Center 2', position: 'C/W', team: teamAbbreviation, projectedPoints: 38 },
      { id: `${teamAbbreviation.toLowerCase()}-3`, name: 'Mock Center 3', position: 'C', team: teamAbbreviation, projectedPoints: 32 },
    ];
  },
};