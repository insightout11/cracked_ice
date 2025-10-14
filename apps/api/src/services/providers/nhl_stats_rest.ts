import type { PlayerFppg, StatsProvider } from '../stats_provider';

const UA = 'cracked-ice/1.0 (+https://crackedicehockey.com)';
const BASE = 'https://api.nhle.com/stats/rest/en';

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
  blocked?: unknown;
  powerPlayPoints?: unknown;
  ppPoints?: unknown;
}): number {
  return (
    toNumber(sample.goals) * POINT_WEIGHTS.goals +
    toNumber(sample.assists) * POINT_WEIGHTS.assists +
    (toNumber(sample.shots) || toNumber(sample.shotsOnGoal)) * POINT_WEIGHTS.shots +
    (toNumber(sample.blockedShots) || toNumber(sample.blocked)) * POINT_WEIGHTS.blocks +
    (toNumber(sample.powerPlayPoints) || toNumber(sample.ppPoints)) * POINT_WEIGHTS.powerPlayPoints
  );
}

export const nhlStatsRestProvider: StatsProvider = {
  name: 'api.nhle.com',
  async fetchPlayerFppg(id: string, season: string) {
    type Row = Record<string, unknown>;
    type Resp = { data?: Row[] };

    const summary = await j<Resp>(`${BASE}/player/summary?isAggregate=false&isGame=false&season=${season}&gameTypeId=2&playerId=${id}`);
    const row = summary.data?.[0];
    if (!row) return null;

    const gamesPlayed = toNumber(row.gamesPlayed ?? row.games);
    const seasonPoints = fantasyPoints(row);
    const seasonFppg = gamesPlayed ? Number((seasonPoints / gamesPlayed).toFixed(2)) : 0;

    const log = await j<Resp>(`${BASE}/player/gamelog?isAggregate=false&isGame=false&season=${season}&gameTypeId=2&playerId=${id}`);

    const now = new Date();
    const d30 = new Date(now);
    d30.setUTCDate(d30.getUTCDate() - 30);
    const d7 = new Date(now);
    d7.setUTCDate(d7.getUTCDate() - 7);

    let points30 = 0;
    let games30 = 0;
    let points7 = 0;
    let games7 = 0;

    for (const game of log.data ?? []) {
      const dateString = (game.gameDate ?? game.date) as string | undefined;
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