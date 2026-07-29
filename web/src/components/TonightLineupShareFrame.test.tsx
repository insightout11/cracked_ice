import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LeagueProfile, RosterPlayer } from '../lib/coachSchemas';
import { TonightLineupShareFrame, type TonightLineupPlayer } from './TonightLineupShareFrame';

const league: LeagueProfile = {
  league_name: 'Chesterfield League',
  scoring_type: 'points',
  preset_name: 'Custom points',
  lineup_slots: { LW: 2, C: 2, RW: 2, D: 4, G: 2, BN: 2 },
};

function player(id: string, name: string, team: string, positions: string[], slot: string): RosterPlayer {
  return {
    id,
    full_name: name,
    team,
    positions,
    current_slot: slot,
    games_played: 82,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
    seasonFppg: 2,
  };
}

describe('TonightLineupShareFrame', () => {
  it('shows matchup context and separates starters from sits', () => {
    const kucherov = player('nhl:1', 'Nikita Kucherov', 'TBL', ['RW'], 'RW-0');
    const aho = player('nhl:2', 'Sebastian Aho', 'CAR', ['C'], 'BN-0');
    const players: TonightLineupPlayer[] = [
      { player: kucherov, game: { date: '2026-10-01', opponent: 'BOS', isHome: true, startTime: '2026-10-01T23:00:00Z', isOffNight: true } },
      { player: aho, game: { date: '2026-10-01', opponent: 'NYR', isHome: false, startTime: '2026-10-01T23:30:00Z' } },
    ];

    const html = renderToStaticMarkup(
      <TonightLineupShareFrame
        leagueProfile={league}
        lineupDate="2026-10-01"
        players={players}
        projections={{}}
        startedPlayerIds={new Set([kucherov.id])}
        fantasyTeam={{ name: 'Blue Line Bandits', logoDataUrl: 'data:image/png;base64,dGVzdA==' }}
      />,
    );

    expect(html).toContain('TONIGHT&#x27;S LINEUP');
    expect(html).toContain('WHO WOULD YOU START?');
    expect(html).toContain('Blue Line Bandits');
    expect(html).toContain('Nikita Kucherov');
    expect(html).toContain('BOS');
    expect(html).toContain('alt="BOS logo"');
    expect(html).toContain('OFF-NIGHT');
    expect(html).toContain('SIT / BENCH OPTIONS');
    expect(html).toContain('Sebastian Aho');
    expect(html).toContain('NYR');
    expect(html).toContain('WHO GETS THE START?');
    expect(html).not.toContain('truncate');
    expect(html).toContain('viewBox="0 0 250 28"');
    expect(html).toContain('dominant-baseline="middle"');
  });
});
