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

// REMOVED: Hardcoded scoring weights and fantasy points calculation
// FPPG values are now set to 0 and should be calculated at runtime using user's league settings
// See server/src/features/coach/presets.ts for league-specific scoring configurations

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

export const nhlStatsRestProvider: StatsProvider = {
  name: 'api.nhle.com',
  async fetchPlayerFppg(id: string, season: string) {
    type Row = Record<string, unknown>;
    type Resp = { data?: Row[] };

    const summary = await j<Resp>(`${BASE}/player/summary?isAggregate=false&isGame=false&season=${season}&gameTypeId=2&playerId=${id}`);
    const row = summary.data?.[0];
    if (!row) return null;

    // FPPG calculation removed - all FPPG values set to 0
    // Runtime FPPG calculation happens in server/src/features/coach/scoring.ts using league-specific weights
    // This provider is a fallback; raw stats extraction would go here if needed

    return {
      seasonFppg: 0,
      last30Fppg: 0,
      last7Fppg: 0,
      blendedFppg: 0
    } satisfies PlayerFppg;
  }
};