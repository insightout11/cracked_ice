/**
 * Team names for the Roster Card. Hand-written puns for widely drafted players, then
 * templates built around the roster's most recognisable names. The order is fixed for a
 * given roster, so the same roster always gets the same first name; "another name" steps
 * through the rest.
 */
import type { BioPlayer } from './rosterCard';

const fame = (player: BioPlayer) => (player.adp === null ? 0 : 1000 - player.adp);

/** Keyed by lowercase full name without accents. */
const PUNS: Record<string, string[]> = {
  'connor mcdavid': ['McDavid Copperfield', 'Connor & the Cut-Ins'],
  'nathan mackinnon': ['Mac & Cheese Factory', 'MacKinnon the Ice'],
  'nikita kucherov': ['Kucherov Your Enthusiasm'],
  'macklin celebrini': ['Mack the Knife', 'Celebrini Big Deal'],
  'leon draisaitl': ['Leon: The Professional'],
  'cale makar': ['The Makar-ena', 'Makar-oni & Cheese'],
  'david pastrnak': ['Pasta La Vista, Baby', 'Pasta Night'],
  'kirill kaprizov': ['Kirill Me Softly'],
  'jason robertson': ['RoboCop Unit'],
  'andrei vasilevskiy': ['Vasy Does It'],
  'quinn hughes': ['Hughes Line Is It Anyway?'],
  'jack hughes': ['Hughes Line Is It Anyway?'],
  'luke hughes': ['Hughes Line Is It Anyway?'],
  'nick suzuki': ['Suzuki Samurais'],
  'auston matthews': ['Auston Powers'],
  'mitch marner': ['Mitch, Please'],
  'william nylander': ["Willy Wonka's Goal Factory"],
  'artemi panarin': ['The Breadwinners'],
  'sidney crosby': ['Sid & the Kids'],
  'alex ovechkin': ['Ovi-Wan Kenobi'],
  'evgeni malkin': ['Walkin\' Malkin'],
  'connor bedard': ['Bedard Time Stories'],
  'jack eichel': ['The Eichel Tower'],
  'matthew tkachuk': ['Tkachuk Norris'],
  'brady tkachuk': ['Tkachuk Norris'],
  'aleksander barkov': ['All Barkov, No Bite'],
  'mikko rantanen': ['The Mikko Mouse Club'],
  'brayden point': ['Point Break'],
  'victor hedman': ['Hedman Walking'],
  'connor hellebuyck': ['The Hellebuyck Stops Here'],
  'igor shesterkin': ['The Shesterking of Queens'],
  'jake oettinger': ['Otter Space'],
  'jeremy swayman': ['Sway Bae'],
  'tage thompson': ['Tage of Empires'],
  'zach hyman': ['Hyman Resources'],
  'adam fox': ['Fantastic Mr. Fox'],
  'roman josi': ['The Outlaw Josi Wales'],
  'elias pettersson': ['Petey Pan'],
  'cole caufield': ['The Cole Train'],
  'andrei svechnikov': ['Svech Mate'],
  'sebastian aho': ['Aho-y, Captain'],
  'clayton keller': ['Keller Instinct'],
  'dylan larkin': ['Larkin Up the Wrong Tree'],
  'lucas raymond': ['Everybody Loves Raymond'],
  'moritz seider': ['Hard Seider'],
  'rasmus dahlin': ['Dahlin Dollars'],
  'owen power': ['Power Hour'],
  'matt boldy': ['Boldy Going'],
  'adrian kempe': ['Kempe Fire Stories'],
  'anze kopitar': ['Kopitar Hero'],
  'steven stamkos': ['Stammer Time'],
  'filip forsberg': ['Forsberg Gump'],
  'bo horvat': ['Horvat Is Love'],
  'mark scheifele': ['Scheifele Me Timbers'],
  'jesper bratt': ['The Bratt Pack'],
  'alex debrincat': ['On the DeBrincat'],
  'trevor zegras': ['Mardi Zegras'],
  'joel eriksson ek': ['Ek Marks the Spot'],
  'brandon hagel': ['Hagel & Gretel'],
  'jake sanderson': ['The Sanderson Sisters'],
  'linus ullmark': ['Ullmark My Words'],
  'juuse saros': ['The Juuse Box'],
  'jeff skinner': ['Skinner Dippers'],
  'sam bennett': ["Bennett & Jerry's"],
  'sam reinhart': ['Sam I Am'],
  'wyatt johnston': ["Wyatt Earp's Posse"],
  'roope hintz': ['Hintz & Tips'],
  'brock faber': ['Faberge Eggs'],
  'matvei michkov': ['Mission: Michkov-ssible'],
  'travis konecny': ['Konecny Island'],
  'patrick kane': ['Citizen Kane'],
  'chris kreider': ['Knight Kreider'],
  'alexis lafreniere': ['Laf Track'],
  'j.t. miller': ['Miller Time'],
  'noah dobson': ["Dobson's Choice"],
  'mathew barzal': ['Barzal of Laughs'],
  'tomas hertl': ['Hertl Power'],
  'matty beniers': ['Beniers Babies'],
  'logan cooley': ['Cool Runnings'],
  'matthew knies': ['Knies-y Does It'],
  'tim stutzle': ['Stützle Puzzle'],
  'brad marchand': ['The Marchand of Venice'],
  'tom wilson': ['Cast Away (Wilsonnn!)'],
  'drake batherson': ['Drake & Josh'],
  'lane hutson': ['Hutson Heights'],
  'cole hutson': ['Hutson Heights'],
  'kyle connor': ['Connor Store'],
  'evan bouchard': ['Bouchard Bombs'],
  'miro heiskanen': ['Miro, Miro on the Wall'],
  'sergei bobrovsky': ['Bob\'s Burgers'],
  'ilya sorokin': ['Sorokin Good Time'],
  'shea theodore': ['Theodore & the Chipmunks'],
  'mark stone': ['The Stone Age'],
  'seth jarvis': ['Jarvis, Take the Wheel'],
  'nico hischier': ['Nico Suave'],
  'porter martone': ['Porter House Steaks'],
};

/** Name templates; {last} is a surname, {first} a first name. */
const TEMPLATES = [
  '{last} & the Waiver Wire',
  'The {last} Dynasty (Pending)',
  'Game of {last}s',
  "{first}'s Angels",
  '{last}-a-palooza',
  'Sons of {last}',
  '{last} Unchained',
  'Snipe City, Pop. {last}',
  'The {last} Report',
  'Keeping Up With the {last}s',
  '{last} or Bust',
];

const foldName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const splitName = (player: BioPlayer) => {
  const [first, ...rest] = player.name.split(' ');
  return { first, last: rest.join(' ') || first };
};

/** Stable small hash so a roster keeps its template pick. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

export function rosterTeamNames(players: BioPlayer[]): string[] {
  const byFame = [...players].sort((a, b) => fame(b) - fame(a) || a.name.localeCompare(b.name));
  const names: string[] = [];
  byFame.forEach((player) => (PUNS[foldName(player.name)] ?? []).forEach((pun) => { if (!names.includes(pun)) names.push(pun); }));
  const seed = hash(players.map((player) => player.id).sort().join(','));
  byFame.slice(0, 4).forEach((player, playerIndex) => {
    const { first, last } = splitName(player);
    for (let step = 0; step < 3; step += 1) {
      const template = TEMPLATES[(seed + playerIndex * 5 + step * 7) % TEMPLATES.length];
      const name = template.replace('{last}', last).replace('{first}', first);
      if (!names.includes(name)) names.push(name);
    }
  });
  return names.length ? names : ['The Balanced Breakfast Club'];
}

export function rosterTeamName(players: BioPlayer[], index = 0): string {
  const names = rosterTeamNames(players);
  return names[((index % names.length) + names.length) % names.length];
}
