/**
 * Roster Card: paste a fantasy roster, get a team name, a (gently roasting) verdict on
 * what the draft says about you, and a few strange-but-true facts. Pure functions over
 * the public player bio file (web/public/player-bio.json, built nightly by
 * scripts/build-player-bio.mjs), so the card is instant and needs no sign-in.
 */
import { rosterTeamName } from './rosterCardNames';

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
}

interface BioFile {
  updatedAt: string;
  players: Array<[string, string, string, string, number | null, string | null, number | null, number | null, string | null, string | null, string | null, number | null]>;
}

export function parsePlayerBio(file: BioFile): BioPlayer[] {
  return file.players.map(([id, name, team, pos, number, shoots, heightIn, weightLb, birthDate, country, city, adp]) => ({
    id, name, team, pos: pos ? pos.split('/') : [], number, shoots, heightIn, weightLb, birthDate, country, city, adp,
  }));
}

let bioRequest: Promise<BioPlayer[]> | null = null;
export function loadPlayerBio(): Promise<BioPlayer[]> {
  bioRequest ??= fetch('/player-bio.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Player list request failed (${response.status})`);
      return response.json() as Promise<BioFile>;
    })
    .then(parsePlayerBio)
    .catch((error) => {
      bioRequest = null;
      throw error;
    });
  return bioRequest;
}

// ---------------------------------------------------------------------------
// Matching a pasted roster
// ---------------------------------------------------------------------------

/** Higher for players more people have heard of. */
export function fame(player: BioPlayer): number {
  return player.adp === null ? 0 : 1000 - player.adp;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.'\- ]+/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Finds the players named anywhere in pasted text: a Yahoo/ESPN/Fleaflicker team page,
 * a list, a group-chat message. Full names win over short forms ("C. McDavid"), and a
 * name must stand as whole words. Some sites paste the team code straight onto the name
 * ("Connor McDavidEDM - C"), so those are split apart first. When two players share a
 * name, the better-known one is taken.
 */
export function matchRosterText(text: string, players: BioPlayer[]): BioPlayer[] {
  const source = ` ${fold(text.replace(/([a-z])([A-Z]{2,4}\b)/g, '$1 $2'))} `;
  const byIdentity = new Map<string, BioPlayer>();
  const add = (identity: string, player: BioPlayer) => {
    const current = byIdentity.get(identity);
    if (!current || fame(player) > fame(current)) byIdentity.set(identity, player);
  };
  players.forEach((player) => {
    const name = fold(player.name).trim();
    add(name, player);
    const parts = name.split(' ');
    if (parts.length >= 2) add(`${parts[0][0]}. ${parts.slice(1).join(' ')}`, player);
  });
  const identities = [...byIdentity.keys()].sort((a, b) => b.length - a.length);
  const taken = new Array(source.length).fill(false);
  const found: Array<{ at: number; player: BioPlayer }> = [];
  const seen = new Set<string>();
  identities.forEach((identity) => {
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
  return found.sort((a, b) => a.at - b.at).map(({ player }) => player);
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

const COUNTRIES: Record<string, string> = {
  CAN: 'Canada',
  USA: 'the USA',
  SWE: 'Sweden',
  FIN: 'Finland',
  RUS: 'Russia',
  CZE: 'Czechia',
  SVK: 'Slovakia',
  CHE: 'Switzerland',
  DEU: 'Germany',
  BLR: 'Belarus',
  LVA: 'Latvia',
  DNK: 'Denmark',
  NOR: 'Norway',
  AUT: 'Austria',
  FRA: 'France',
  SVN: 'Slovenia',
  GBR: 'Great Britain',
  AUS: 'Australia',
  POL: 'Poland',
  ITA: 'Italy',
  BEL: 'Belgium',
  KAZ: 'Kazakhstan',
  UKR: 'Ukraine',
  NLD: 'the Netherlands',
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
  /** Other verdicts this roster qualified for, shown as badges. */
  badges: string[];
  facts: RosterFact[];
  averageAge: number | null;
  countries: Array<{ code: string; count: number }>;
}

const lastName = (player: BioPlayer) => player.name.split(' ').slice(1).join(' ') || player.name;
const round1 = (value: number) => Math.round(value * 10) / 10;
const TEAM_NAMES: Record<string, string> = {
  ANA: 'Ducks', BOS: 'Bruins', BUF: 'Sabres', CAR: 'Hurricanes', CBJ: 'Blue Jackets', CGY: 'Flames', CHI: 'Blackhawks', COL: 'Avalanche', DAL: 'Stars', DET: 'Red Wings', EDM: 'Oilers', FLA: 'Panthers', LAK: 'Kings', MIN: 'Wild', MTL: 'Canadiens', NJD: 'Devils', NSH: 'Predators', NYI: 'Islanders', NYR: 'Rangers', OTT: 'Senators', PHI: 'Flyers', PIT: 'Penguins', SEA: 'Kraken', SJS: 'Sharks', STL: 'Blues', TBL: 'Lightning', TOR: 'Maple Leafs', UTA: 'Mammoth', VAN: 'Canucks', VGK: 'Golden Knights', WPG: 'Jets', WSH: 'Capitals',
};

function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

function exactAge(birthDate: string, today: string): number {
  return (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${birthDate}T00:00:00Z`)) / (365.2425 * 86_400_000);
}

function mostCommon<T>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let best: { value: T; count: number } | null = null;
  counts.forEach((count, value) => { if (!best || count > best.count) best = { value, count }; });
  return best;
}

/** Nationality verdicts: when one country is most of the roster. */
const COUNTRY_VERDICTS: Record<string, (count: number) => RosterVerdict> = {
  SWE: (count) => ({ key: 'swe', title: 'Swedish House Mafia', roast: `${count} Swedes. Your lineup comes flat-packed with an Allen key and one screw missing.` }),
  FIN: (count) => ({ key: 'fin', title: 'The Finnish Line', roast: `${count} Finns. Nobody on this team has ever said more than four words in an interview, and they don't plan to start.` }),
  RUS: (count) => ({ key: 'rus', title: 'From Russia With Goals', roast: `${count} Russians. Your highlight reel needs its own streaming service.` }),
  CZE: (count) => ({ key: 'cze', title: 'Czech Mate', roast: `${count} Czechs. You drafted like it's Nagano '98 and you're still riding the high.` }),
  USA: (count) => ({ key: 'usa', title: 'The Miracle on Ice Remake', roast: `${count} Americans. Somewhere, a bald eagle is doing a slow-motion fly-by over your roster.` }),
  CAN: (count) => ({ key: 'can', title: 'Canadian Content Quota', roast: `${count} Canadians. Your team says sorry after every goal and means it.` }),
};

function verdictsFor(players: BioPlayer[], today: string): Array<RosterVerdict & { score: number }> {
  const verdicts: Array<RosterVerdict & { score: number }> = [];
  const size = players.length;
  const ages = players.filter((player) => player.birthDate).map((player) => exactAge(player.birthDate as string, today));
  const avgAge = ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null;

  if (avgAge !== null && avgAge >= 29.3) verdicts.push({ key: 'old', score: (avgAge - 28.5) / 2, title: 'The Nostalgia Tour', roast: `Average age ${round1(avgAge)}. You drafted like it's 2016 and honestly? You'd do it again.` });
  if (avgAge !== null && avgAge <= 25.7) verdicts.push({ key: 'young', score: (26.5 - avgAge) / 2, title: 'The Youth Movement', roast: `Average age ${round1(avgAge)}. Half your roster needs a signed permission slip for road trips.` });

  const team = mostCommon(players.map((player) => player.team));
  if (team && team.count >= 4) verdicts.push({ key: 'homer', score: team.count / 4 + 0.2, title: 'The Homer', roast: `${team.count} ${TEAM_NAMES[team.value] ?? team.value}. This isn't a fantasy team, it's a fan club with a waiver wire.` });

  const known = players.filter((player) => player.country);
  const country = mostCommon(known.map((player) => player.country as string));
  if (country && known.length >= 6) {
    const share = country.count / known.length;
    // Canada is the default; it has to be overwhelming to be a personality.
    const threshold = country.value === 'CAN' ? 0.7 : country.value === 'USA' ? 0.5 : 0.25;
    const make = COUNTRY_VERDICTS[country.value];
    if (make && share >= threshold && country.count >= 3) verdicts.push({ ...make(country.count), score: share / threshold });
  }
  const countryCount = new Set(known.map((player) => player.country)).size;
  if (countryCount >= 7) verdicts.push({ key: 'world', score: countryCount / 7, title: 'The United Nations', roast: `${countryCount} countries on one roster. Your locker room needs subtitles and a very patient translator.` });

  const goalies = players.filter((player) => player.pos.includes('G')).length;
  if (goalies >= 4) verdicts.push({ key: 'goalies', score: goalies / 4 + 0.1, title: 'The Goalie Hoarder', roast: `${goalies} goalies. Someone burned you in a goalie run once and you have never, ever forgotten.` });
  if (size >= 8 && goalies === 0) verdicts.push({ key: 'nogoalie', score: 1.1, title: 'The Empty Net', roast: 'Zero goalies. Bold. Either this is a skaters-only league or you are about to learn something.' });
  const defense = players.filter((player) => player.pos.includes('D')).length;
  if (defense >= 7 || defense / size >= 0.45) verdicts.push({ key: 'defense', score: defense / 7, title: 'The Blue Line Bunker', roast: `${defense} defensemen. You don't want to win 7-6. You want to win 1-0 and bore everyone into submission.` });

  const weights = players.map((player) => player.weightLb).filter((value): value is number => value !== null);
  const heights = players.map((player) => player.heightIn).filter((value): value is number => value !== null);
  const avgWeight = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
  const avgHeight = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : null;
  if (avgWeight !== null && avgWeight >= 203) verdicts.push({ key: 'heavy', score: (avgWeight - 195) / 10, title: 'The Heavyweights', roast: `Average ${Math.round(avgWeight)} lb. Your team doesn't drive the net, it relocates it.` });
  if (avgHeight !== null && avgHeight <= 71.8) verdicts.push({ key: 'small', score: (73 - avgHeight) / 1.5, title: 'Fun Size', roast: `Average height ${Math.floor(avgHeight / 12)}'${Math.round(avgHeight % 12)}". Small, fast, and constantly asked if they're the stick boys.` });

  const shooters = players.filter((player) => player.shoots && !player.pos.includes('G'));
  const lefties = shooters.filter((player) => player.shoots === 'L').length;
  if (shooters.length >= 8 && lefties / shooters.length >= 0.85) verdicts.push({ key: 'lefties', score: lefties / shooters.length, title: 'All Lefties, No Problem', roast: `${lefties} of ${shooters.length} skaters shoot left. Your power play only knows one side of the ice and it's thriving there.` });

  return verdicts;
}

const BALANCED: RosterVerdict = {
  key: 'balanced',
  title: 'The Balanced Breakfast',
  roast: 'No weird obsessions, no hometown bias, no goalie hoarding. Suspiciously sensible. Your league is either scared of you or asleep.',
};

/** Pop-culture birth years, for "X was born the year Y". Oldest players are 1985+. */
const BORN_THE_YEAR: Record<number, string> = {
  1984: 'Ghostbusters came out', 1985: 'Back to the Future came out', 1986: 'Top Gun came out', 1987: 'The Simpsons first aired as a sketch',
  1988: 'Die Hard came out', 1989: 'the Game Boy came out', 1990: 'Home Alone came out', 1991: 'Sonic the Hedgehog came out',
  1992: 'The Mighty Ducks came out', 1993: 'Jurassic Park came out', 1994: 'Friends first aired', 1995: 'Toy Story came out',
  1996: 'Space Jam came out', 1997: 'the first Harry Potter book came out',
};

function factsFor(players: BioPlayer[], today: string): Array<RosterFact & { score: number }> {
  const facts: Array<RosterFact & { score: number }> = [];
  const dated = players.filter((player) => player.birthDate) as Array<BioPlayer & { birthDate: string }>;

  // Shared birthdays.
  const byDay = new Map<string, BioPlayer[]>();
  dated.forEach((player) => byDay.set(player.birthDate.slice(5), [...(byDay.get(player.birthDate.slice(5)) ?? []), player]));
  const twins = [...byDay.entries()].find(([, group]) => group.length >= 2);
  if (twins) {
    const [day, group] = twins;
    const label = new Date(`2000-${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
    facts.push({ key: 'birthday', score: 0.95, text: `${group[0].name} and ${group[1].name} share a birthday (${label}). One cake, two candles, zero excuses.` });
  }

  // Same jersey number.
  const byNumber = new Map<number, BioPlayer[]>();
  players.forEach((player) => { if (player.number !== null) byNumber.set(player.number, [...(byNumber.get(player.number) ?? []), player]); });
  const sameNumber = [...byNumber.entries()].find(([, group]) => group.length >= 2);
  if (sameNumber) {
    const [number, group] = sameNumber;
    const who = group.length === 2 ? `${lastName(group[0])} and ${lastName(group[1])} both wear` : `${group.length} of your players wear`;
    facts.push({ key: 'number', score: 0.7, text: `${who} #${number}. Laundry day is chaos.` });
  }

  // Same hometown.
  const byCity = new Map<string, BioPlayer[]>();
  players.forEach((player) => { if (player.city) byCity.set(`${player.city}|${player.country}`, [...(byCity.get(`${player.city}|${player.country}`) ?? []), player]); });
  const hometown = [...byCity.entries()].find(([, group]) => group.length >= 2);
  if (hometown) facts.push({ key: 'hometown', score: 0.85, text: `${hometown[1][0].name} and ${hometown[1][1].name} were both born in ${hometown[0].split('|')[0]}. Carpool to the rink sorted.` });

  // Younger than YouTube (launched Feb 14, 2005).
  const youtube = dated.filter((player) => player.birthDate >= '2005-02-14');
  if (youtube.length) facts.push({ key: 'youtube', score: 0.8, text: youtube.length === 1 ? `${youtube[0].name} is younger than YouTube.` : `${youtube.length} of your players are younger than YouTube.` });

  // Oldest vs youngest.
  if (dated.length >= 2) {
    const sorted = [...dated].sort((a, b) => a.birthDate.localeCompare(b.birthDate));
    const oldest = sorted[0];
    const youngest = sorted[sorted.length - 1];
    const gap = exactAge(oldest.birthDate, youngest.birthDate);
    if (gap >= 14) facts.push({ key: 'babysat', score: 0.75, text: `${oldest.name} is ${Math.floor(gap)} years older than ${youngest.name}. He could have been his babysitter.` });
    const year = Number(oldest.birthDate.slice(0, 4));
    if (BORN_THE_YEAR[year]) facts.push({ key: 'born', score: 0.65, text: `Your oldest player, ${oldest.name}, was born the year ${BORN_THE_YEAR[year]}.` });
  }

  // Stacked height.
  const heights = players.map((player) => player.heightIn).filter((value): value is number => value !== null);
  if (heights.length >= 5) {
    const meters = heights.reduce((a, b) => a + b, 0) * 0.0254;
    const feet = Math.round(meters * 3.281);
    facts.push({ key: 'height', score: 0.6, text: `Stacked head to toe, your roster is ${Math.round(meters)} m (${feet} ft) tall. That's about a ${Math.round(meters / 3)}-storey building.` });
  }

  // Combined weight, in hippos (an adult hippo is about 3,300 lb).
  const weights = players.map((player) => player.weightLb).filter((value): value is number => value !== null);
  if (weights.length >= 5) {
    const total = weights.reduce((a, b) => a + b, 0);
    facts.push({ key: 'weight', score: 0.55, text: `Combined, your players weigh ${total.toLocaleString('en-US')} lb. That's ${round1(total / 3300)} hippos.` });
  }

  // Countries.
  const countries = new Set(players.map((player) => player.country).filter(Boolean));
  if (countries.size >= 4) facts.push({ key: 'countries', score: 0.5 + countries.size * 0.04, text: `Your players come from ${countries.size} countries. Customs is going to take a while on road trips.` });

  // Shooting hand.
  const shooters = players.filter((player) => player.shoots && !player.pos.includes('G'));
  const righties = shooters.filter((player) => player.shoots === 'R');
  if (shooters.length >= 6 && righties.length <= 1) facts.push({ key: 'righties', score: 0.7, text: righties.length === 0 ? 'Not one of your skaters shoots right. Your one-timers all come from the same side.' : `${righties[0].name} is your only right-handed shot. He's carrying the whole right side.` });

  // Filler when nothing stranger turned up.
  const age = dated.length ? Math.round(dated.reduce((sum, player) => sum + ageOn(player.birthDate, today), 0) / dated.length) : null;
  if (age !== null && facts.length < 3) facts.push({ key: 'age', score: 0.3, text: `The typical player on your team is ${age}.` });

  return facts;
}

export function buildRosterCard(players: BioPlayer[], today: string, nameIndex = 0): RosterCard {
  const verdicts = verdictsFor(players, today).sort((a, b) => b.score - a.score);
  const [top, ...rest] = verdicts;
  const facts = factsFor(players, today).sort((a, b) => b.score - a.score).slice(0, 3);
  const ages = players.filter((player) => player.birthDate).map((player) => exactAge(player.birthDate as string, today));
  const countryCounts = new Map<string, number>();
  players.forEach((player) => { if (player.country) countryCounts.set(player.country, (countryCounts.get(player.country) ?? 0) + 1); });
  return {
    players,
    teamName: rosterTeamName(players, nameIndex),
    verdict: top ? { key: top.key, title: top.title, roast: top.roast } : BALANCED,
    badges: rest.slice(0, 3).map((verdict) => verdict.title),
    facts: facts.map(({ key, text }) => ({ key, text })),
    averageAge: ages.length ? round1(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
    countries: [...countryCounts.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
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
