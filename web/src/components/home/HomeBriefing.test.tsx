import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RosterReadinessCard, WeekAheadStrip } from './HomeBriefing';
import { Jumbotron } from './Jumbotron';
import { createDefaultLeagueWorkspace } from '../../lib/leagueWorkspace';

const briefing = {
  date: '2026-10-10',
  matchups: [{ away: 'MTL', home: 'TOR', startTime: '2026-10-10T23:00:00Z' }],
  gameCount: 1,
  firstPuckDrop: '2026-10-10T23:00:00Z',
  invalidStartTimes: 0,
  nextGameDate: '2026-10-11',
  nextGameCount: 2,
  nextMatchups: [{ away: 'BOS', home: 'NYR', startTime: '2026-10-11T23:00:00Z' }],
  nextLightDate: '2026-10-10',
  week: Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${10 + index}`, gameCount: index + 1 })),
  openingWeek: Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${17 + index}`, gameCount: index + 1 })),
};

function render(node: ReactNode) {
  return renderToStaticMarkup(<StaticRouter location="/">{node}</StaticRouter>);
}

describe('Home briefing components', () => {
  it('shows tonight on the jumbotron: game count, matchups, puck-drop countdown and your players', () => {
    const tonight = [{ id: 'nhl:8478483', name: 'Mitch Marner', team: 'TOR', onIr: false }];
    const html = render(<Jumbotron briefing={briefing} timezone="America/Toronto" phase="regular-season" leagueId="league-1" tonight={tonight} />);
    expect(html).toContain('Tonight');
    expect(html).toContain('1 </span>NHL game');
    expect(html).toContain('alt="MTL"');
    expect(html).toContain('Puck drop in');
    expect(html).toContain('Off-night: easy starts');
    expect(html).toContain('Your players on the ice tonight');
    expect(html).toContain('Marner');
  });

  it('counts down to opening night in the preseason without claiming a zero-game slate', () => {
    const html = render(<Jumbotron briefing={{ ...briefing, gameCount: 0, matchups: [] }} timezone="Asia/Bangkok" phase="preseason" leagueId="league-1" tonight={[]} />);
    expect(html).toContain('Opening night in 1 day');
    expect(html).toContain('alt="BOS"');
    expect(html).toContain('Open Draft Board');
    expect(html).not.toContain('Puck drop in');
    expect(html).not.toContain('Your players on the ice tonight');
  });

  it('puts setup ahead of unsupported personalization for an empty roster', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'empty-home' });
    const html = render(<RosterReadinessCard workspace={workspace} readiness="none" onConfirm={vi.fn()} />);
    expect(html).toContain('Make the briefing yours');
    expect(html).toContain('Personalize with my roster');
    expect(html).not.toContain('lineup conflict');
  });

  it('uses careful capacity and goalie wording for a ready roster', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'ready-home' });
    const html = render(<RosterReadinessCard workspace={workspace} readiness="ready" capacity={{ scheduledSkaters: 6, skaterCapacity: 5, conflict: 1, goalieTeams: ['TOR'], actionable: true }} onConfirm={vi.fn()} />);
    expect(html).toContain('1 potential lineup conflict');
    expect(html).toContain('Starts are unconfirmed');
    expect(html).toContain('potential capacity');
  });

  it('renders all seven days without a carousel', () => {
    const html = render(<WeekAheadStrip briefing={briefing} timezone="America/Toronto" phase="regular-season" leagueId="league-1" />);
    expect((html.match(/<li /g) ?? []).length).toBe(7);
    expect(html).toContain('Next light night');
  });

  it('keeps calendar labels stable across timezones and does not call zero-game dates light', () => {
    const zeroDayBriefing = { ...briefing, week: [{ date: '2026-10-10', gameCount: 0 }, ...briefing.week.slice(1)] };
    const html = render(<WeekAheadStrip briefing={zeroDayBriefing} timezone="Pacific/Auckland" phase="regular-season" leagueId="league-1" />);
    expect(html).toContain('Sat, Oct 10');
    expect(html).toContain('No games');
    expect(html).not.toContain('0 games · light');
  });

  it('renders roster capacity before NHL totals for a personalized week', () => {
    const rosterWeek = briefing.week.map((day, index) => ({ date: day.date, scheduledRosterPlayers: index + 2, usableSkaters: index + 1, blockedSkaters: index === 0 ? 1 : 0, goalieTeams: index === 0 ? ['TOR'] : [], nhlGameCount: day.gameCount, actionable: false }));
    const html = render(<WeekAheadStrip briefing={briefing} timezone="America/Toronto" phase="regular-season" leagueId="league-1" rosterWeek={rosterWeek} />);
    expect(html).toContain('Your week ahead');
    expect(html).toContain('of yours play');
    expect(html).toContain('1 benched');
    expect(html).toContain('schedule context only');
  });
});
