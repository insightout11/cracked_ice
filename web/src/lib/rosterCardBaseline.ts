/**
 * What a normal fantasy roster looks like, so the Roster Card can tell what is unusual.
 *
 * Simulates 12-team, 16-round snake drafts from Yahoo average draft positions (with
 * noise, and the odd deep-league pick of an NHL regular nobody drafts in Yahoo), then
 * measures every card trait on every simulated roster. A roster trait is only worth
 * saying out loud when it is rare against this baseline.
 */
import type { BioPlayer } from './rosterCard';
import { buildContext, TRAITS } from './rosterCardTraits';

const LEAGUES = 150;
const TEAMS = 12;
const ROUNDS = 16;
const DEEP_PICK_CHANCE = 0.12;
/** Fantasy managers rarely roster more than three goalies. */
const MAX_GOALIES = 3;

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number): number {
  return Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
}

export function simulateRosters(pool: BioPlayer[], leagues = LEAGUES): BioPlayer[][] {
  const random = rng(20262027);
  const drafted = pool.filter((player) => player.adp !== null);
  const regulars = pool.filter((player) => player.adp === null && (player.last?.gp ?? 0) >= 30);
  const rosters: BioPlayer[][] = [];
  for (let league = 0; league < leagues; league += 1) {
    const board = drafted
      .map((player) => ({ player, value: (player.adp as number) * Math.exp(gaussian(random) * 0.3) }))
      .sort((a, b) => a.value - b.value)
      .map(({ player }) => player);
    const teams: BioPlayer[][] = Array.from({ length: TEAMS }, () => []);
    const taken = new Set<string>();
    let next = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      for (let slot = 0; slot < TEAMS; slot += 1) {
        const team = round % 2 === 0 ? slot : TEAMS - 1 - slot;
        let pick: BioPlayer | undefined;
        if (regulars.length && random() < DEEP_PICK_CHANCE) {
          const candidate = regulars[Math.floor(random() * regulars.length)];
          if (!taken.has(candidate.id) && !candidate.pos.includes('G')) pick = candidate;
        }
        const goalieFull = teams[team].filter((player) => player.pos.includes('G')).length >= MAX_GOALIES;
        for (let index = next; !pick && index < board.length; index += 1) {
          const candidate = board[index];
          if (taken.has(candidate.id) || (goalieFull && candidate.pos.includes('G'))) continue;
          pick = candidate;
        }
        while (next < board.length && taken.has(board[next].id)) next += 1;
        if (!pick) continue;
        taken.add(pick.id);
        teams[team].push(pick);
      }
    }
    rosters.push(...teams);
  }
  return rosters;
}

const cache = new WeakMap<BioPlayer[], Map<string, Record<string, number[]>>>();

/** Every trait's value on every simulated roster, sorted ascending. Memoized per pool and day. */
export function rosterBaseline(pool: BioPlayer[], today: string): Record<string, number[]> {
  const byDay = cache.get(pool) ?? new Map<string, Record<string, number[]>>();
  cache.set(pool, byDay);
  const cached = byDay.get(today);
  if (cached) return cached;
  const values: Record<string, number[]> = Object.fromEntries(TRAITS.map((trait) => [trait.id, []]));
  for (const roster of simulateRosters(pool)) {
    const ctx = buildContext(roster, today);
    for (const trait of TRAITS) {
      const value = trait.measure(ctx);
      if (value !== null) values[trait.id].push(value);
    }
  }
  Object.values(values).forEach((list) => list.sort((a, b) => a - b));
  byDay.set(today, values);
  return values;
}

/** Share of simulated rosters this value beats in the trait's direction (0.5 when no baseline). */
export function rarity(sorted: number[], value: number, direction: 'high' | 'low'): number {
  if (!sorted.length) return 0.5;
  let below = 0;
  let equal = 0;
  for (const item of sorted) {
    if (item < value) below += 1;
    else if (item === value) equal += 1;
  }
  const above = sorted.length - below - equal;
  return ((direction === 'high' ? below : above) + equal / 2) / sorted.length;
}
