import axios from 'axios';
import { Team, ComplementResult, AddedStartsRequest, AddedStartsResult, MockPlayer, OffNightResult, BackToBackResult, PlayerSearchResponse, PairingsResponse, ComplementMatrixResponse } from '../types';
import type { DraftPlayer, DraftPlayerDirectoryMeta } from '../lib/playerSearch';
import type { LeagueProfile } from '../lib/coachSchemas';
import { TeamTierCalculationResult, TeamTierApiRequest } from '../types/teamTiers';
import {
  ContextResponseSchema,
  RosterResponseSchema,
  ProjectionsResponseSchema,
  HealthResponseSchema,
  validateWithContractBreakLogging,
  parsePlayerIdToNumeric,
  type ContextResponse,
  type RosterResponse,
  type ProjectionsResponse,
  type ProjectionsRequest,
  type HealthResponse,
} from '../lib/coachSchemas';

// Generate or retrieve a unique user ID from localStorage
const getUserId = (): string => {
  // Allow override via environment variable for development
  if (import.meta.env.VITE_COACH_USER_ID) {
    return import.meta.env.VITE_COACH_USER_ID;
  }

  const STORAGE_KEY = 'cracked-ice-user-id';

  // Check if we already have a user ID
  let userId = localStorage.getItem(STORAGE_KEY);

  if (!userId) {
    // Generate a new unique ID: timestamp + random string
    userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, userId);
  }

  return userId;
};

const getBaseURL = () => {
  const overrideRaw = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_COACH_API_URL;
  if (overrideRaw && overrideRaw.trim().length > 0) {
    const trimmed = overrideRaw.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8080/api';
  }
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
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

  async getPairings(request: {
    anchors: string[];
    start: string;
    end: string;
    slots: number;
  }): Promise<PairingsResponse> {
    const response = await api.get<PairingsResponse>('/pairings', {
      params: {
        anchors: request.anchors.join(','),
        start: request.start,
        end: request.end,
        slots: request.slots,
      },
    });
    return response.data;
  },

  async getComplementMatrix(request: { start: string; end: string }): Promise<ComplementMatrixResponse> {
    const response = await api.get<ComplementMatrixResponse>('/complement-matrix', { params: request });
    return response.data;
  },

  async getDraftPlayers(profile?: LeagueProfile | null): Promise<{ players: DraftPlayer[]; meta: DraftPlayerDirectoryMeta }> {
    const response = await api.get<{ players: DraftPlayer[]; meta: DraftPlayerDirectoryMeta }>('/draft-players', {
      params: { limit: 2000, ...(profile ? { profile: JSON.stringify(profile) } : {}) },
    });
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

  async getTeamTiers(request: TeamTierApiRequest = {}): Promise<TeamTierCalculationResult> {
    const params: any = {};
    if (request.start) params.start = request.start;
    if (request.end) params.end = request.end;
    if (request.playoffStartWeek) params.playoffStartWeek = request.playoffStartWeek;
    if (request.playoffStart) params.playoffStart = request.playoffStart;
    if (request.playoffEnd) params.playoffEnd = request.playoffEnd;
    if (request.settings) params.settings = JSON.stringify(request.settings);

    const response = await api.get<TeamTierCalculationResult>('/team-tiers', { params });
    return response.data;
  },

  async getCoachUserStatus(): Promise<any> {
    const userId = getUserId();
    const response = await api.get(`/coach/users/${userId}/status`);
    return response.data;
  },

  async sendCoachChatMessage(userId: string, message: string, window?: { start: string; end: string }): Promise<{ reply: string }> {
    const response = await api.post(`/coach/users/${userId}/chat`, { message, window });
    return response.data;
  },

  async *streamChatMessage(message: string, window?: { start: string; end: string }): AsyncGenerator<string, void, unknown> {
    const userId = getUserId();

    // For now, simulate streaming by fetching the full response and yielding it in chunks
    const response = await api.post(`/coach/users/${userId}/chat`, { message, window });
    const fullText = response.data.reply || '';

    // Simulate streaming by yielding characters progressively
    const chunkSize = 3;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      yield fullText.slice(i, i + chunkSize);
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  },

  async getCoachRoster(): Promise<RosterResponse> {
    const userId = getUserId();
    // Add timestamp to bust browser cache
    const response = await api.get(`/coach/users/${userId}/roster?_t=${Date.now()}`);

    const validated = validateWithContractBreakLogging(
      RosterResponseSchema,
      response.data,
      'GET /coach/users/:userId/roster'
    );

    if (!validated) {
      throw new Error('Invalid roster response from server');
    }

    // Track slot usage to assign indices
    const slotCounters: Record<string, number> = {};

    // Normalize player IDs and convert slot format
    validated.roster = validated.roster.map(player => {
      let indexedSlot = player.current_slot;

      // Convert backend slot format ("C", "LW", "IR+") to indexed format ("C-0", "LW-0", "IR+-0")
      if (player.current_slot) {
        const slotType = player.current_slot; // Keep IR+ as-is (don't strip the +)
        const currentIndex = slotCounters[slotType] || 0;
        indexedSlot = `${slotType}-${currentIndex}`;
        slotCounters[slotType] = currentIndex + 1;
      }

      return {
        ...player,
        id: parsePlayerIdToNumeric(player.id),
        current_slot: indexedSlot,
      };
    });

    return validated;
  },

  async getCoachFreeAgents(): Promise<RosterResponse> {
    const userId = getUserId();
    const response = await api.get(`/coach/users/${userId}/free-agents`);

    const validated = validateWithContractBreakLogging(
      RosterResponseSchema,
      response.data,
      'GET /coach/users/:userId/free-agents'
    );

    if (!validated) {
      throw new Error('Invalid free agents response from server');
    }

    // Normalize player IDs (reuse roster schema structure)
    if (validated.roster) {
      validated.roster = validated.roster.map(player => ({
        ...player,
        id: parsePlayerIdToNumeric(player.id),
      }));
    }

    return validated;
  },

  async getCoachContext(): Promise<ContextResponse> {
    const userId = getUserId();
    const response = await api.get(`/coach/users/${userId}/context`);

    const validated = validateWithContractBreakLogging(
      ContextResponseSchema,
      response.data,
      'GET /coach/users/:userId/context'
    );

    if (!validated) {
      throw new Error('Invalid context response from server');
    }

    return validated;
  },

  async getCoachHealth(): Promise<HealthResponse> {
    const response = await api.get('/coach/health');

    const validated = validateWithContractBreakLogging(
      HealthResponseSchema,
      response.data,
      'GET /coach/health'
    );

    if (!validated) {
      throw new Error('Invalid health response from server');
    }

    return validated;
  },

  async getCoachConflicts(window: { start: string; end: string }): Promise<any> {
    const userId = getUserId();
    const params = { start: window.start, end: window.end };
    const response = await api.get(`/coach/users/${userId}/conflicts`, { params });
    return response.data;
  },

  async getCoachStreamers(window: { start: string; end: string }): Promise<any> {
    // Streamers are recommendations - using demo-user from env
    const userId = getUserId();
    const response = await api.post(`/coach/users/${userId}/recommend`, { window });
    return response.data;
  },

  async getCoachSettings(): Promise<any> {
    const userId = getUserId();
    const response = await api.get(`/coach/users/${userId}/settings`);
    return response.data;
  },

  async uploadCoachSettings(settings: any): Promise<any> {
    const userId = getUserId();
    const response = await api.put(`/coach/users/${userId}/settings`, settings);
    return response.data;
  },

  async uploadCoachRoster(data: any): Promise<any> {
    const userId = getUserId();
    const response = await api.put(`/coach/users/${userId}/roster`, data);
    return response.data;
  },

  async uploadCoachFreeAgents(data: any): Promise<any> {
    const userId = getUserId();
    const response = await api.put(`/coach/users/${userId}/free-agents`, data);
    return response.data;
  },

  async getPlayerSchedule(team: string, window: { start: string; end: string }): Promise<{
    team: string;
    window: { start: string; end: string };
    gamesAvailable: number;
    gamesByDate: Record<string, {
      opponent: string;
      isHome: boolean;
      isOffNight: boolean;
      opponentGoalsAgainstPerGame: number | null;
    }>;
  }> {
    const params = { start: window.start, end: window.end };
    const response = await api.get(`/coach/player-schedule/${team}`, { params });
    return response.data;
  },

  async uploadCoachContext(data: any): Promise<any> {
    const userId = getUserId();
    const response = await api.put(`/coach/users/${userId}`, data);
    return response.data;
  },

  async updateLeagueProfile(leagueProfile: any): Promise<any> {
    const userId = getUserId();
    const response = await api.put(`/coach/users/${userId}/settings`, leagueProfile);
    return response.data;
  },

  async clearCoachRoster(): Promise<any> {
    const userId = getUserId();
    const response = await api.delete(`/coach/users/${userId}/roster`);
    return response.data;
  },

  async clearCoachFreeAgents(): Promise<any> {
    const userId = getUserId();
    const response = await api.delete(`/coach/users/${userId}/free-agents`);
    return response.data;
  },

  async getAllPlayers(
    profile?: LeagueProfile | null,
    window?: { start: string; end: string } | null,
  ): Promise<PlayerSearchResponse> {
    const userId = getUserId();
    const response = await api.get<PlayerSearchResponse & { players?: PlayerSearchResponse['results'] }>(`/coach/users/${userId}/players`, {
      params: {
        ...(profile ? { profile: JSON.stringify(profile) } : {}),
        ...(window ?? {}),
      },
    });
    const results = response.data.results ?? response.data.players ?? [];
    return {
      ...response.data,
      results,
      meta: {
        ...response.data.meta,
        count: response.data.meta?.count ?? results.length,
        limit: response.data.meta?.limit ?? results.length,
        generatedAt: response.data.meta?.generatedAt ?? null,
        directorySize: response.data.meta?.directorySize ?? results.length,
      },
    };
  },

  async searchPlayers(
    query: string,
    limit: number = 12,
    window?: { start: string; end: string },
    profile?: LeagueProfile | null,
  ): Promise<PlayerSearchResponse> {
    const userId = getUserId();
    const response = await api.get<PlayerSearchResponse>(`/coach/users/${userId}/players/search`, {
      params: { q: query, limit, ...window, ...(profile ? { profile: JSON.stringify(profile) } : {}) }
    });
    return response.data;
  },

  async addPlayerToRoster(playerId: string, slot?: string): Promise<any> {
    const userId = getUserId();
    const body: any = { playerId };
    if (slot) {
      body.slot = slot;
    }
    const response = await api.post(`/coach/users/${userId}/roster/add`, body);
    return response.data;
  },

  async addPlayersToRosterBulk(playerIds: string[], slot?: string): Promise<any> {
    const userId = getUserId();
    const body: any = { playerIds };
    if (slot) {
      body.slot = slot;
    }
    const response = await api.post(`/coach/users/${userId}/roster/add-bulk`, body);
    return response.data;
  },

  async removePlayerFromRoster(playerId: string): Promise<any> {
    const userId = getUserId();
    const response = await api.delete(`/coach/users/${userId}/roster/remove/${playerId}`);
    return response.data;
  },

  async saveRosterLineup(lineup: Array<{ playerId: string; slot: string }>): Promise<any> {
    const userId = getUserId();
    const response = await api.patch(`/coach/users/${userId}/roster/lineup`, { lineup });
    return response.data;
  },

  async addPlayerToFreeAgents(playerId: string): Promise<any> {
    const userId = getUserId();
    const response = await api.post(`/coach/users/${userId}/free-agents/add`, { playerId });
    return response.data;
  },

  async applyRosterLineup(request: ProjectionsRequest): Promise<ProjectionsResponse> {
    const userId = getUserId();
    // Add timestamp to bust browser cache
    const response = await api.post(`/coach/users/${userId}/projections?_t=${Date.now()}`, request);

    const validated = validateWithContractBreakLogging(
      ProjectionsResponseSchema,
      response.data,
      'POST /coach/users/:userId/projections'
    );

    if (!validated) {
      throw new Error('Invalid projections response from server');
    }

    // Normalize player IDs in projection keys
    const normalizedProjections: typeof validated.projections = {};
    Object.entries(validated.projections).forEach(([id, projection]) => {
      const normalizedId = parsePlayerIdToNumeric(id);
      normalizedProjections[normalizedId] = projection;
    });

    return {
      ...validated,
      projections: normalizedProjections,
    };
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

  // OCR Upload Methods
  async uploadLeagueSettingsImage(data: any): Promise<any> {
    throw new Error('uploadLeagueSettingsImage not yet implemented');
  },

  async uploadRosterImage(file: File): Promise<{ roster: any[], unmatchedPlayers: any[] }> {
    const userId = getUserId();
    const formData = new FormData();
    formData.append('image', file);
    formData.append('provider', 'openai');

    const response = await api.post(`/coach/users/${userId}/upload/roster`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Extract roster from the response
    const roster = response.data.roster || [];
    const unmatchedPlayers = response.data.unmatchedPlayers || [];
    return { roster, unmatchedPlayers };
  },

  async uploadFreeAgentsImage(file: File): Promise<{
    playerNames: string[];
    confidence?: number;
    imageRetention: 'transient-not-stored';
  }> {
    const userId = getUserId();
    const formData = new FormData();
    formData.append('image', file);
    formData.append('provider', 'openai');

    const response = await api.post(`/coach/users/${userId}/upload/free-agents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const extractedPlayers = response.data.extractedPlayers ?? [];
    const playerNames = extractedPlayers.length > 0
      ? extractedPlayers.map((player: { name: string }) => player.name)
      : [
          ...(response.data.free_agents?.map((player: { full_name?: string; name?: string }) => player.full_name || player.name) ?? []),
          ...(response.data.unmatchedPlayers?.map((player: { name: string }) => player.name) ?? []),
        ].filter(Boolean);
    return {
      playerNames,
      confidence: response.data.confidence,
      imageRetention: 'transient-not-stored',
    };
  },

  // Position Override Management
  async getPositionOverrides(): Promise<any> {
    const userId = getUserId();
    const response = await api.get(`/coach/users/${userId}/position-overrides`);
    return response.data;
  },

  async addPositionOverride(
    playerId: string,
    positions: string[],
    notes?: string
  ): Promise<any> {
    const userId = getUserId();
    const response = await api.post(`/coach/users/${userId}/position-overrides`, {
      playerId,
      positions,
      notes,
      updatedBy: userId,
    });
    return response.data;
  },

  async removePositionOverride(playerId: string): Promise<any> {
    const userId = getUserId();
    const response = await api.delete(`/coach/users/${userId}/position-overrides/${playerId}`);
    return response.data;
  },

  // Player Comparison
  async compareSwap(
    candidateId: string,
    replaceId: string,
    window: { start: string; end: string }
  ): Promise<any> {
    const userId = getUserId();
    const response = await api.post(`/coach/users/${userId}/compare-swap`, {
      candidateId,
      replaceId,
      window,
    });
    return response.data;
  },

  async getSmartSuggestions(params: {
    window: { start: string; end: string };
    position?: string;
    limit?: number;
    minIceScore?: number;
  }): Promise<any> {
    const userId = getUserId();
    const response = await api.post(`/coach/users/${userId}/smart-suggestions`, params);
    return response.data;
  },
};

