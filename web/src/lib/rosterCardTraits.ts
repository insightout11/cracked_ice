/**
 * The Roster Card's traits: things a roster can be unusual about, each measured as one
 * number, with the verdict and fact copy to use when it is rare enough to mention.
 *
 * Copy rules: roast the manager's choices, not the players' lives; no jokes about
 * nationality beyond the light verdict names; every number comes from the data.
 */
import type { BioPlayer } from './rosterCard';

export interface CardContext {
  players: BioPlayer[];
  skaters: BioPlayer[];
  goalies: BioPlayer[];
  today: string;
  age: (player: BioPlayer) => number | null;
  averageAge: number | null;
}

export interface Trait {
  id: string;
  /** Traits sharing a topic never both appear on one card. */
  topic: string;
  /** Tie-break when two traits are equally rare: lower first. */
  priority: number;
  direction: 'high' | 'low';
  /** The value must reach this (in the trait's direction) to be mentioned at all. */
  min?: number;
  /** The copy claims the roster is extreme ("the refs send them holiday cards"), so it may only appear when it truly is. */
  extreme?: boolean;
  /** Nudges how interesting this trait is next to an equally rare one (verdicts only). */
  boost?: number;
  measure: (ctx: CardContext) => number | null;
  verdict?: (ctx: CardContext, value: number) => Array<{ title: string; roast: string }>;
  fact?: (ctx: CardContext, value: number) => Array<string | null>;
}

export interface TraitResult {
  trait: Trait;
  value: number;
  rarity: number;
  ctx: CardContext;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEAM_NAMES: Record<string, string> = {
  ANA: 'Ducks', BOS: 'Bruins', BUF: 'Sabres', CAR: 'Hurricanes', CBJ: 'Blue Jackets', CGY: 'Flames', CHI: 'Blackhawks', COL: 'Avalanche', DAL: 'Stars', DET: 'Red Wings', EDM: 'Oilers', FLA: 'Panthers', LAK: 'Kings', MIN: 'Wild', MTL: 'Canadiens', NJD: 'Devils', NSH: 'Predators', NYI: 'Islanders', NYR: 'Rangers', OTT: 'Senators', PHI: 'Flyers', PIT: 'Penguins', SEA: 'Kraken', SJS: 'Sharks', STL: 'Blues', TBL: 'Lightning', TOR: 'Maple Leafs', UTA: 'Mammoth', VAN: 'Canucks', VGK: 'Golden Knights', WPG: 'Jets', WSH: 'Capitals',
};
const AWARD_NAMES: Record<string, [string, string]> = {
  hart: ['Hart', 'Harts'], vezina: ['Vezina', 'Vezinas'], norris: ['Norris', 'Norrises'], artross: ['Art Ross', 'Art Rosses'],
  rocket: ['Rocket Richard', 'Rocket Richards'], smythe: ['Conn Smythe', 'Conn Smythes'], selke: ['Selke', 'Selkes'],
  lindsay: ['Ted Lindsay', 'Ted Lindsays'], calder: ['Calder', 'Calders'],
};
const MAJOR_AWARDS = ['hart', 'vezina', 'norris', 'artross', 'rocket', 'smythe', 'selke', 'lindsay'];
const OUT_STATUSES = new Set(['IR', 'IR-LT', 'IR-NR', 'O', 'NA', 'SUSP']);

const lastName = (player: BioPlayer) => player.name.split(' ').slice(1).join(' ') || player.name;
const firstName = (player: BioPlayer) => player.name.split(' ')[0];
const teamName = (code: string) => TEAM_NAMES[code] ?? code;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const round1 = (value: number) => Math.round(value * 10) / 10;
const byName = (a: BioPlayer, b: BioPlayer) => a.name.localeCompare(b.name);

function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`;
}

/** "A", "A and B", "A, B and C", "A, B and 3 others". */
function names(players: BioPlayer[], max = 3, short = false): string {
  const list = players.map((player) => (short ? lastName(player) : player.name));
  if (list.length <= 1) return list[0] ?? '';
  if (list.length <= max) return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  return `${list.slice(0, max - 1).join(', ')} and ${list.length - max + 1} others`;
}

function yearsBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (365.2425 * 86_400_000);
}

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const value = key(item);
    if (value === null) return;
    groups.set(value, [...(groups.get(value) ?? []), item]);
  });
  return groups;
}

function largestGroup<T>(items: T[], key: (item: T) => string | null): [string, T[]] | null {
  let best: [string, T[]] | null = null;
  groupBy(items, key).forEach((group, value) => { if (!best || group.length > best[1].length) best = [value, group]; });
  return best;
}

const isGoalie = (player: BioPlayer) => player.pos.includes('G');
const isOut = (player: BioPlayer) => player.injury !== null && OUT_STATUSES.has(player.injury.toUpperCase());
/** Established before last season, so a short season means he was hurt, not called up. */
const established = (player: BioPlayer) => !isGoalie(player) && player.career !== null && player.last !== null && player.career.gp - player.last.gp >= 150;
const missedLastSeason = (player: BioPlayer) => (established(player) ? Math.max(0, 82 - (player.last?.gp ?? 82)) : 0);
const rookieLike = (player: BioPlayer) => (player.career?.gp ?? 0) < 30;
const drafted = (player: BioPlayer) => (player.draft && player.draft !== 'undrafted' ? player.draft : null);

export function buildContext(players: BioPlayer[], today: string): CardContext {
  const age = (player: BioPlayer) => (player.birthDate ? yearsBetween(player.birthDate, today) : null);
  const ages = players.map(age).filter((value): value is number => value !== null);
  return {
    players,
    skaters: players.filter((player) => !isGoalie(player)),
    goalies: players.filter(isGoalie),
    today,
    age,
    averageAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
  };
}

/** A stable choice among copy variants, so the same roster always reads the same. */
export function pickVariant<T>(variants: Array<T | null>, seed: string): T {
  const usable = variants.filter((variant): variant is T => variant !== null);
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  return usable[(hash >>> 0) % usable.length];
}

export const BALANCED_VERDICTS = [
  { title: 'The Balanced Breakfast', roast: 'Nothing weird, nothing reckless, nothing to roast. Suspiciously sensible. Your league is either scared of you or asleep.' },
  { title: 'The Spreadsheet', roast: "Every box checked, every risk hedged. It's a very good team, and it has the personality of a tax return." },
  { title: 'Vanilla, Extra Vanilla', roast: "No hometown crush, no goalie hoarding, no reckless rookies. You drafted like someone who reads the terms and conditions." },
];

// ---------------------------------------------------------------------------
// Traits
// ---------------------------------------------------------------------------

export const TRAITS: Trait[] = [
  // Age -----------------------------------------------------------------------
  {
    id: 'age-old', extreme: true, topic: 'age', priority: 3, direction: 'high',
    measure: (ctx) => ctx.averageAge,
    verdict: (_ctx, value) => [
      { title: 'The Nostalgia Tour', roast: `Average age ${round1(value)}. You drafted like it's 2016 and honestly? You'd do it again.` },
      { title: 'Classic Rock Radio', roast: `Average age ${round1(value)}. All the hits, most of them from last decade.` },
      { title: 'The Farewell Tour', roast: `Average age ${round1(value)}. Every road trip is somebody's last visit to that building.` },
    ],
    fact: (_ctx, value) => [`Average age ${round1(value)}. Your warmups include a hot tub.`],
  },
  {
    id: 'age-young', extreme: true, topic: 'age', priority: 3, direction: 'low',
    measure: (ctx) => ctx.averageAge,
    verdict: (_ctx, value) => [
      { title: 'Daycare on Ice', roast: `Average age ${round1(value)}. Road trips require a permission slip and a juice box.` },
      { title: 'The Five-Year Plan', roast: `Average age ${round1(value)}. You're not drafting for this season, you're drafting for 2030.` },
      { title: 'Skip the Vets', roast: `Average age ${round1(value)}. Anyone over 28 was dead to you on draft day.` },
    ],
    fact: (_ctx, value) => [`Average age ${round1(value)}. Half this roster still gets carded at the rink bar.`],
  },
  {
    id: 'debut-before-born', topic: 'old-guard', priority: 5, direction: 'high', min: 1,
    measure: (ctx) => {
      const veteran = [...ctx.players].filter((player) => player.debut !== null).sort((a, b) => (a.debut as number) - (b.debut as number))[0];
      const youngest = [...ctx.players].filter((player) => player.birthDate).sort((a, b) => (b.birthDate as string).localeCompare(a.birthDate as string))[0];
      if (!veteran || !youngest || veteran === youngest) return null;
      return Number((youngest.birthDate as string).slice(0, 4)) - (veteran.debut as number);
    },
    fact: (ctx) => {
      const veteran = [...ctx.players].filter((player) => player.debut !== null).sort((a, b) => (a.debut as number) - (b.debut as number))[0];
      const youngest = [...ctx.players].filter((player) => player.birthDate).sort((a, b) => (b.birthDate as string).localeCompare(a.birthDate as string))[0];
      return [
        `${veteran.name} was already playing in the NHL when ${youngest.name} was born.`,
        `${veteran.name} made his NHL debut in ${veteran.debut}. ${youngest.name} was born in ${(youngest.birthDate as string).slice(0, 4)}.`,
      ];
    },
  },
  {
    id: 'under-21', topic: 'kids', priority: 6, direction: 'high', min: 1,
    measure: (ctx) => ctx.players.filter((player) => (ctx.age(player) ?? 99) < 21).length,
    fact: (ctx, value) => {
      const kids = ctx.players.filter((player) => (ctx.age(player) ?? 99) < 21).sort(byName);
      return value === 1
        ? [`${kids[0].name} can't legally buy a beer in the US. You drafted him anyway.`]
        : [`${value} of your players can't legally buy a beer in the US: ${names(kids, 3, true)}.`];
    },
  },

  // Team loyalty --------------------------------------------------------------
  {
    id: 'homer', boost: 0.03, topic: 'team', priority: 1, direction: 'high', min: 3,
    measure: (ctx) => largestGroup(ctx.players, (player) => player.team)?.[1].length ?? 0,
    verdict: (ctx, value) => {
      const team = teamName((largestGroup(ctx.players, (player) => player.team) as [string, BioPlayer[]])[0]);
      return [
        { title: `The ${team} Fan Club`, roast: `${value} ${team}. This isn't a fantasy team, it's a season ticket package.` },
        { title: 'The Homer', roast: `${value} ${team}. When they lose, you lose twice. You knew that on draft day.` },
        { title: 'Blind Loyalty', roast: `${value} ${team}. Your league knows exactly which jersey you're wearing right now.` },
      ];
    },
    fact: (ctx, value) => {
      const [code, group] = largestGroup(ctx.players, (player) => player.team) as [string, BioPlayer[]];
      return [`${value} ${teamName(code)}: ${names(group.sort(byName), 3, true)}. One bad ${teamName(code)} night and your whole week is done.`];
    },
  },

  // Injuries ------------------------------------------------------------------
  {
    id: 'hurt-now', boost: 0.04, topic: 'injury', priority: 0, direction: 'high', min: 1,
    measure: (ctx) => ctx.players.filter(isOut).length,
    verdict: (ctx, value) => {
      const hurt = ctx.players.filter(isOut).sort(byName);
      return [
        { title: 'The Infirmary', roast: `You drafted ${value} players who are already hurt: ${names(hurt, 3, true)}. The trainer is your most important signing.` },
        { title: 'Waiting Room', roast: `${value} players on the injury report before you set a lineup. You didn't draft a team, you drafted a waiting room.` },
      ];
    },
    fact: (ctx, value) => {
      const hurt = ctx.players.filter(isOut).sort(byName);
      return value === 1
        ? [`${hurt[0].name} is already on the injury report. You drafted him anyway: that's either faith or denial.`]
        : [`${names(hurt, 3, true)} are already on the injury report. Bold to plan around the trainer's room.`];
    },
  },
  {
    id: 'games-missed', extreme: true, topic: 'durability', priority: 2, direction: 'high', min: 40,
    measure: (ctx) => ctx.players.reduce((sum, player) => sum + missedLastSeason(player), 0),
    verdict: (_ctx, value) => [
      { title: 'Glass Cannons', roast: `Your veterans missed ${value} games last season. When healthy, terrifying. They are rarely healthy.` },
      { title: 'Handle With Care', roast: `${value} games missed last season between them. You didn't draft a roster, you drafted a medical file.` },
    ],
    fact: (ctx, value) => {
      const worst = [...ctx.players].sort((a, b) => missedLastSeason(b) - missedLastSeason(a))[0];
      return [`Your roster missed ${value} games last season. ${worst.name} alone sat out ${missedLastSeason(worst)}.`];
    },
  },

  // Draft pedigree ------------------------------------------------------------
  {
    id: 'first-overall', boost: 0.03, topic: 'pedigree', priority: 2, direction: 'high', min: 1,
    measure: (ctx) => ctx.players.filter((player) => drafted(player)?.overall === 1).length,
    verdict: (ctx, value) => [
      { title: 'The Lottery Winners', roast: `${value} first-overall picks: ${names(ctx.players.filter((player) => drafted(player)?.overall === 1).sort(byName), 3, true)}. You don't scout, you just take whoever the tank produced.` },
    ],
    fact: (ctx, value) => {
      const picks = ctx.players.filter((player) => drafted(player)?.overall === 1).sort(byName);
      return value === 1
        ? [`${picks[0].name} went first overall in ${drafted(picks[0])?.year}. The rest of your roster, famously, did not.`]
        : [`${value} first-overall picks on one roster: ${names(picks, 3, true)}. You like your players pre-approved.`];
    },
  },
  {
    id: 'top-ten-picks', extreme: true, topic: 'pedigree', priority: 4, direction: 'high', min: 3,
    measure: (ctx) => ctx.players.filter((player) => (drafted(player)?.overall ?? 999) <= 10).length,
    verdict: (_ctx, value) => [
      { title: 'Blue Chip Club', roast: `${value} top-10 NHL draft picks. You only shop at the designer store, and it shows.` },
      { title: 'Old Money', roast: `${value} top-10 NHL draft picks. Not one of your players has ever had to prove anything.` },
    ],
    fact: (_ctx, value) => [`${value} of your players were top-10 picks in the NHL draft. Scouting department: optional.`],
  },
  {
    id: 'undrafted', boost: 0.02, topic: 'underdog', priority: 2, direction: 'high', min: 1,
    measure: (ctx) => ctx.players.filter((player) => player.draft === 'undrafted').length,
    verdict: (ctx, value) => [
      { title: 'Island of Misfit Toys', roast: `${value} players no NHL team ever drafted: ${names(ctx.players.filter((player) => player.draft === 'undrafted').sort(byName), 3, true)}. You run a rescue shelter and honestly it's working.` },
      { title: 'The Spite Line', roast: `${value} undrafted players. Every one of them is playing to prove 32 GMs wrong, and so are you.` },
    ],
    fact: (ctx, value) => {
      const undrafted = ctx.players.filter((player) => player.draft === 'undrafted').sort(byName);
      return value === 1
        ? [`${undrafted[0].name} was never drafted. All 32 NHL teams passed on him. You didn't.`]
        : [`${names(undrafted, 3, true)} were never drafted by an NHL team. That's a whole roster of spite stories.`];
    },
  },
  {
    id: 'latest-pick', topic: 'underdog', priority: 5, direction: 'high', min: 120,
    measure: (ctx) => Math.max(0, ...ctx.players.map((player) => drafted(player)?.overall ?? 0)),
    fact: (ctx) => {
      const late = [...ctx.players].sort((a, b) => (drafted(b)?.overall ?? 0) - (drafted(a)?.overall ?? 0))[0];
      const draft = drafted(late) as { round: number; overall: number };
      return [`${late.name} was a ${ordinal(draft.round)}-round pick, ${ordinal(draft.overall)} overall. ${draft.overall - 1} players went before him, and now he's yours.`];
    },
  },

  // Hardware ------------------------------------------------------------------
  {
    id: 'cups', boost: 0.02, topic: 'hardware', priority: 2, direction: 'high', min: 1,
    measure: (ctx) => ctx.players.reduce((sum, player) => sum + (player.awards.cup ?? 0), 0),
    verdict: (ctx, value) => {
      const top = [...ctx.players].sort((a, b) => (b.awards.cup ?? 0) - (a.awards.cup ?? 0))[0];
      return [
        { title: 'Ring Collectors', roast: `${plural(value, 'Stanley Cup ring')} on one roster, ${top.awards.cup} of them ${lastName(top)}'s. You drafted a trophy room, not a team.` },
        { title: 'Been There, Won That', roast: `${plural(value, 'Stanley Cup')} between them. Your players have nothing left to prove, and it's showing in their effort.` },
      ];
    },
    fact: (ctx, value) => {
      const winners = ctx.players.filter((player) => player.awards.cup).sort((a, b) => (b.awards.cup ?? 0) - (a.awards.cup ?? 0));
      return [value === 1
        ? `${winners[0].name} is your only Stanley Cup winner. Expect to hear about it.`
        : `Your roster owns ${value} Stanley Cup rings. ${winners[0].name} has ${winners[0].awards.cup} of them.`];
    },
  },
  {
    id: 'cupless-veterans', topic: 'hardware', priority: 6, direction: 'high', min: 3000,
    measure: (ctx) => (ctx.players.some((player) => player.awards.cup) ? 0 : ctx.players.reduce((sum, player) => sum + (player.career?.gp ?? 0), 0)),
    fact: (_ctx, value) => [`${value.toLocaleString('en-US')} career NHL games on this roster. Zero Stanley Cups. Somebody has to break the streak.`],
  },
  {
    id: 'major-awards', boost: 0.02, topic: 'awards', priority: 3, direction: 'high', min: 2,
    measure: (ctx) => ctx.players.reduce((sum, player) => sum + MAJOR_AWARDS.reduce((total, key) => total + (player.awards[key] ?? 0), 0), 0),
    verdict: (_ctx, value) => [
      { title: 'The Trophy Case', roast: `${value} major NHL awards on one roster. You didn't draft a team, you drafted a museum.` },
    ],
    fact: (ctx) => {
      const totals = MAJOR_AWARDS.map((key) => [key, ctx.players.reduce((sum, player) => sum + (player.awards[key] ?? 0), 0)] as const).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
      const list = totals.slice(0, 3).map(([key, count]) => `${count} ${AWARD_NAMES[key][count === 1 ? 0 : 1]}`);
      return [`Trophy case: ${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]}. Your roster has an awards night.`];
    },
  },
  {
    id: 'legends', topic: 'legend', priority: 4, direction: 'high', min: 1,
    measure: (ctx) => ctx.players.filter((player) => player.legend).length,
    fact: (ctx, value) => {
      const legends = ctx.players.filter((player) => player.legend).sort(byName);
      return [value === 1
        ? `${legends[0].name} is on the NHL's list of the 100 greatest players ever. He's on your team to settle arguments.`
        : `${names(legends, 3, true)} are on the NHL's list of the 100 greatest players ever. You drafted a history book.`];
    },
  },

  // Experience ----------------------------------------------------------------
  {
    id: 'rookies', boost: 0.02, topic: 'experience', priority: 2, direction: 'high', min: 2,
    measure: (ctx) => ctx.players.filter(rookieLike).length,
    verdict: (ctx, value) => [
      { title: 'Lottery Ticket Collector', roast: `${value} players with fewer than 30 NHL games. You didn't draft a team, you drafted vibes and a highlight reel.` },
      { title: 'Potential, Mostly', roast: `${value} players still learning where the visitors' dressing room is. Very exciting. For about 2029.` },
    ],
    fact: (ctx, value) => {
      const greenest = ctx.players.filter(rookieLike).sort((a, b) => (a.career?.gp ?? 0) - (b.career?.gp ?? 0) || byName(a, b))[0];
      const games = greenest.career?.gp ?? 0;
      return [`${value} of your players have fewer than 30 NHL games. ${greenest.name} has ${games === 0 ? 'never played one' : plural(games, 'game')}.`];
    },
  },
  {
    id: 'career-games', topic: 'experience', priority: 5, direction: 'high',
    measure: (ctx) => ctx.players.reduce((sum, player) => sum + (player.career?.gp ?? 0), 0),
    fact: (ctx, value) => {
      const veteran = [...ctx.players].sort((a, b) => (b.career?.gp ?? 0) - (a.career?.gp ?? 0))[0];
      return [`${value.toLocaleString('en-US')} career NHL games between them, ${(veteran.career?.gp ?? 0).toLocaleString('en-US')} of them ${lastName(veteran)}'s.`];
    },
  },
  {
    id: 'journeyman', topic: 'travel', priority: 4, direction: 'high', min: 5,
    measure: (ctx) => Math.max(0, ...ctx.players.map((player) => player.teams ?? 0)),
    fact: (ctx, value) => {
      const traveller = [...ctx.players].sort((a, b) => (b.teams ?? 0) - (a.teams ?? 0))[0];
      return [`${traveller.name} has played for ${value} NHL teams. Whatever you do, don't let him unpack.`];
    },
  },

  // Last season ---------------------------------------------------------------
  {
    id: 'pim-high', extreme: true, boost: 0.01, topic: 'penalties', priority: 3, direction: 'high', min: 300,
    measure: (ctx) => ctx.skaters.reduce((sum, player) => sum + (player.last?.pim ?? 0), 0),
    verdict: (ctx, value) => [
      { title: 'The Sin Bin Society', roast: `${value} penalty minutes last season. Your team doesn't play hockey, it negotiates with officials.` },
      { title: 'Goon Squad', roast: `${value} penalty minutes last season between them. Your roster has its own chair in the box.` },
    ],
    fact: (ctx, value) => {
      const worst = [...ctx.skaters].sort((a, b) => (b.last?.pim ?? 0) - (a.last?.pim ?? 0))[0];
      return [`Your roster spent ${value} minutes in the penalty box last season, ${Math.round(value / 60)} hours. ${worst.name} did ${worst.last?.pim} of them.`];
    },
  },
  {
    id: 'pim-low', extreme: true, boost: -0.03, topic: 'penalties', priority: 5, direction: 'low',
    measure: (ctx) => (ctx.skaters.length >= 8 ? ctx.skaters.reduce((sum, player) => sum + (player.last?.pim ?? 0), 0) : null),
    fact: (_ctx, value) => [`Your whole roster took just ${value} penalty minutes last season. The refs send them holiday cards.`],
  },
  {
    id: 'goal-share', topic: 'scoring', priority: 3, direction: 'high', min: 0.2,
    measure: (ctx) => {
      const goals = ctx.skaters.reduce((sum, player) => sum + (player.last?.goals ?? 0), 0);
      if (goals < 60) return null;
      return Math.max(...ctx.skaters.map((player) => player.last?.goals ?? 0)) / goals;
    },
    fact: (ctx, value) => {
      const scorer = [...ctx.skaters].sort((a, b) => (b.last?.goals ?? 0) - (a.last?.goals ?? 0))[0];
      return [`${scorer.name} scored ${Math.round(value * 100)}% of your roster's goals last season. No pressure, big guy.`];
    },
  },
  {
    id: 'goals-high', extreme: true, topic: 'goals', priority: 4, direction: 'high',
    measure: (ctx) => ctx.skaters.reduce((sum, player) => sum + (player.last?.goals ?? 0), 0),
    verdict: (_ctx, value) => [
      { title: 'Snipe City', roast: `${value} goals last season between your skaters. Defence is optional, apparently. So is your goalie.` },
    ],
    fact: (_ctx, value) => [`Your skaters scored ${value} goals last season. Nobody on this team has ever heard of a backcheck.`],
  },
  {
    id: 'goals-low', extreme: true, boost: -0.02, topic: 'goals', priority: 5, direction: 'low',
    measure: (ctx) => (ctx.skaters.length >= 8 ? ctx.skaters.reduce((sum, player) => sum + (player.last?.goals ?? 0), 0) : null),
    verdict: (_ctx, value) => [
      { title: 'The Defensive Masterclass', roast: `${value} goals last season, combined. You're winning 1-0 or not at all, and mostly not at all.` },
    ],
    fact: (_ctx, value) => [`Your skaters scored ${value} goals last season, combined. It's a bold strategy.`],
  },

  // Positions -----------------------------------------------------------------
  {
    id: 'goalie-hoard', extreme: true, topic: 'goalies', priority: 1, direction: 'high', min: 4,
    measure: (ctx) => ctx.goalies.length,
    verdict: (_ctx, value) => [
      { title: 'The Goalie Hoarder', roast: `${value} goalies. Someone burned you in a goalie run once and you have never, ever forgotten.` },
      { title: 'Crease Collector', roast: `${value} goalies. Only one plays at a time. You know that, right?` },
    ],
    fact: (_ctx, value) => [`${value} goalies on one roster. Your crease has a waiting list.`],
  },
  {
    id: 'no-goalies', topic: 'goalies', priority: 1, direction: 'low', min: 0,
    measure: (ctx) => (ctx.players.length >= 10 ? ctx.goalies.length : null),
    verdict: () => [
      { title: 'The Empty Net', roast: 'Zero goalies. Bold. Either this is a skaters-only league or you are about to learn something.' },
    ],
  },
  {
    id: 'old-goalies', extreme: true, topic: 'goalies', priority: 4, direction: 'high', min: 33,
    measure: (ctx) => {
      const ages = ctx.goalies.map(ctx.age).filter((value): value is number => value !== null);
      return ages.length >= 2 ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
    },
    fact: (ctx) => {
      const ages = ctx.goalies.map((goalie) => Math.floor(ctx.age(goalie) ?? 0)).sort((a, b) => b - a);
      return [`Your goalies are ${ages.slice(0, -1).join(', ')} and ${ages[ages.length - 1]}. Bold, in a position played on the knees.`];
    },
  },
  {
    id: 'defense-heavy', extreme: true, topic: 'positions', priority: 4, direction: 'high', min: 7,
    measure: (ctx) => ctx.players.filter((player) => player.pos.includes('D')).length,
    verdict: (_ctx, value) => [
      { title: 'The Blue Line Bunker', roast: `${value} defencemen. You don't want to win 7-6. You want to win 1-0 and bore everyone into submission.` },
    ],
    fact: (_ctx, value) => [`${value} defencemen. Your forwards are outnumbered in their own dressing room.`],
  },

  // Nationality ---------------------------------------------------------------
  {
    id: 'countries', extreme: true, topic: 'nations', priority: 7, direction: 'high', min: 9,
    measure: (ctx) => new Set(ctx.players.map((player) => player.country).filter(Boolean)).size,
    fact: (_ctx, value) => [`${value} countries on one roster. The national anthem situation before games is chaos.`],
  },
  {
    id: 'nation', topic: 'nations', priority: 2, direction: 'high', min: 4,
    measure: (ctx) => largestGroup(ctx.players.filter((player) => player.country && player.country !== 'CAN' && player.country !== 'USA'), (player) => player.country)?.[1].length ?? 0,
    verdict: (ctx, value) => {
      const [code] = largestGroup(ctx.players.filter((player) => player.country && player.country !== 'CAN' && player.country !== 'USA'), (player) => player.country) as [string, BioPlayer[]];
      const verdicts: Record<string, { title: string; roast: string }> = {
        SWE: { title: 'Swedish House Mafia', roast: `${value} Swedes. Your lineup comes flat-packed with one screw missing.` },
        FIN: { title: 'The Finnish Line', roast: `${value} Finns. Nobody on this team has said more than four words in an interview, and they don't plan to start.` },
        RUS: { title: 'From Russia With Goals', roast: `${value} Russians. Your highlight reel needs its own streaming service.` },
        CZE: { title: 'Czech Mate', roast: `${value} Czechs. You drafted like it's Nagano '98 and you're still riding the high.` },
        SVK: { title: 'Slovak and Roll', roast: `${value} Slovaks. A whole nation's worth of hockey on your bench.` },
        CHE: { title: 'The Swiss Army Knife', roast: `${value} Swiss players. Neutral in everything except fantasy hockey.` },
        DEU: { title: 'German Engineering', roast: `${value} Germans. Precise, efficient, and slightly too punctual for warmups.` },
      };
      return [verdicts[code] ?? { title: 'The Import Line', roast: `${value} players from one country. You have a type, and it has a passport.` }];
    },
    fact: (ctx, value) => {
      const [code, group] = largestGroup(ctx.players.filter((player) => player.country && player.country !== 'CAN' && player.country !== 'USA'), (player) => player.country) as [string, BioPlayer[]];
      return [`${value} of your players were born in ${code === 'USA' ? 'the USA' : ({ SWE: 'Sweden', FIN: 'Finland', RUS: 'Russia', CZE: 'Czechia', SVK: 'Slovakia', CHE: 'Switzerland', DEU: 'Germany' } as Record<string, string>)[code] ?? code}: ${names(group.sort(byName), 3, true)}.`];
    },
  },
  {
    id: 'canadian', topic: 'nations', priority: 3, direction: 'high', min: 10,
    measure: (ctx) => ctx.players.filter((player) => player.country === 'CAN').length,
    verdict: (_ctx, value) => [
      { title: 'Canadian Content Quota', roast: `${value} Canadians. Your team says sorry after every goal and means it.` },
    ],
  },
  {
    id: 'american', topic: 'nations', priority: 3, direction: 'high', min: 7,
    measure: (ctx) => ctx.players.filter((player) => player.country === 'USA').length,
    verdict: (_ctx, value) => [
      { title: 'Miracle on Ice, the Sequel', roast: `${value} Americans. Somewhere a bald eagle is doing a slow-motion fly-by over your roster.` },
    ],
  },

  // Coincidences --------------------------------------------------------------
  {
    id: 'birthday', topic: 'birthday', priority: 6, direction: 'high', min: 1,
    measure: (ctx) => [...groupBy(ctx.players, (player) => player.birthDate?.slice(5) ?? null).values()].filter((group) => group.length >= 2).length,
    fact: (ctx) => {
      const [day, group] = [...groupBy(ctx.players, (player) => player.birthDate?.slice(5) ?? null).entries()].find(([, members]) => members.length >= 2) as [string, BioPlayer[]];
      const label = new Date(`2000-${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
      return [`${names(group, 3, true)} share a birthday: ${label}. One cake, zero excuses.`];
    },
  },
  {
    id: 'hometown', topic: 'hometown', priority: 5, direction: 'high', min: 1,
    measure: (ctx) => [...groupBy(ctx.players, (player) => (player.city ? `${player.city}|${player.country}` : null)).values()].filter((group) => group.length >= 2).length,
    fact: (ctx) => {
      const [place, group] = [...groupBy(ctx.players, (player) => (player.city ? `${player.city}|${player.country}` : null)).entries()].find(([, members]) => members.length >= 2) as [string, BioPlayer[]];
      return [`${names(group, 3, true)} were ${group.length === 2 ? 'both' : 'all'} born in ${place.split('|')[0]}. Carpool to the rink: sorted.`];
    },
  },
  {
    id: 'jersey-twins', topic: 'jersey', priority: 7, direction: 'high', min: 1,
    measure: (ctx) => [...groupBy(ctx.players, (player) => (player.number === null ? null : String(player.number))).values()].filter((group) => group.length >= 2).length,
    fact: (ctx) => {
      const [number, group] = [...groupBy(ctx.players, (player) => (player.number === null ? null : String(player.number))).entries()].find(([, members]) => members.length >= 2) as [string, BioPlayer[]];
      return [`${names(group, 3, true)} ${group.length === 2 ? 'both' : 'all'} wear #${number}. Laundry day is chaos.`];
    },
  },
  {
    id: 'first-names', topic: 'names', priority: 3, direction: 'high', min: 2,
    measure: (ctx) => largestGroup(ctx.players, firstName)?.[1].length ?? 0,
    fact: (ctx, value) => {
      const [name] = largestGroup(ctx.players, firstName) as [string, BioPlayer[]];
      return [`You have ${value} ${name}s. Practice is just yelling "${name}!" and seeing who turns around.`];
    },
  },
  {
    id: 'early-birthdays', extreme: true, topic: 'birth-months', priority: 6, direction: 'high', min: 0.5,
    measure: (ctx) => {
      const dated = ctx.players.filter((player) => player.birthDate);
      return dated.length >= 8 ? dated.filter((player) => Number((player.birthDate as string).slice(5, 7)) <= 3).length / dated.length : null;
    },
    fact: (ctx) => {
      const dated = ctx.players.filter((player) => player.birthDate);
      const early = dated.filter((player) => Number((player.birthDate as string).slice(5, 7)) <= 3).length;
      return [`${early} of your ${dated.length} players were born in January, February or March. Blame minor hockey's age cutoffs.`];
    },
  },

  // Size ----------------------------------------------------------------------
  {
    id: 'heavy', extreme: true, boost: -0.03, topic: 'size', priority: 4, direction: 'high',
    measure: (ctx) => {
      const weights = ctx.players.map((player) => player.weightLb).filter((value): value is number => value !== null);
      return weights.length >= 8 ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
    },
    verdict: (_ctx, value) => [
      { title: 'The Heavyweights', roast: `Average ${Math.round(value)} lb. Your team doesn't drive to the net, it relocates it.` },
    ],
    fact: (ctx) => {
      const total = ctx.players.reduce((sum, player) => sum + (player.weightLb ?? 0), 0);
      const hippos = round1(total / 3300);
      return [`Your roster weighs ${total.toLocaleString('en-US')} lb combined: about ${hippos} ${hippos === 1 ? 'hippo' : 'hippos'}.`];
    },
  },
  {
    id: 'small', extreme: true, boost: -0.02, topic: 'size', priority: 4, direction: 'low',
    measure: (ctx) => {
      const heights = ctx.players.map((player) => player.heightIn).filter((value): value is number => value !== null);
      return heights.length >= 8 ? heights.reduce((a, b) => a + b, 0) / heights.length : null;
    },
    verdict: (_ctx, value) => [
      { title: 'Fun Size', roast: `Average height ${Math.floor(value / 12)}'${Math.round(value % 12)}". Small, fast, and constantly asked if they're the stick boys.` },
    ],
  },
  {
    id: 'size-gap', topic: 'size-gap', priority: 7, direction: 'high', min: 7,
    measure: (ctx) => {
      const heights = ctx.players.map((player) => player.heightIn).filter((value): value is number => value !== null);
      return heights.length >= 2 ? Math.max(...heights) - Math.min(...heights) : null;
    },
    fact: (ctx, value) => {
      const sorted = [...ctx.players].filter((player) => player.heightIn !== null).sort((a, b) => (b.heightIn as number) - (a.heightIn as number));
      return [`${sorted[0].name} is ${value} inches taller than ${sorted[sorted.length - 1].name}. Team photos are a whole thing.`];
    },
  },
  {
    id: 'lefties', extreme: true, topic: 'hands', priority: 6, direction: 'high', min: 0.85,
    measure: (ctx) => {
      const shooters = ctx.skaters.filter((player) => player.shoots);
      return shooters.length >= 8 ? shooters.filter((player) => player.shoots === 'L').length / shooters.length : null;
    },
    fact: (ctx) => {
      const shooters = ctx.skaters.filter((player) => player.shoots);
      const righties = shooters.filter((player) => player.shoots === 'R');
      return [righties.length === 0
        ? 'Not one of your skaters shoots right. Your one-timers all come from the same side.'
        : `${righties[0].name} is your only right-handed shot. He's carrying the entire right side of the ice.`];
    },
  },
];
