export type Position = 'C' | 'LW' | 'RW' | 'D' | 'G' | 'UTIL';
export type SkaterPos = 'C' | 'LW' | 'RW' | 'D' | 'UTIL';

export interface Player {
  id: string;
  name: string;
  team: string;
  pos: SkaterPos[];
  rosteredPct?: number;
}

export interface PlayerStats {
  playerId?: string;
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  blendedFppg: number;
}

export interface LeagueProfile {
  playoffStartWeek: number;
  playoffEndWeek: number;
  lineupMode: 'daily' | 'weekly';
  rosterSlots: Record<Position, number>;
  scoring?: Record<string, number>;
}

export interface Roster {
  players: Player[];
}

export interface FreeAgents {
  candidates: Player[];
  source: 'user_list' | 'screenshot' | 'ownership_proxy';
}

export interface Window {
  start: string;
  end: string;
}

export interface SimulationResult {
  playableGp: Record<string, number>;
  totalPoints: number;
}

export interface Recommendation {
  player: Player;
  deltaPoints: number;
  deltaGp: number;
  bestDrop: {
    player: Player;
    lostPoints: number;
  };
  badges: string[];
}

export interface CoachStreamersRequest {
  window: Window;
}

export interface CoachStreamersResponse {
  baseline_points: number;
  recommendations: Recommendation[];
  meta?: {
    reqId: string;
    durationMs: number;
  };
}

export interface RequestContext {
  userId: string;
  window: Window;
}

export interface PlayerWithStats extends Player {
  stats?: PlayerStats;
}