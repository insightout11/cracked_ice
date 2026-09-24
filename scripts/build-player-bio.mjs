/**
 * Small public player bio file for the Roster Card (web/public/player-bio.json).
 *
 * Everything the card needs to match a pasted roster and write its fun facts, with no
 * sign-in or API call: name, team, positions, jersey number, shooting hand, height,
 * weight, birth date, birthplace, and the player's average Yahoo draft pick (used to pick
 * a team's "face" for its name). Base fields come from data/players.json;
 * birthplaces from the NHL's current team rosters (32 requests); players no longer on
 * a roster keep the birthplace from the previous file, and drafted players missing from
 * every roster are looked up individually.
 *
 * Output rows (compact arrays, see FIELDS): [id, name, team, pos, number, shoots,
 * heightIn, weightLb, birthDate, country, city, averagePick].
 *
 * Usage: node scripts/build-player-bio.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS_PATH = path.join(repoRoot, 'data', 'players.json');
const YAHOO_PATH = path.join(repoRoot, 'data', 'yahoo-player-eligibility.json');
const OUTPUT_PATH = path.join(repoRoot, 'web', 'public', 'player-bio.json');
const TEAMS = ['ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH'];
export const FIELDS = ['id', 'name', 'team', 'pos', 'number', 'shoots', 'heightIn', 'weightLb', 'birthDate', 'country', 'city', 'averagePick'];

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

async function fetchBirthplaces() {
  const places = new Map();
  for (const team of TEAMS) {
    const response = await fetch(`https://api-web.nhle.com/v1/roster/${team}/current`);
    if (!response.ok) throw new Error(`${team} roster: ${response.status}`);
    const roster = await response.json();
    for (const player of [...(roster.forwards ?? []), ...(roster.defensemen ?? []), ...(roster.goalies ?? [])]) {
      places.set(String(player.id), { country: player.birthCountry ?? null, city: player.birthCity?.default ?? null });
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return places;
}

export function buildPlayerBio(players, birthplaces, previousRows, yahooPlayers, updatedAt) {
  const previous = new Map((previousRows ?? []).map((row) => [row[0], row]));
  const rows = players.map((player) => {
    const id = String(player.id).replace(/^nhl:/, '');
    const place = birthplaces.get(id);
    const old = previous.get(id);
    const averagePick = yahooPlayers[`nhl:${id}`]?.averagePick;
    return [
      id,
      player.name,
      player.team,
      (player.pos ?? []).join('/'),
      player.sweaterNumber ?? null,
      player.shoots ?? null,
      player.heightInches ?? null,
      player.weightPounds ?? null,
      player.birthDate ?? null,
      place?.country ?? old?.[9] ?? null,
      place?.city ?? old?.[10] ?? null,
      typeof averagePick === 'number' ? averagePick : null,
    ];
  });
  return { updatedAt, fields: FIELDS, count: rows.length, players: rows };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const players = readJson(PLAYERS_PATH, { players: [] }).players;
  const yahoo = readJson(YAHOO_PATH, { players: {} }).players ?? {};
  const previous = readJson(OUTPUT_PATH, { players: [] }).players;
  const birthplaces = await fetchBirthplaces();
  // Drafted players missing from the current rosters (traded, injured, in the AHL): look
  // them up one by one, capped so a bad night can't mean hundreds of requests.
  const known = new Set([...birthplaces.keys(), ...previous.filter((row) => row[9]).map((row) => row[0])]);
  const missing = players
    .map((player) => String(player.id).replace(/^nhl:/, ''))
    .filter((id) => !known.has(id) && typeof yahoo[`nhl:${id}`]?.averagePick === 'number')
    .slice(0, 60);
  for (const id of missing) {
    const response = await fetch(`https://api-web.nhle.com/v1/player/${id}/landing`).catch(() => null);
    if (response?.ok) {
      const landing = await response.json();
      birthplaces.set(id, { country: landing.birthCountry ?? null, city: landing.birthCity?.default ?? null });
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const bio = buildPlayerBio(players, birthplaces, previous, yahoo, new Date().toISOString());
  const withCountry = bio.players.filter((row) => row[9]).length;
  // A broken NHL response must not wipe birthplaces: require most players to have one.
  if (withCountry < bio.count * 0.6) throw new Error(`Only ${withCountry}/${bio.count} players have a birth country; keeping the previous file.`);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(bio)}\n`);
  console.log(`player-bio: ${bio.count} players, ${withCountry} with a birth country`);
}
