import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LeagueProfile } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { RosterGapsPanel } from './RosterGapsPanel';

const timeWindow: TimeWindowState = {
  mode: 'regular',
  preset: 'rest-of-season',
  config: {
    startUtc: '2026-09-29T00:00:00.000Z',
    endUtc: '2027-04-10T23:59:59.999Z',
    source: 'preset',
    preset: 'rest-of-season',
  },
};

function profile(locking_mode: 'daily' | 'weekly'): LeagueProfile {
  return {
    league_name: 'Test League',
    scoring_type: 'points',
    lineup_slots: { C: 1, D: 2, G: 1, BN: 2 },
    locking_mode,
  };
}

function render(lockingMode: 'daily' | 'weekly') {
  return renderToStaticMarkup(
    <RosterGapsPanel
      isExpanded
      onToggle={vi.fn()}
      workingLineup={[]}
      timeWindow={timeWindow}
      leagueProfile={profile(lockingMode)}
    />,
  );
}

describe('RosterGapsPanel schedule states', () => {
  it('withholds daily opportunity claims for weekly-locking leagues', () => {
    const html = render('weekly');
    expect(html).toContain('Daily schedule-fit recommendations are unavailable');
    expect(html).not.toContain('Roster Optimized');
  });

  it('shows an explicit loading state before a daily schedule analysis succeeds', () => {
    const html = render('daily');
    expect(html).toContain('Loading NHL schedule and testing lineup capacity');
    expect(html).not.toContain('Roster Optimized');
    expect(html).not.toContain('No additional schedule capacity');
  });
});
