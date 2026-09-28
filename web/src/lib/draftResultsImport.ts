import type { PlayerSearchResult } from '../types';
import type { LeagueWorkspace } from './leagueWorkspace';
import { matchScreenshotPlayers, type ScreenshotPlayer } from './screenshotImport';

/** One pick from Yahoo's Draft Results page. Keepers are listed as picks too. */
export interface DraftResultRow {
  overallPick: number;
  round: number;
  name: string;
  team: string;
  positions: string[];
  fantasyTeam: string;
}

const ROUND = /^Round\s+(\d{1,2})$/i;
const PICK = /^(\d{1,3})\.\s*(.+)$/;
const TEAM_POSITION = /^\(\s*([A-Za-z]{2,4})\s+-\s+((?:C|LW|RW|D|G|F|W|Util)(?:\s*,\s*(?:C|LW|RW|D|G|F|W|Util))*)\s*\)$/;

/**
 * Reads text copied from Yahoo's Draft Results page (select all, copy): under each
 * "Round N", a pick is "N. Player Name", then "(TEAM - POS)", then the fantasy team.
 * Picks are numbered overall in the order they appear.
 */
export function parseYahooDraftResults(text: string): DraftResultRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const rows: DraftResultRow[] = [];
  let round = 0;
  lines.forEach((line, index) => {
    const roundMatch = line.match(ROUND);
    if (roundMatch) {
      round = Number(roundMatch[1]);
      return;
    }
    const pick = line.match(PICK);
    const teamPosition = (lines[index + 1] ?? '').match(TEAM_POSITION);
    const fantasyTeam = lines[index + 2] ?? '';
    if (!round || !pick || !teamPosition || !fantasyTeam || ROUND.test(fantasyTeam) || PICK.test(fantasyTeam)) return;
    // Keepers carry Yahoo's keeper icon, a private-use character, after the name.
    const name = pick[2].replace(/\p{Co}/gu, '').trim();
    if (!/^[\p{L}\p{M} .'’-]{2,40}$/u.test(name)) return;
    rows.push({
      overallPick: rows.length + 1,
      round,
      name,
      team: teamPosition[1].toUpperCase(),
      positions: teamPosition[2].split(',').map((position) => position.trim().toUpperCase()),
      fantasyTeam: fantasyTeam.slice(0, 60),
    });
  });
  return rows;
}

/** Fantasy teams in the order they first appear, with their pick counts. */
export function draftResultTeams(rows: DraftResultRow[]): { name: string; picks: number }[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.fantasyTeam, (counts.get(row.fantasyTeam) ?? 0) + 1));
  return [...counts].map(([name, picks]) => ({ name, picks }));
}

export interface DraftResultMatch {
  player: PlayerSearchResult;
  row: DraftResultRow;
}

export function matchDraftResults(directory: PlayerSearchResult[], rows: DraftResultRow[]): { matched: DraftResultMatch[]; unmatched: DraftResultRow[] } {
  const reads: ScreenshotPlayer[] = rows.map((row) => ({ name: row.name, team: row.team, positions: row.positions, status: 'unknown', waiverDate: null }));
  const { matched } = matchScreenshotPlayers(directory, reads);
  const byRead = new Map(matched.map((match) => [match.read, match.player]));
  const result: DraftResultMatch[] = [];
  const unmatched: DraftResultRow[] = [];
  rows.forEach((row, index) => {
    const player = byRead.get(reads[index]);
    if (player) result.push({ player, row });
    else unmatched.push(row);
  });
  return { matched: result, unmatched };
}

/**
 * Records the league's draft as who is rostered: every pick becomes a draft pick,
 * the manager's own team's as "mine" and the rest as taken. Replaces earlier picks,
 * and sets the team count from the draft when it differs.
 */
export function applyDraftResults(workspace: LeagueWorkspace, matches: DraftResultMatch[], myTeam: string, teamCount: number, now: string): LeagueWorkspace {
  const picks = matches.map(({ player, row }) => ({
    playerId: player.id,
    fullName: player.name,
    team: player.team,
    positions: player.pos,
    status: row.fantasyTeam === myTeam ? 'mine' as const : 'taken' as const,
    overallPick: row.overallPick,
    source: 'manual' as const,
    madeAt: now,
  }));
  return {
    ...workspace,
    numberOfTeams: teamCount >= 2 && teamCount <= 32 ? teamCount : workspace.numberOfTeams,
    draftSession: { ...workspace.draftSession, status: 'complete', picks },
    updatedAt: now,
  };
}
