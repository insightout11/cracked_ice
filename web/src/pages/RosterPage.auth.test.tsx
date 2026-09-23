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
vi.mock('../contexts/LeagueWorkspaceContext', () => ({
  useLeagueWorkspace: () => ({ activeLeague: { id: 'league-1', roster: states.roster } }),
}));

function render() {
  return renderToStaticMarkup(<StaticRouter location="/team"><RosterPage /></StaticRouter>);
}

describe('RosterPage account gate', () => {
  afterEach(() => {
    states.auth.loading = false;
    states.auth.user = null;
    states.roster = [];
  });

  it('asks signed-out visitors to sign in instead of showing a raw auth error', () => {
    const html = render();
    expect(html).toContain('Sign in to analyze your roster');
    expect(html).toContain('Email me a sign-in link');
    expect(html).not.toContain('authentication_required');
  });


  it('waits for the session check before deciding', () => {
    states.auth.loading = true;
    const html = render();
    expect(html).toContain('Checking your account');
    expect(html).not.toContain('Sign in to analyze your roster');
  });
});
