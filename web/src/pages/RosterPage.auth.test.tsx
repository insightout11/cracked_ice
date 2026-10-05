import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RosterPage } from './RosterPage';

const states = vi.hoisted(() => ({
  auth: {
    configured: true,
    loading: false,
    user: null as null | { id: string; email?: string },
    message: null,
    error: null,
    sendMagicLink: vi.fn(),
    signOut: vi.fn(),
    clearFeedback: vi.fn(),
  },
  roster: [] as Array<{ playerId: string }>,
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => states.auth }));
vi.mock('../contexts/LeagueWorkspaceContext', async () => {
  const { createDefaultLeagueWorkspace } = await import('../lib/leagueWorkspace');
  const base = createDefaultLeagueWorkspace({ id: 'league-1' });
  return { useLeagueWorkspace: () => ({ activeLeague: { ...base, roster: states.roster }, updateLeague: vi.fn() }) };
});

function render() {
  return renderToStaticMarkup(<StaticRouter location="/team"><RosterPage /></StaticRouter>);
}

describe('RosterPage account gate', () => {
  afterEach(() => {
    states.auth.loading = false;
    states.auth.user = null;
    states.roster = [];
  });

  it('starts new signed-out visitors with the two-paste setup, sign-in offered but not required', () => {
    const html = render();
    expect(html).toContain('in about a minute');
    expect(html).toContain("Paste your league&#x27;s Settings page");
    expect(html).toContain('Email me a sign-in link');
    expect(html).not.toContain('authentication_required');
  });


  it('waits for the session check before deciding', () => {
    states.auth.loading = true;
    const html = render();
    expect(html).toContain('Checking your account');
    expect(html).not.toContain('in about a minute');
  });
});
