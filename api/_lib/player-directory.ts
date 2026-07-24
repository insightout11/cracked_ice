import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  calculateFppgFromGoalieStats,
  calculateFppgFromSkaterStats,
  calculateGoalieFppgBreakdown,
  calculateSkaterFppgBreakdown,
  type FppgBreakdown,
} from '../../server/src/features/coach/scoring';
import { LeagueProfileSchema, type LeagueProfile } from '../../server/src/features/coach/types';
import type { GoalieStats, SkaterStats } from '../../server/src/context/stats';

export interface DraftPlayer {
  id: string;
  name: string;
  team: string;
  pos: string[];
  aliases: string[];
  blendedFppg: number | null;
  productionValue: number | null;
  productionLabel: 'FPPG' | 'PPG' | 'SV%';
  nhlGamesPlayed: number;
  birthDate?: string;
  avgToiPerGame?: number;
  ppTimeOnIcePerGame?: number;
  recentSeasons: Array<{ season: string; gamesPlayed: number; pointsPerGame?: number; savePct?: number }>;
  scoringBreakdown: FppgBreakdown | null;
}

export interface DraftPlayerDirectoryMeta {
  scoringKind: 'league-profile' | 'default-fallback';
  scoringLabel: string;
  statsSeason: string;
  updatedAt: string | null;
  playerCount: number;
  positionalAverages: Record<string, { avgFppg: number; sampleSize: number }>;
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
  stats: Record<string, any>;
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
    stats: statsPayload.players ?? {},
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
  const players = directory.players.map((player) => {
      const snapshot = directory.stats[player.id];
      const nhlSeason = snapshot?.careerHistory?.[directory.statsSeasonId];
      const nhlGamesPlayed = Number(nhlSeason?.gamesPlayed ?? 0);
      const calculatedFppg = player.pos.includes('G')
        ? calculateFppgFromGoalieStats(snapshot?.goalieStats as GoalieStats | undefined, leagueProfile)
        : calculateFppgFromSkaterStats(snapshot?.skaterStats as SkaterStats | undefined, leagueProfile);
      const scoringBreakdown = nhlGamesPlayed > 0 ? (player.pos.includes('G')
        ? calculateGoalieFppgBreakdown(snapshot?.goalieStats as GoalieStats | undefined, leagueProfile)
        : calculateSkaterFppgBreakdown(snapshot?.skaterStats as SkaterStats | undefined, leagueProfile)) : null;
      const blendedFppg = nhlGamesPlayed > 0 && calculatedFppg > 0 ? calculatedFppg : null;
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

      return {
        ...player,
        blendedFppg,
        productionValue: blendedFppg ?? pointsPerGame ?? (savePct > 0 ? savePct : null),
        productionLabel,
        nhlGamesPlayed,
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
      statsSeason: directory.statsSeason,
      updatedAt: directory.generatedAt,
      playerCount: players.length,
      positionalAverages,
    },
  };
}
