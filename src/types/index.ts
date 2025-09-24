export interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

export interface ComplementResult {
  teamCode: string;
  teamName: string;
  abbreviation: string;
  conflicts: number;
  nonOverlap: number;
  offNightShare: number;
  complement: number;
  weightedComplement: number;
  datesComplement: string[];
  draftFitScore?: number;
  usableStarts?: number;
}

export interface DraftComplements {
  seedTeam: string;
  lockedTeams: string[];
  candidateResults: ComplementResult[];
  mode: 'complement' | 'roster-aware';
  window: '7d' | '30d' | 'season';
}

export interface AddedStartsRequest {
  rosterTeamCodes: string[];
  candidateTeamCode: string;
  window: '7d' | '14d' | 'season';
}

export interface AddedStartsResult {
  addedStarts: number;
  dates: string[];
}

export interface MockPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  projectedPoints: number;
}

export interface OffNightResult {
  teamCode: string;
  teamName: string;
  totalOffNights: number;
  remainingOffNights: number;
  totalGames: number; // Total games in the date range
  gamesBeforePlayoffs: number; // Games remaining before playoffs start
}

export interface BackToBackResult {
  teamCode: string;
  teamName: string;
  totalBackToBack: number;
  remainingBackToBack: number;
  totalGames: number; // Total games in the date range
  gamesBeforePlayoffs: number; // Games remaining before playoffs start
}