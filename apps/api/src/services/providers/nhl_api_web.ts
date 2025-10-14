import type { PlayerFppg, StatsProvider } from '../stats_provider';

const UA = 'cracked-ice/1.0 (+https://crackedicehockey.com)';

async function j<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return (await response.json()) as T;
}

const POINT_WEIGHTS = {
  goals: 3,
  assists: 2,
  shots: 0.4,
  blocks: 0.6,
  powerPlayPoints: 0.5
} as const;

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function fantasyPoints(sample: {
  goals?: unknown;
  assists?: unknown;
  shots?: unknown;
  shotsOnGoal?: unknown;
  blockedShots?: unknown;
  blocks?: unknown;
  powerPlayPoints?: unknown;
  ppPoints?: unknown;
}): number {
  return (
    toNumber(sample.goals) * POINT_WEIGHTS.goals +
    toNumber(sample.assists) * POINT_WEIGHTS.assists +
    (toNumber(sample.shots) || toNumber(sample.shotsOnGoal)) * POINT_WEIGHTS.shots +
    (toNumber(sample.blockedShots) || toNumber(sample.blocks)) * POINT_WEIGHTS.blocks +
    (toNumber(sample.powerPlayPoints) || toNumber(sample.ppPoints)) * POINT_WEIGHTS.powerPlayPoints
  );
}

export const nhlApiWebProvider: StatsProvider = {
  name: 'api-web.nhle.com',
  async fetchPlayerFppg(id: string, season: string) {
    const seasonNumber = Number(season);

    const landing = (await j<Record<string, unknown>>(`https://api-web.nhle.com/v1/player/${id}/landing`)) as any;
    const seasonTotals: any[] = Array.isArray(landing?.seasonTotals) ? landing.seasonTotals : [];
    const totals = seasonTotals.find((entry) => Number(entry?.season) === seasonNumber && Number(entry?.gameTypeId ?? entry?.gameType) === 2);
    if (!totals) {
      return null;
    }

    const gamesPlayed = toNumber(totals.gamesPlayed ?? totals.games);
    const seasonPoints = fantasyPoints(totals);
    const seasonFppg = gamesPlayed > 0 ? Number((seasonPoints / gamesPlayed).toFixed(2)) : 0;

    type Game = {
      gameDate?: string;
      date?: string;
      goals?: number;
      assists?: number;
      shots?: number;
      shotsOnGoal?: number;
      blockedShots?: number;
      blocks?: number;
      powerPlayPoints?: number;
      ppPoints?: number;
    };
    const rawLog = await j<{ gameLog?: Game[] } | Game[]>(`https://api-web.nhle.com/v1/player/${id}/game-log/${season}/2`);
    const games: Game[] = Array.isArray(rawLog) ? rawLog : rawLog.gameLog ?? [];

    const now = new Date();
    const d30 = new Date(now);
    d30.setUTCDate(d30.getUTCDate() - 30);
    const d7 = new Date(now);
    d7.setUTCDate(d7.getUTCDate() - 7);

    let points30 = 0;
    let games30 = 0;
    let points7 = 0;
    let games7 = 0;

    for (const game of games) {
      const dateString = game.date ?? game.gameDate;
      if (!dateString) continue;
      const dt = new Date(`${dateString}T00:00:00Z`);
      const gamePoints = fantasyPoints(game);

      if (dt >= d30) {
        points30 += gamePoints;
        games30 += 1;
      }
      if (dt >= d7) {
        points7 += gamePoints;
        games7 += 1;
      }
    }

    const last30Fppg = games30 ? Number((points30 / games30).toFixed(2)) : 0;
    const last7Fppg = games7 ? Number((points7 / games7).toFixed(2)) : 0;
    const blendedFppg = Number((seasonFppg * 0.5 + last30Fppg * 0.3 + last7Fppg * 0.2).toFixed(2));

    return {
      seasonFppg,
      last30Fppg,
      last7Fppg,
      blendedFppg
    } satisfies PlayerFppg;
  }
};