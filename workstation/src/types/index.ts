import type { AdvancedStats, RoleTrend, GameLogEntry } from '../lib/coachSchemas';

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

export interface CoachWindow {
  start: string;
  end: string;
}

export interface CoachPlayerSummary {
  id: string;
  name: string;
  team: string;
  pos: string[];
}

export interface CoachDropCandidate {
  player: CoachPlayerSummary;
  lostPoints: number;
}

export interface CoachRecommendation {
  player: CoachPlayerSummary;
  deltaPoints: number;
  deltaGp: number;
  bestDrop: CoachDropCandidate;
  badges: string[];
}

export interface CoachStreamersResponse {
  baseline_points: number;
  recommendations: CoachRecommendation[];
  meta?: {
    reqId: string;
    durationMs: number;
  };
}

export interface PlayerBio {
  birthDate?: string;
  birthCity?: string;
  birthStateProvince?: string;
  birthCountry?: string;
  heightInInches?: number;
  weightInPounds?: number;
  shootsCatches?: string;
  sweaterNumber?: number;
  draftYear?: number;
  draftTeam?: string;
  draftRound?: number;
  draftPickInRound?: number;
  draftOverallPick?: number;
}

export interface PlayerSearchResult {
  id: string;
  name: string;
  team: string;
  pos: string[];
  aliases: string[];
  blendedFppg: number | null;
  seasonFppg?: number;
  last30Fppg?: number;
  last7Fppg?: number;
  upcomingGames?: string[];
  games_played?: number;
  stats?: Record<string, any>;
  careerHistory?: Record<string, {
    gamesPlayed: number;
    goals: number;
    assists: number;
    points: number;
    fppg?: number;
    team?: string;
  }>;
  careerSummary?: {
    totalSeasons: number;
    totalGames: number;
    careerAvgPPG: number;
    bestSeason: string;
    bestSeasonPPG: number;
  };
  bio?: PlayerBio;
  advancedStats?: AdvancedStats;
  last7AdvancedStats?: AdvancedStats;
  roleTrend?: RoleTrend;
  gameLog?: GameLogEntry[];
}

export interface PlayerSearchResponse {
  results: PlayerSearchResult[];
  meta: {
    count: number;
    limit: number;
    generatedAt: string | null;
    directorySize: number;
  };
}

export interface CoachUserComponentStatus {
  present: boolean;
  updatedAt?: string;
  count?: number;
  source?: 'split' | 'legacy';
  path?: string;
}

export interface CoachUserStatus {
  userId: string;
  components: {
    settings: CoachUserComponentStatus;
    roster: CoachUserComponentStatus;
    free_agents: CoachUserComponentStatus;
  };
  legacyFallback: boolean;
  contextReady: boolean;
  contextError?: string;
}

export interface CoachConflictPlayer {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  fppg: number;
  reason?: string;
}

export interface CoachConflictDay {
  date: string;
  starters: CoachConflictPlayer[];
  benched: CoachConflictPlayer[];
  unusedSlots: Record<string, number>;
}

export interface CoachConflictResponse {
  window: CoachWindow;
  lineupSlots: Record<string, number>;
  summary: {
    totalBenchGp: number;
    totalStarts: number;
  };
  startsByPlayer: Record<string, number>;
  benchCounts: Record<string, number>;
  byDay: CoachConflictDay[];
}

export interface CoachUploadResponse {
  ok: boolean;
  userId: string;
  component?: string;
  components?: string[];
  count?: number;
  counts?: Record<string, number>;
}

// Comprehensive Yahoo Fantasy Hockey Stats
export interface SkaterScoringWeights {
  // Offensive
  goals?: number;
  assists?: number;
  points?: number;
  plus_minus?: number;
  penalty_minutes?: number;

  // Power Play
  powerplay_goals?: number;
  powerplay_assists?: number;
  powerplay_points?: number;

  // Shorthanded
  shorthanded_goals?: number;
  shorthanded_assists?: number;
  shorthanded_points?: number;

  // Special
  game_winning_goals?: number;
  game_tying_goals?: number;
  hat_tricks?: number;

  // Shots & Shooting
  shots_on_goal?: number;
  shooting_percentage?: number;

  // Faceoffs
  faceoffs_won?: number;
  faceoffs_lost?: number;
  faceoff_wins?: number; // alias
  faceoff_losses?: number; // alias
  faceoff_percentage?: number;

  // Physical
  hits?: number;
  blocks?: number;

  // Defensive
  defensive_points?: number;
}

export interface GoalieScoringWeights {
  wins?: number;
  losses?: number;
  overtime_losses?: number;
  goals_against?: number;
  goals_against_average?: number;
  saves?: number;
  save_percentage?: number;
  shots_against?: number;
  shutouts?: number;
  games_started?: number;
  complete_games?: number;
  minutes?: number;
}

export interface LeagueProfile {
  league_name: string;
  scoring_type: 'points' | 'categories';
  preset_name?: string;

  // For Points Leagues - point values for each stat
  skater_scoring?: SkaterScoringWeights;
  goalie_scoring?: GoalieScoringWeights;

  // For Category Leagues - which categories to track
  skater_categories?: string[];
  goalie_categories?: string[];

  lineup_slots: Record<string, number>;
  notes?: string;

  // League configuration
  num_teams?: number;
  playoff_start_date?: string; // ISO date string

  // Legacy support (will be migrated)
  scoring_weights?: {
    goals?: number;
    assists?: number;
    shots_on_goal?: number;
    blocks?: number;
    power_play_points?: number;
  };
}

export interface Player {
  id: string;
  full_name: string;
  team: string;
  positions: string[]; // Updated to match new contract (was position: string)
  games_played: number;
  stats: {
    goals: number;
    assists: number;
    shots_on_goal: number;
    blocks: number;
    power_play_points: number;
  };
  upcoming_games?: string[]; // Made optional to match new contract
  is_drop_eligible?: boolean;
  tags?: string[];
  blendedFppg?: number | null; // Pre-calculated FPPG from stats cache
  careerHistory?: Record<string, {
    gamesPlayed: number;
    goals: number;
    assists: number;
    points: number;
    fppg?: number;
    team?: string;
  }>;
  careerSummary?: {
    totalSeasons: number;
    totalGames: number;
    careerAvgPPG: number;
    bestSeason: string;
    bestSeasonPPG: number;
  };
  bio?: PlayerBio;
}

export interface UnmatchedPlayer {
  name: string;
  team?: string;
  position?: string;
}

export interface LeagueSettingsUploadResponse {
  ok: boolean;
  league_profile: LeagueProfile;
  confidence: number;
  warnings?: string[];
  imageId: string;
}

export interface RosterUploadResponse {
  ok: boolean;
  roster: Player[];
  unmatchedPlayers: UnmatchedPlayer[];
  confidence: number;
  imageId: string;
}

export interface FreeAgentsUploadResponse {
  ok: boolean;
  free_agents: Player[];
  unmatchedPlayers: UnmatchedPlayer[];
  confidence: number;
  imageId: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  reply: string;
}

export interface RosterPlayer {
  id: string;
  full_name: string;
  team: string;
  pos: string[];
  current_slot?: string;
  injuryStatus?: string;
  isActive?: boolean;
  careerHistory?: Record<string, {
    gamesPlayed: number;
    goals?: number;
    assists?: number;
    points?: number;
    wins?: number;
    losses?: number;
    overtimeLosses?: number;
    goalsAgainst?: number;
    goalsAgainstAverage?: number;
    savePct?: number;
    shutouts?: number;
    fppg?: number;
    team?: string;
  }>;
  careerSummary?: {
    totalSeasons: number;
    totalGames: number;
    careerAvgPPG?: number;
    bestSeason?: string;
    bestSeasonPPG?: number;
    careerWinPct?: number;
    careerGAA?: number;
    careerSavePct?: number;
    totalWins?: number;
    totalShutouts?: number;
    bestSeasonGAA?: number;
    bestSeasonSavePct?: number;
  };
  bio?: PlayerBio;
}

export interface CoachRosterResponse {
  roster: RosterPlayer[];
}

export interface CoachFreeAgentsResponse {
  free_agents: RosterPlayer[];
}

export interface CoachContextResponse {
  league: LeagueProfile;
  userId: string;
}

export interface PlayerProjection {
  fppg: number;
  starts: number;
  projectedPoints: number;
  startsByDate?: Record<string, number>;
}

export interface ApplyLineupRequest {
  league: LeagueProfile;
  window: { start: string; end: string };
  roster: Array<{
    playerId: string;
    slot: string;
  }>;
}

export interface ApplyLineupResponse {
  projections: Record<string, PlayerProjection>;
  meta?: {
    weightsSource?: string;
  };
}

// =============================================================================
// Player Availability Management (Drawer v2)
// =============================================================================

export type AvailabilityStatus = 'FA' | 'WAIVER' | 'OWNED_OTHER' | 'OWNED_ME' | 'UNKNOWN';

export interface AvailabilityMark {
  playerId: string;
  status: AvailabilityStatus;
  source: 'manual' | 'ocr' | 'bulk_paste' | 'ai_infer';
  confidence: number; // 0..1
  updatedAt: string;  // ISO timestamp
}

export interface LeaguePool {
  leagueId: string; // derive from current league settings; fallback 'default'
  marks: Record<string, AvailabilityMark>; // keyed by playerId
  watchlist: string[]; // player IDs
  version: number;  // bumpable for schema changes
}
