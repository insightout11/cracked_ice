import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { applyYahooSettings, parseYahooSettings } from './settingsImport';

// Copied from Yahoo's Scoring & Settings page for the Chesterfield league (Oct 2026).
const pasted = [
  'Yahoo Sports Fantasy Hockey', 'Open chat', 'Scoring & Settings', 'Setting\tValue',
  'League ID#:\t15713', 'League Name:\tChesterfield Hockey League', 'League Logo:\t', 'Max Teams:\t14',
  'Scoring Type:\tHead-to-Head - Points', 'Max Acquisitions for Entire Season:\t48', 'Max Trades for Entire Season\tNo maximum',
  'Waiver Time:\t1 day', 'Waiver Type:\tContinual rolling list', 'Max Acquisitions per Week:\t2',
  'Weekly Deadline:\tDaily - Today',
  'Playoffs:\t8 teams - Week 25, 26 and 27 (ends Saturday, Apr 10) Note: Week 27 runs 6 days from Apr 5 to Apr 10',
  'Roster Positions:\tC, C, LW, LW, RW, RW, D, D, D, D, G, G, BN, BN, BN, BN, IR, IR+',
  'Forwards/Defensemen Stat Category\tValue',
  'Goals (G)\t1.3', 'Assists (A)\t1.3', 'Powerplay Points (PPP)\t1', 'Shorthanded Goals (SHG)\t3', 'Shorthanded Assists (SHA)\t2',
  'Game-Winning Goals (GWG)\t1', 'Shots on Goal (SOG)\t0.1', 'Hits (HIT)\t.1', 'Blocks (BLK)\t.1',
  'Goaltenders Stat Category\tValue',
  'Wins (W)\t2', 'Goals Against (GA)\t-.5', 'Saves (SV)\t0.1', 'Shutouts (SHO)\t2',
].join('\n');

describe('pasted Yahoo league settings', () => {
  it('reads scoring, lineup spots, adds, waivers, locking and playoff dates', () => {
    const settings = parseYahooSettings(pasted, 2027)!;
    expect(settings).toMatchObject({
      leagueId: '15713', leagueName: 'Chesterfield Hockey League', maxTeams: 14, points: true,
      addsPerWeek: 2, addsPerSeason: 48, waiverDays: 1, lockingMode: 'daily',
      slots: { C: 2, LW: 2, RW: 2, D: 4, G: 2, BN: 4, IR: 1, 'IR+': 1 },
      playoffs: { start: '2027-03-22', end: '2027-04-10' },
      skater: { goals: 1.3, assists: 1.3, power_play_points: 1, shorthanded_goals: 3, shorthanded_assists: 2, game_winning_goals: 1, shots_on_goal: 0.1, hits: 0.1, blocks: 0.1 },
      goalie: { wins: 2, goals_against: -0.5, saves: 0.1, shutouts: 2 },
      unsupported: [],
    });
  });

  it('flags categories it cannot score and category leagues', () => {
    const settings = parseYahooSettings('Scoring Type:\tHead-to-Head - Categories\nRoster Positions:\tC, G\nGoaltenders Stat Category\tValue\nSave Percentage (SV%)\t1', 2027)!;
    expect(settings.points).toBe(false);
    expect(settings.unsupported).toEqual(['Save Percentage (SV%)']);
    expect(parseYahooSettings('Draft Results\nRound 1', 2027)).toBeNull();
  });

  it('sets the league up, keeping the team count from pasted rosters', () => {
    const base = createDefaultLeagueWorkspace({ id: 'l', name: 'My League' });
    const withRosters = { ...base, leagueRosters: { teams: Array.from({ length: 10 }, (_, index) => ({ name: `T${index}`, mine: index === 0, playerIds: [] })), updatedAt: '2026-10-05T00:00:00.000Z' } };
    const next = applyYahooSettings(withRosters, parseYahooSettings(pasted, 2027)!, '2026-10-06T00:00:00.000Z');
    expect(next.name).toBe('Chesterfield Hockey League');
    expect(next.providerLeagueId).toBe('15713');
    expect(next.numberOfTeams).toBe(10);
    expect(next.scoring.skater.shorthanded_goals).toBe(3);
    expect(next.acquisitions).toMatchObject({ limit: 2, period: 'week', waiverDelayDays: 1 });
    expect(next.rosterRules).toMatchObject({ lockingMode: 'daily', slots: { D: 4, 'IR+': 1 } });
    expect(next.schedule.playoffs).toEqual({ start: '2027-03-22', end: '2027-04-10' });
    expect(applyYahooSettings(base, parseYahooSettings(pasted, 2027)!, '2026-10-06T00:00:00.000Z').numberOfTeams).toBe(14);
  });
});
