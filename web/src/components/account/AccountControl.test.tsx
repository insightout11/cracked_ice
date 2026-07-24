// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountControl } from './AccountControl';

const states = vi.hoisted(() => ({
  auth: {
    configured: true,
    loading: false,
    user: null as null | { email?: string },
    message: null,
    error: null,
    sendMagicLink: vi.fn(),
    signOut: vi.fn(),
    clearFeedback: vi.fn(),
  },
  sync: {
    status: 'device-only',
    error: null,
    lastSyncedAt: null,
    migrationPlan: null,
    resolveMigration: vi.fn(),
    retry: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => states.auth }));
vi.mock('../../contexts/WorkspaceCloudSyncContext', () => ({ useWorkspaceCloudSync: () => states.sync }));

describe('AccountControl', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    states.auth.configured = true;
    states.auth.user = null;
    states.sync.status = 'device-only';
  });

  it('offers sign-in only when Supabase is configured', () => {
    act(() => root.render(<AccountControl />));
    expect(document.body.textContent).toContain('Sign in');

    act(() => root.unmount());
    root = createRoot(container);
    states.auth.configured = false;
    act(() => root.render(<AccountControl />));
    expect(document.body.textContent).not.toContain('Sign in');
  });

  it('surfaces a required migration review for a signed-in account', () => {
    states.auth.user = { email: 'manager@example.com' };
    states.sync.status = 'needs-review';
    act(() => root.render(<AccountControl />));

    expect(document.body.textContent).toContain('Review sync');
  });
});
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
