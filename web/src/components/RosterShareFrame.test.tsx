import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LeagueProfile, RosterPlayer } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { RosterShareFrame } from './RosterShareFrame';

const stats = {
  goals: 0,
  assists: 0,
  shots_on_goal: 0,
  power_play_points: 0,
  blocks: 0,
};

function player(id: string, name: string, team: string, positions: string[], slot: string): RosterPlayer {
  return {
    id,
    full_name: name,
    team,
    positions,
    current_slot: slot,
    games_played: 82,
    stats,
    seasonFppg: 2,
  };
}

const league: LeagueProfile = {
  league_name: 'Chesterfield League',
  scoring_type: 'points',
  preset_name: 'Custom points',
  lineup_slots: { LW: 2, C: 2, RW: 2, D: 4, G: 2, BN: 2 },
};

const windowState: TimeWindowState = {
  mode: 'regular',
  preset: 'season',
  config: {
    startUtc: '2026-09-29T00:00:00.000Z',
    endUtc: '2027-04-10T00:00:00.000Z',
    source: 'preset',
    preset: 'season',
  },
};

describe('RosterShareFrame', () => {
  it('renders players in hockey lineup formation and preserves open slots', () => {
    const html = renderToStaticMarkup(
      <RosterShareFrame
        leagueProfile={league}
        projections={{}}
        timeWindow={windowState}
        fantasyTeam={{ name: 'Blue Line Bandits', logoDataUrl: 'data:image/png;base64,dGVzdA==' }}
        roster={[
          player('nhl:1', 'Cutter Gauthier', 'ANA', ['LW'], 'LW-0'),
          player('nhl:2', 'Sebastian Aho', 'CAR', ['C'], 'C-0'),
          player('nhl:3', 'Nikita Kucherov', 'TBL', ['RW'], 'RW-0'),
          player('nhl:4', 'Matthew Tkachuk', 'FLA', ['LW', 'RW'], 'RW-1'),
          player('nhl:5', 'Jake Sanderson', 'OTT', ['D'], 'D-1'),
          player('nhl:6', 'Lukas Dostal', 'ANA', ['G'], 'G-0'),
          player('nhl:7', 'Alex Ovechkin', 'WSH', ['LW'], 'BN-1'),
        ]}
      />,
    );

    expect(html).toContain('FORWARD LINES');
    expect(html).toContain('Blue Line Bandits');
    expect(html).toContain('data:image/png;base64,dGVzdA==');
    expect(html).toContain('DEFENSE PAIRS');
    expect(html).toContain('GOALIES');
    expect(html).toContain('Cutter Gauthier');
    expect(html).toContain('Nikita Kucherov');
    expect(html).toContain('Jake Sanderson');
    expect(html).toContain('Lukas Dostal');
    expect(html).toContain('Alex Ovechkin');
    expect(html).toContain('BN2');
    expect(html).toContain('Open slot');
    expect(html).toContain('WHAT WOULD YOU CHANGE?');
    expect(html).not.toContain('CAN YOUR ROSTER USE EVERY GAME?');
    expect(html).toContain('font-family="Arial, sans-serif"');
    expect(html).toContain('viewBox="0 0 190 24"');
    expect(html).toContain('viewBox="0 0 650 52"');
    expect(html).toContain('dominant-baseline="middle"');
    expect(html).toContain('text-anchor="middle"');
    expect(html).toContain('ICE rating 2.0');
    expect(html).toContain('>ICE</span>');
    expect(html.indexOf('Cutter Gauthier')).toBeLessThan(html.indexOf('Matthew Tkachuk'));
    expect(html.indexOf('Matthew Tkachuk')).toBeLessThan(html.indexOf('Jake Sanderson'));
    expect(html.indexOf('Jake Sanderson')).toBeLessThan(html.indexOf('Lukas Dostal'));
  });
});
