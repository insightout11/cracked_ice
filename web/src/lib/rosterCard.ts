/**
 * Roster Card: paste a fantasy roster, get a team name, a (gently roasting) verdict on
 * what the draft says about you, and a few strange-but-true facts.
 *
 * Every trait (age, injuries, draft pedigree, Stanley Cups, penalty minutes...) is
 * measured against a baseline of simulated real drafts, and the card shows only what is
 * unusual about this roster, one topic per line. Pure functions over the public player
 * bio file (web/public/player-bio.json, built nightly by scripts/build-player-bio.mjs),
 * so the card is instant and needs no sign-in.
 */
import { rosterBaseline, rarity } from './rosterCardBaseline';
import { rosterTeamName } from './rosterCardNames';
import { buildContext, pickVariant, TRAITS, BALANCED_VERDICTS, type TraitResult } from './rosterCardTraits';

export interface BioPlayer {
  id: string;
  name: string;
  team: string;
  pos: string[];
  number: number | null;
  shoots: string | null;
  heightIn: number | null;
  weightLb: number | null;
  birthDate: string | null;
  country: string | null;
  city: string | null;
  /** Average Yahoo draft pick (null: rarely drafted). Lower is more recognisable. */
  adp: number | null;
  /** NHL draft slot; 'undrafted' when no team drafted him; null when unknown. */
  draft: { year: number; round: number; overall: number } | 'undrafted' | null;
  /** Stanley Cups and major awards, e.g. { cup: 3, hart: 1 }. */
  awards: Record<string, number>;
  /** Career regular season: skaters' games, goals, points, PIM; goalies' games, wins, shutouts. */
  career: { gp: number; goals: number; points: number; pim: number; wins: number; shutouts: number } | null;
  /** Last completed season (same fields; goalies add save % and GAA). Null: no NHL games. */
  last: { gp: number; goals: number; points: number; pim: number; wins: number; savePct: number | null } | null;
  /** First NHL season's starting year. */
  debut: number | null;
  /** How many NHL teams he has played for. */
  teams: number | null;
  legend: 'hof' | 'top100' | null;
  /** Current injury status (from /injuries.json), e.g. 'IR' or 'O'. */
  injury: string | null;
}

interface BioRow {
  id: string; n: string; t: string; p: string; no: number | null; sh: string | null; ht: number | null; wt: number | null;
  bd: string | null; co: string | null; ci: string | null; adp: number | null;
  dr?: [number, number, number] | 0; aw?: Record<string, number>; cr?: number[] | null; ls?: Array<number | null> | null;
  db?: number | null; tm?: number; lg?: 'hof' | 'top100';
}

export function parsePlayerBio(file: { players: BioRow[] }): BioPlayer[] {
  return file.players.map((row) => {
    const goalie = row.p === 'G';
    const career = row.cr ? (goalie
      ? { gp: row.cr[0], goals: 0, points: 0, pim: 0, wins: row.cr[1], shutouts: row.cr[2] }
      : { gp: row.cr[0], goals: row.cr[1], points: row.cr[2], pim: row.cr[3], wins: 0, shutouts: 0 }) : null;
    const ls = row.ls;
    const last = ls ? (goalie
      ? { gp: ls[0] ?? 0, goals: 0, points: 0, pim: 0, wins: ls[1] ?? 0, savePct: ls[2] ?? null }
      : { gp: ls[0] ?? 0, goals: ls[1] ?? 0, points: ls[2] ?? 0, pim: ls[3] ?? 0, wins: 0, savePct: null }) : null;
    return {
      id: row.id,
      name: row.n,
      team: row.t,
      pos: row.p ? row.p.split('/') : [],
      number: row.no,
      shoots: row.sh,
      heightIn: row.ht,
      weightLb: row.wt,
      birthDate: row.bd,
      country: row.co,
      city: row.ci,
      adp: row.adp,
      draft: row.dr === undefined ? null : row.dr === 0 ? 'undrafted' : { year: row.dr[0], round: row.dr[1], overall: row.dr[2] },
      awards: row.aw ?? {},
      career,
      last,
      debut: row.db ?? null,
      teams: row.tm ?? null,
      legend: row.lg ?? null,
      injury: null,
    };
  });
}

let bioRequest: Promise<BioPlayer[]> | null = null;
export function loadPlayerBio(): Promise<BioPlayer[]> {
  bioRequest ??= fetch('/player-bio.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Player list request failed (${response.status})`);
      return response.json() as Promise<{ players: BioRow[] }>;
    })
    .then(parsePlayerBio)
    .catch((error) => {
      bioRequest = null;
      throw error;
    });
  return bioRequest;
}

/** Copies of the players with today's injury statuses applied. */
export function withInjuryStatus(players: BioPlayer[], statuses: Record<string, string | undefined>): BioPlayer[] {
  return players.map((player) => ({ ...player, injury: statuses[`nhl:${player.id}`] ?? null }));
}

// ---------------------------------------------------------------------------
// Matching a pasted roster
// ---------------------------------------------------------------------------

/** Higher for players more people have heard of. */
export function fame(player: BioPlayer): number {
  return player.adp === null ? 0 : 1000 - player.adp;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9.'\- ]+/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Finds the players named anywhere in pasted text: a Yahoo/ESPN/Fantrax team page with all
 * its stats and menus, a list, a group-chat message. Full names win over short forms
 * ("C. McDavid"), and a name must stand as whole words. Some sites paste the team code
 * straight onto the name ("Connor McDavidEDM - C") or list names last-first ("McDavid,
 * Connor"), so those are rewritten first. When two players share a name, the
 * better-known one is taken.
 */
export function matchRosterText(text: string, players: BioPlayer[]): BioPlayer[] {
  const source = ` ${fold(text.replace(/([a-z])([A-Z]{2,4}\b)/g, '$1 $2'))} `;
  const identityMap = () => new Map<string, BioPlayer>();
  // Pass 1: "Connor McDavid" and "C. McDavid". Pass 2: "McDavid, Connor", only in text no
  // name has claimed, so "Connor McDavid, Connor Bedard" can't read as "McDavid Connor".
  const passes = [identityMap(), identityMap()];
  const add = (pass: Map<string, BioPlayer>, identity: string, player: BioPlayer) => {
    const current = pass.get(identity);
    if (!current || fame(player) > fame(current)) pass.set(identity, player);
  };
  players.forEach((player) => {
    const name = fold(player.name).trim();
    const [first, ...rest] = name.split(' ');
    add(passes[0], name, player);
    if (rest.length) {
      add(passes[0], `${first[0]}. ${rest.join(' ')}`, player);
      add(passes[1], `${rest.join(' ')} ${first}`, player);
    }
  });
  const taken = new Array(source.length).fill(false);
  const found: Array<{ at: number; player: BioPlayer }> = [];
  const seen = new Set<string>();
  passes.forEach((byIdentity) => {
    [...byIdentity.keys()].sort((a, b) => b.length - a.length).forEach((identity) => {
      let from = 0;
      for (;;) {
        const at = source.indexOf(identity, from);
        if (at < 0) break;
        from = at + 1;
        const before = source[at - 1];
        const after = source[at + identity.length] ?? ' ';
        if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
        if (taken.slice(at, at + identity.length).some(Boolean)) continue;
        const player = byIdentity.get(identity) as BioPlayer;
        for (let index = at; index < at + identity.length; index += 1) taken[index] = true;
        if (seen.has(player.id)) continue;
        seen.add(player.id);
        found.push({ at, player });
      }
    });
  });
  return found.sort((a, b) => a.at - b.at).map(({ player }) => player);
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

const COUNTRIES: Record<string, string> = {
  CAN: 'Canada', USA: 'the USA', SWE: 'Sweden', FIN: 'Finland', RUS: 'Russia', CZE: 'Czechia', SVK: 'Slovakia',
  CHE: 'Switzerland', DEU: 'Germany', BLR: 'Belarus', LVA: 'Latvia', DNK: 'Denmark', NOR: 'Norway', AUT: 'Austria',
  FRA: 'France', SVN: 'Slovenia', GBR: 'Great Britain', AUS: 'Australia', POL: 'Poland', ITA: 'Italy', BEL: 'Belgium',
  KAZ: 'Kazakhstan', UKR: 'Ukraine', NLD: 'the Netherlands',
};

export function countryName(code: string): string {
  return COUNTRIES[code] ?? code;
}

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

export interface RosterVerdict {
  key: string;
  title: string;
  roast: string;
}

export interface RosterFact {
  key: string;
  text: string;
}

export interface RosterCard {
  players: BioPlayer[];
  teamName: string;
  verdict: RosterVerdict;
  /** Other verdicts this roster also earned, shown as badges. */
  badges: string[];
  facts: RosterFact[];
  averageAge: number | null;
  countries: Array<{ code: string; count: number }>;
  /** Show country chips only when nationality is part of the story. */
  showCountries: boolean;
  /** What made the card, for the AI writer: most unusual first. */
  highlights: Array<{ key: string; text: string; rarity: number }>;
}

/** How unusual a trait must be (vs simulated drafts) to become the verdict, a badge, or a fact. */
const VERDICT_RARITY = 0.85;
const BADGE_RARITY = 0.96;
const FACT_RARITY = 0.7;
/** Copy that claims an extreme needs a roster in the top (or bottom) 15%. */
const EXTREME_RARITY = 0.85;

export function scoreTraits(players: BioPlayer[], baselinePool: BioPlayer[], today: string): TraitResult[] {
  const baseline = rosterBaseline(baselinePool, today);
  const ctx = buildContext(players, today);
  return TRAITS.flatMap((trait) => {
    const value = trait.measure(ctx);
    if (value === null || (trait.min !== undefined && (trait.direction === 'high' ? value < trait.min : value > trait.min))) return [];
    return [{ trait, value, rarity: rarity(baseline[trait.id] ?? [], value, trait.direction), ctx }];
  });
}

export function buildRosterCard(players: BioPlayer[], today: string, nameIndex = 0, baselinePool: BioPlayer[] = players): RosterCard {
  const seed = players.map((player) => player.id).sort().join(',');
  const scored = scoreTraits(players, baselinePool, today).sort((a, b) => b.rarity - a.rarity || a.trait.priority - b.trait.priority);
  const interest = (result: TraitResult) => result.rarity + (result.trait.boost ?? 0);
  const verdictResult = scored
    .filter((result) => result.trait.verdict && result.rarity >= VERDICT_RARITY)
    .sort((a, b) => interest(b) - interest(a) || a.trait.priority - b.trait.priority)[0];
  const verdict = verdictResult
    ? { key: verdictResult.trait.id, ...pickVariant(verdictResult.trait.verdict?.(verdictResult.ctx, verdictResult.value) ?? [], seed + verdictResult.trait.id) }
    : { key: 'balanced', ...pickVariant(BALANCED_VERDICTS, seed) };
  const usedTopics = new Set(verdictResult ? [verdictResult.trait.topic] : []);
  const facts: Array<RosterFact & { rarity: number }> = [];
  const take = (minimum: number) => {
    for (const result of scored) {
      if (facts.length >= 3) return;
      if (result.rarity < minimum || usedTopics.has(result.trait.topic) || !result.trait.fact) continue;
      // Copy that claims an extreme ("the refs send them holiday cards") needs a roster that is one.
      if (result.trait.extreme && result.rarity < EXTREME_RARITY) continue;
      const text = pickVariant(result.trait.fact(result.ctx, result.value), seed + result.trait.id);
      if (!text) continue;
      usedTopics.add(result.trait.topic);
      facts.push({ key: result.trait.id, text, rarity: result.rarity });
    }
  };
  take(FACT_RARITY);
  take(0.5);
  take(0);
  const badges = scored
    // Badges are for traits not already on the card.
    .filter((result) => result !== verdictResult && result.trait.verdict && result.rarity >= BADGE_RARITY && !usedTopics.has(result.trait.topic))
    .slice(0, 2)
    .map((result) => pickVariant(result.trait.verdict?.(result.ctx, result.value) ?? [], seed + result.trait.id).title);
  const ctx = buildContext(players, today);
  const countryCounts = new Map<string, number>();
  players.forEach((player) => { if (player.country) countryCounts.set(player.country, (countryCounts.get(player.country) ?? 0) + 1); });
  const nationTopic = usedTopics.has('nations');
  return {
    players,
    teamName: rosterTeamName(players, nameIndex),
    verdict,
    badges,
    facts: facts.map(({ key, text }) => ({ key, text })),
    averageAge: ctx.averageAge === null ? null : Math.round(ctx.averageAge * 10) / 10,
    countries: [...countryCounts.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    showCountries: nationTopic,
    highlights: [
      ...(verdictResult ? [{ key: verdict.key, text: `${verdict.title}: ${verdict.roast}`, rarity: verdictResult.rarity }] : []),
      ...facts.map(({ key, text, rarity: value }) => ({ key, text, rarity: value })),
    ],
  };
}

// ---------------------------------------------------------------------------
// This week, for the "what next" hook under the card
// ---------------------------------------------------------------------------

export interface WeekPreviewDay {
  date: string;
  nhlGames: number;
  yourPlayers: number;
}

export interface WeekPreview {
  weekStart: string;
  days: WeekPreviewDay[];
  yourGames: number;
  /** Nights with 13+ NHL games, when lineups jam up. */
  packedNights: WeekPreviewDay[];
  /** The light night (8 or fewer games) where the fewest of your players play. */
  bestStreamNight: WeekPreviewDay | null;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildWeekPreview(players: BioPlayer[], games: Record<string, Array<{ date: string }>>, weekStart: string): WeekPreview {
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const teamsByDate = new Map<string, Set<string>>(dates.map((date) => [date, new Set()]));
  Object.entries(games).forEach(([team, schedule]) => schedule.forEach((game) => teamsByDate.get(game.date)?.add(team)));
  const days = dates.map((date) => {
    const teams = teamsByDate.get(date) as Set<string>;
    return { date, nhlGames: teams.size / 2, yourPlayers: players.filter((player) => teams.has(player.team)).length };
  });
  const light = days.filter((day) => day.nhlGames > 0 && day.nhlGames <= 8);
  return {
    weekStart,
    days,
    yourGames: days.reduce((sum, day) => sum + day.yourPlayers, 0),
    packedNights: days.filter((day) => day.nhlGames >= 13),
    bestStreamNight: light.sort((a, b) => a.yourPlayers - b.yourPlayers || a.date.localeCompare(b.date))[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// The lineup, for the back of the card and the copy-as-text
// ---------------------------------------------------------------------------

export interface RosterGroup {
  label: 'Forwards' | 'Defence' | 'Goalies';
  players: BioPlayer[];
}

/** Forwards, defence and goalies, best-known first. Dual-eligible D-men count as defence. */
export function rosterGroups(players: BioPlayer[]): RosterGroup[] {
  const byFame = [...players].sort((a, b) => fame(b) - fame(a) || a.name.localeCompare(b.name));
  const goalies = byFame.filter((player) => player.pos.includes('G'));
  const defence = byFame.filter((player) => !player.pos.includes('G') && player.pos.includes('D'));
  const forwards = byFame.filter((player) => !goalies.includes(player) && !defence.includes(player));
  return ([['Forwards', forwards], ['Defence', defence], ['Goalies', goalies]] as const)
    .filter(([, group]) => group.length > 0)
    .map(([label, group]) => ({ label, players: group }));
}

/** The card as plain text for a group chat: name, verdict, roast, lineup, link. */
export function rosterCardText(card: Pick<RosterCard, 'teamName' | 'verdict' | 'players'>, url: string): string {
  return [
    `${card.teamName}: ${card.verdict.title}`,
    card.verdict.roast,
    '',
    ...rosterGroups(card.players).map((group) => `${group.label}: ${group.players.map((player) => `${player.name} (${player.team})`).join(', ')}`),
    '',
    `What does your draft say about you? ${url}`,
  ].join('\n');
}
