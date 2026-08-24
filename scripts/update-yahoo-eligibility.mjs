/**
 * Refresh Yahoo's current fantasy-hockey position eligibility for canonical NHL players.
 *
 * Yahoo's draft-analysis endpoint is public, but its player ids are not NHL ids. This
 * script joins the two directories by normalized player name and team, then writes a
 * checked-in snapshot so production requests never depend on Yahoo being available.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(scriptDir, '..', 'data');
const gameId = '477';
const pageSize = 200;
const allowedPositions = new Set(['C', 'LW', 'RW', 'D', 'G']);
const teamAliases = { LA: 'LAK', SJ: 'SJS', TB: 'TBL', WAS: 'WSH', MON: 'MTL' };
const playerNameAliases = { 'Yegor Chinakhov': 'Egor Chinakhov' };

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeTeam(value) {
  const team = String(value ?? '').toUpperCase();
  return teamAliases[team] ?? team;
}

function endpoint(start) {
  return `https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/league/${gameId}.l.public;out=settings/players;position=ALL;start=${start};count=${pageSize};sort=average_pick;search=;out=auction_values,ranks;ranks=season;ranks_by_position=season;out=expert_ranks;expert_ranks.rank_type=projected_season_remaining/draft_analysis;cut_types=diamond;slices=last7days?format=json_f`;
}

async function fetchYahooPlayers() {
  const players = [];
  for (let start = 0; ; start += pageSize) {
    const response = await fetch(endpoint(start), { headers: { 'User-Agent': 'cracked-ice-hockey/1.0' } });
    if (!response.ok) throw new Error(`Yahoo request failed (${response.status}) at offset ${start}`);
    const payload = await response.json();
    const page = payload?.fantasy_content?.league?.players ?? [];
    players.push(...page.map((entry) => entry.player).filter(Boolean));
    process.stderr.write(`Fetched ${players.length} Yahoo players\n`);
    if (page.length < pageSize) break;
  }
  return players;
}

const canonicalPayload = JSON.parse(readFileSync(join(dataDir, 'players.json'), 'utf8'));
const canonicalPlayers = canonicalPayload.players ?? [];
const yahooPlayers = await fetchYahooPlayers();
const yahooByName = new Map();

for (const player of yahooPlayers) {
  const asciiName = [player?.name?.ascii_first, player?.name?.ascii_last].filter(Boolean).join(' ');
  const key = normalizeName(asciiName || player?.name?.full);
  if (!key) continue;
  const candidates = yahooByName.get(key) ?? [];
  candidates.push(player);
  yahooByName.set(key, candidates);
}

const matched = {};
const unmatched = [];
for (const player of canonicalPlayers) {
  const yahooName = playerNameAliases[player.name] ?? player.name;
  const candidates = yahooByName.get(normalizeName(yahooName)) ?? [];
  const sameTeam = candidates.find((candidate) =>
    normalizeTeam(candidate.editorial_team_abbr) === normalizeTeam(player.team));
  const yahooPlayer = sameTeam ?? (candidates.length === 1 ? candidates[0] : null);
  if (!yahooPlayer) {
    unmatched.push({ id: player.id, name: player.name, team: player.team });
    continue;
  }

  const positions = (yahooPlayer.eligible_positions ?? [])
    .map((entry) => String(entry?.position ?? '').toUpperCase())
    .filter((position) => allowedPositions.has(position));
  if (!positions.length) {
    unmatched.push({ id: player.id, name: player.name, team: player.team });
    continue;
  }

  matched[player.id] = {
    name: player.name,
    team: normalizeTeam(yahooPlayer.editorial_team_abbr),
    yahooPlayerId: String(yahooPlayer.player_id),
    positions,
    averagePick: Number(yahooPlayer.draft_analysis?.average_pick) || null,
    averageRound: Number(yahooPlayer.draft_analysis?.average_round) || null,
    percentDrafted: Number(yahooPlayer.draft_analysis?.percent_drafted) || null,
  };
}

const orderedPlayers = Object.fromEntries(Object.entries(matched).sort(([a], [b]) =>
  Number(a.replace('nhl:', '')) - Number(b.replace('nhl:', ''))));
const today = new Date().toISOString().slice(0, 10);
const output = {
  description: 'Current Yahoo Fantasy Hockey position eligibility matched to canonical NHL player ids.',
  source: 'Yahoo Fantasy Hockey public draft analysis',
  sourceUrl: endpoint(0),
  gameId,
  season: '2026-27',
  updatedAt: today,
  matchedCount: Object.keys(orderedPlayers).length,
  canonicalPlayerCount: canonicalPlayers.length,
  yahooPlayerCount: yahooPlayers.length,
  unmatched,
  players: orderedPlayers,
};

writeFileSync(join(dataDir, 'yahoo-player-eligibility.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stderr.write(`Matched ${output.matchedCount}/${canonicalPlayers.length} canonical players; ${unmatched.length} unmatched\n`);
