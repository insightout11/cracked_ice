import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  blendedSeasonFppg,
  calculateFppgFromGoalieStats,
  calculateFppgFromSkaterStats,
  calculateGoalieFppgBreakdown,
  calculateSkaterFppgBreakdown,
  type FppgBreakdown,
} from '../../server/src/features/coach/scoring.js';
import { LeagueProfileSchema, type LeagueProfile } from '../../server/src/features/coach/types.js';
import type { GoalieStats, SkaterStats } from '../../server/src/context/stats.js';

export interface DraftPlayer {
  id: string;
  name: string;
  team: string;
  pos: string[];
  aliases: string[];
  yahooAdp?: number;
  yahooAverageRound?: number;
  yahooPercentDrafted?: number;
  blendedFppg: number | null;
  productionValue: number | null;
  productionLabel: 'FPPG' | 'PPG' | 'SV%';
  nhlGamesPlayed: number;
  careerGamesPlayed: number;
  birthDate?: string;
  avgToiPerGame?: number;
  ppTimeOnIcePerGame?: number;
  recentSeasons: Array<{ season: string; gamesPlayed: number; pointsPerGame?: number; savePct?: number }>;
  scoringBreakdown: FppgBreakdown | null;
  nativeFppg: number | null;
  projectionStatus: 'native' | 'rookie-low-confidence' | 'market-only' | 'unprojected';
  identitySource: 'canonical';
}

export interface DraftPlayerDirectoryMeta {
  scoringKind: 'league-profile' | 'default-fallback';
  scoringLabel: string;
  eligibilitySource: 'yahoo' | 'canonical';
  eligibilityUpdatedAt: string | null;
  statsSeason: string;
  updatedAt: string | null;
  playerCount: number;
  positionalAverages: Record<string, { avgFppg: number; sampleSize: number }>;
}

export interface PublicPlayerDetails {
  id: string;
  name: string;
  team: string;
  pos: string[];
  aliases: string[];
  blendedFppg: number | null;
  seasonFppg?: number;
  last30Fppg?: number;
  last7Fppg?: number;
  statsSeason?: string;
  statsGeneratedAt?: string;
  teamGamesPlayed?: number;
  games_played: number;
  stats: Record<string, number | string>;
  careerHistory?: Record<string, any>;
  careerSummary?: Record<string, any>;
  /** Regular-season shots on goal, hits and blocks by season id (skaters, 2005-06 on). */
  careerCounting?: Record<string, CareerCountingSeason>;
  bio?: Record<string, any>;
  injuryStatus?: string;
  isActive?: boolean;
  advancedStats?: Record<string, any>;
  last7AdvancedStats?: Record<string, any>;
  gameLog?: Array<Record<string, any>>;
}

export interface CareerCountingSeason {
  gamesPlayed: number;
  shots: number;
  hits: number;
  blocks: number;
}

interface RawPlayer {
  id: string;
  name: string;
  team: string;
  pos: string[];
  aliases: string[];
}

interface DirectoryCache {
  players: RawPlayer[];
  yahooEligibility: Record<string, {
    positions: string[];
    averagePick?: number | null;
    averageRound?: number | null;
    percentDrafted?: number | null;
    injuryStatus?: string | null;
    injuryStatusFull?: string | null;
    injuryNote?: string | null;
    injuryUpdatedAt?: string | null;
  }>;
  yahooEligibilityUpdatedAt: string | null;
  stats: Record<string, any>;
  /** data/career-counting.json seasons: season id -> player id -> [gamesPlayed, shots, hits, blocks]. */
  careerCounting: Record<string, Record<string, [number, number, number, number]>>;
  generatedAt: string | null;
  statsSeason: string;
  statsSeasonId: string;
}

let cache: DirectoryCache | null = null;

function formatStatsSeason(source: string): string {
  const match = source.match(/(\d{4})(\d{4})$/);
  return match ? `${match[1]}-${match[2].slice(2)}` : source || 'Unknown';
}

export function parseDraftLeagueProfile(value: unknown): LeagueProfile | null {
  if (!value) return null;
  try {
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = LeagueProfileSchema.safeParse(typeof raw === 'string' ? JSON.parse(raw) : raw);
    return parsed.success && parsed.data.scoring_type === 'points' ? parsed.data : null;
  } catch {
    return null;
  }
}

function loadDirectoryCache(): DirectoryCache {
  if (cache) return cache;

  const dataDir = [
    join(process.cwd(), '..', 'data'),
    join(process.cwd(), 'data'),
  ].find((candidate) =>
    existsSync(join(candidate, 'players.json')) && existsSync(join(candidate, 'stats.json'))
  );
  if (!dataDir) throw new Error('Canonical player and stats data are unavailable.');
  const playerPayload = JSON.parse(readFileSync(join(dataDir, 'players.json'), 'utf8'));
  const statsPayload = JSON.parse(readFileSync(join(dataDir, 'stats.json'), 'utf8'));
  const careerCountingPath = join(dataDir, 'career-counting.json');
  const careerCounting = existsSync(careerCountingPath)
    ? JSON.parse(readFileSync(careerCountingPath, 'utf8')).seasons ?? {}
    : {};
  const yahooEligibilityPath = join(dataDir, 'yahoo-player-eligibility.json');
  const yahooEligibilityPayload = existsSync(yahooEligibilityPath)
    ? JSON.parse(readFileSync(yahooEligibilityPath, 'utf8'))
    : { players: {}, updatedAt: null };
  const players = (playerPayload.players ?? [])
    .filter((player: any) => player?.id && player?.name && player?.team)
    .map((player: any) => ({
      id: String(player.id),
      name: String(player.name),
      team: String(player.team).toUpperCase(),
      pos: Array.isArray(player.pos) ? player.pos.map(String) : [],
      aliases: Array.isArray(player.aliases) ? player.aliases.map(String) : [],
    }));

  cache = {
    players,
    yahooEligibility: yahooEligibilityPayload.players ?? {},
    yahooEligibilityUpdatedAt: yahooEligibilityPayload.updatedAt ?? null,
    stats: statsPayload.players ?? {},
    careerCounting,
    generatedAt: statsPayload.generatedAt ?? null,
    statsSeason: formatStatsSeason(String(statsPayload.source ?? '')),
    statsSeasonId: String(statsPayload.source ?? '').match(/(\d{8})$/)?.[1] ?? '',
  };
  return cache;
}

export function loadDraftPlayerDirectory(leagueProfile: LeagueProfile | null = null): {
  players: DraftPlayer[];
  meta: DraftPlayerDirectoryMeta;
} {
  const directory = loadDirectoryCache();
  const useYahooEligibility = leagueProfile?.platform === 'yahoo'
    || /\byahoo\b/i.test(leagueProfile?.preset_name ?? '');
  const players = directory.players.map((canonicalPlayer) => {
      const yahooPositions = directory.yahooEligibility[canonicalPlayer.id]?.positions;
      const player = useYahooEligibility && Array.isArray(yahooPositions) && yahooPositions.length
        ? { ...canonicalPlayer, pos: yahooPositions }
        : canonicalPlayer;
      const snapshot = directory.stats[player.id];
      const careerHistory = snapshot?.careerHistory ?? {};
      const hasNhlCareerRecord = Object.keys(careerHistory).length > 0
        || Number(snapshot?.careerSummary?.totalGames ?? 0) > 0;
      const nhlSeason = careerHistory[directory.statsSeasonId];
      // A career-history season can contain only the latest team stint after a
      // trade. The season stat line is the complete sample used for scoring.
      const seasonStats = player.pos.includes('G') ? snapshot?.goalieStats : snapshot?.skaterStats;
      // The shared snapshot can also contain junior/minor-league stat lines for
      // prospects. Those rows have no NHL career record and must not be scored
      // as NHL production merely because their stat line contains games.
      const nhlGamesPlayed = hasNhlCareerRecord
        ? Number(seasonStats?.gamesPlayed ?? nhlSeason?.gamesPlayed ?? 0)
        : 0;
      const careerGamesPlayed = hasNhlCareerRecord
        ? Number(snapshot?.careerSummary?.totalGames
          ?? Object.values(careerHistory).reduce((sum: number, season: any) => sum + Number(season?.gamesPlayed ?? 0), 0))
        : 0;
      const calculatedFppg = player.pos.includes('G')
        ? calculateFppgFromGoalieStats(snapshot?.goalieStats as GoalieStats | undefined, leagueProfile)
        : calculateFppgFromSkaterStats(snapshot?.skaterStats as SkaterStats | undefined, leagueProfile);
      const scoringBreakdown = nhlGamesPlayed > 0 ? (player.pos.includes('G')
        ? calculateGoalieFppgBreakdown(snapshot?.goalieStats as GoalieStats | undefined, leagueProfile)
        : calculateSkaterFppgBreakdown(snapshot?.skaterStats as SkaterStats | undefined, leagueProfile)) : null;
      // After the season switch, rate players on the early-season blend of this and last season.
      const seasonBlend = snapshot?.priorSeason
        ? blendedSeasonFppg(snapshot as any, leagueProfile, { snapshots: () => Object.values(directory.stats) as any[], key: `directory|${directory.generatedAt}` })
        : null;
      const blendedFppg = seasonBlend
        ? (seasonBlend.hasData && seasonBlend.value > 0 ? seasonBlend.value : null)
        : (nhlGamesPlayed > 0 && calculatedFppg > 0 ? calculatedFppg : null);
      const skaterGames = nhlGamesPlayed;
      const pointsPerGame = skaterGames > 0
        ? Number(snapshot?.skaterStats?.points ?? 0) / skaterGames
        : null;
      const savePct = Number(snapshot?.goalieStats?.savePct ?? 0);
      const recentSeasons = Object.entries(snapshot?.careerHistory ?? {})
        .sort(([seasonA], [seasonB]) => seasonB.localeCompare(seasonA))
        .slice(0, 3)
        .map(([season, value]: [string, any]) => ({
          season,
          gamesPlayed: Number(value?.gamesPlayed ?? 0),
          ...(Number(value?.points ?? 0) > 0 && Number(value?.gamesPlayed ?? 0) > 0
            ? { pointsPerGame: Number(value.points) / Number(value.gamesPlayed) }
            : {}),
          ...(Number(value?.savePct ?? 0) > 0 ? { savePct: Number(value.savePct) } : {}),
        }));

      const productionLabel: DraftPlayer['productionLabel'] = blendedFppg
        ? 'FPPG'
        : pointsPerGame !== null
          ? 'PPG'
          : 'SV%';
      const projectionStatus: DraftPlayer['projectionStatus'] = blendedFppg !== null
        ? (careerGamesPlayed < (player.pos.includes('G') ? 25 : 20) ? 'rookie-low-confidence' : 'native')
        : (directory.yahooEligibility[player.id]?.averagePick != null || directory.yahooEligibility[player.id]?.percentDrafted != null
            ? 'market-only'
            : 'unprojected');

      return {
        ...player,
        ...(directory.yahooEligibility[player.id]?.averagePick
          ? { yahooAdp: directory.yahooEligibility[player.id].averagePick ?? undefined }
          : {}),
        ...(directory.yahooEligibility[player.id]?.averageRound
          ? { yahooAverageRound: directory.yahooEligibility[player.id].averageRound ?? undefined }
          : {}),
        ...(directory.yahooEligibility[player.id]?.percentDrafted
          ? { yahooPercentDrafted: directory.yahooEligibility[player.id].percentDrafted ?? undefined }
          : {}),
        ...(directory.yahooEligibility[player.id]?.injuryStatus
          ? { injuryStatus: directory.yahooEligibility[player.id].injuryStatus ?? undefined }
          : {}),
        ...(directory.yahooEligibility[player.id]?.injuryStatusFull
          ? { injuryStatusFull: directory.yahooEligibility[player.id].injuryStatusFull ?? undefined }
          : {}),
        ...(directory.yahooEligibility[player.id]?.injuryNote
          ? { injuryNote: directory.yahooEligibility[player.id].injuryNote ?? undefined }
          : {}),
        ...(directory.yahooEligibility[player.id]?.injuryUpdatedAt
          ? { injuryUpdatedAt: directory.yahooEligibility[player.id].injuryUpdatedAt ?? undefined }
          : {}),
        blendedFppg,
        nativeFppg: blendedFppg,
        projectionStatus,
        identitySource: 'canonical' as const,
        productionValue: blendedFppg ?? pointsPerGame ?? (savePct > 0 ? savePct : null),
        productionLabel,
        nhlGamesPlayed,
        careerGamesPlayed,
        birthDate: snapshot?.bio?.birthDate,
        avgToiPerGame: Number(snapshot?.advancedStats?.avgToiPerGame ?? 0) || undefined,
        ppTimeOnIcePerGame: Number(snapshot?.advancedStats?.ppTimeOnIcePerGame ?? 0) || undefined,
        recentSeasons,
        scoringBreakdown,
      };
    });

  const positions = ['C', 'LW', 'RW', 'D', 'G'];
  const positionalAverages = Object.fromEntries(positions.map((position) => {
    const eligible = players.filter((player) => player.blendedFppg !== null && player.pos.includes(position));
    const average = eligible.length
      ? eligible.reduce((sum, player) => sum + (player.blendedFppg ?? 0), 0) / eligible.length
      : 0;
    return [position, { avgFppg: Number(average.toFixed(2)), sampleSize: eligible.length }];
  }));

  return {
    players,
    meta: {
      scoringKind: leagueProfile ? 'league-profile' : 'default-fallback',
      scoringLabel: leagueProfile
        ? [leagueProfile.league_name, leagueProfile.preset_name].filter(Boolean).join(' · ')
        : 'Default scoring',
      eligibilitySource: useYahooEligibility ? 'yahoo' : 'canonical',
      eligibilityUpdatedAt: useYahooEligibility ? directory.yahooEligibilityUpdatedAt : null,
      statsSeason: directory.statsSeason,
      updatedAt: directory.generatedAt,
      playerCount: players.length,
      positionalAverages,
    },
  };
}

function careerCountingFor(directory: DirectoryCache, playerId: string): Record<string, CareerCountingSeason> | undefined {
  const seasons: Record<string, CareerCountingSeason> = {};
  for (const [seasonId, players] of Object.entries(directory.careerCounting)) {
    const row = players[playerId];
    if (row) seasons[seasonId] = { gamesPlayed: row[0], shots: row[1], hits: row[2], blocks: row[3] };
  }
  return Object.keys(seasons).length ? seasons : undefined;
}

export function loadPublicPlayerDetails(
  rawPlayerId: string,
  leagueProfile: LeagueProfile | null = null,
): PublicPlayerDetails | null {
  const playerId = rawPlayerId.startsWith('nhl:') ? rawPlayerId : `nhl:${rawPlayerId}`;
  const directory = loadDirectoryCache();
  const player = loadDraftPlayerDirectory(leagueProfile).players.find((candidate) => candidate.id === playerId);
  const snapshot = directory.stats[playerId];
  if (!player || !snapshot) return null;

  const skater = snapshot.skaterStats ?? {};
  const goalie = snapshot.goalieStats ?? {};
  const isGoalie = player.pos.includes('G');
  const gamesPlayed = Number((isGoalie ? goalie.gamesPlayed : skater.gamesPlayed) ?? 0);
  const stats: Record<string, number | string> = isGoalie ? {
    wins: Number(goalie.wins ?? 0),
    losses: Number(goalie.losses ?? 0),
    overtime_losses: Number(goalie.overtimeLosses ?? 0),
    saves: Number(goalie.saves ?? 0),
    shots_against: Number(goalie.shotsAgainst ?? 0),
    goals_against: Number(goalie.goalsAgainst ?? 0),
    save_percentage: Number(goalie.savePct ?? 0),
    goals_against_average: Number(goalie.gaa ?? 0),
    shutouts: Number(goalie.shutouts ?? 0),
    games_started: Number(goalie.gamesStarted ?? 0),
  } : {
    goals: Number(skater.goals ?? 0),
    assists: Number(skater.assists ?? 0),
    shots_on_goal: Number(skater.shots ?? 0),
    blocks: Number(skater.blocks ?? 0),
    power_play_points: Number(skater.ppPoints ?? 0),
    shorthanded_goals: Number(skater.shGoals ?? 0),
    shorthanded_assists: Number(skater.shAssists ?? 0),
    hits: Number(skater.hits ?? 0),
    game_winning_goals: Number(skater.gameWinningGoals ?? 0),
    plus_minus: Number(skater.plusMinus ?? 0),
    shooting_percentage: Number(skater.shootingPct ?? 0),
    powerplay_goals: Number(skater.ppGoals ?? 0),
    powerplay_assists: Number(skater.ppAssists ?? 0),
    faceoff_percentage: Number(skater.faceoffWinPct ?? 0),
    time_on_ice: String(skater.toi ?? ''),
  };

  return {
    id: player.id,
    name: player.name,
    team: player.team,
    pos: player.pos,
    aliases: player.aliases,
    blendedFppg: player.blendedFppg,
    seasonFppg: snapshot.seasonFppg,
    last30Fppg: snapshot.last30Fppg,
    last7Fppg: snapshot.last7Fppg,
    statsSeason: directory.statsSeasonId || undefined,
    statsGeneratedAt: directory.generatedAt ?? undefined,
    teamGamesPlayed: snapshot.teamGamesPlayed,
    games_played: gamesPlayed,
    stats,
    careerHistory: snapshot.careerHistory,
    careerSummary: snapshot.careerSummary,
    careerCounting: isGoalie ? undefined : careerCountingFor(directory, player.id),
    bio: snapshot.bio,
    injuryStatus: snapshot.injuryStatus,
    isActive: snapshot.isActive,
    advancedStats: snapshot.advancedStats,
    last7AdvancedStats: snapshot.last7AdvancedStats,
    gameLog: snapshot.gameLog,
  };
}
