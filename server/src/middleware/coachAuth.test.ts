import { describe, expect, it, vi } from 'vitest';
import { createCoachAuthMiddleware } from './coachAuth';

function response() {
  const res: any = { locals: {}, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('coach authentication', () => {
  it('fails closed without a valid bearer identity', async () => {
    const res = response();
    const next = vi.fn();
    await createCoachAuthMiddleware(async () => { throw new Error('AUTH_REQUIRED'); })(
      { path: '/users/user-a/roster', header: () => undefined } as any, res, next,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects cross-workspace URL substitution', async () => {
    const res = response();
    await createCoachAuthMiddleware(async () => 'user-a')(
      { path: '/users/user-b/roster', header: () => 'Bearer token' } as any, res, vi.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('derives the workspace identity from the verified token', async () => {
    const res = response();
    const next = vi.fn();
    await createCoachAuthMiddleware(async () => 'user-a')(
      { path: '/users/user-a/roster', header: () => 'Bearer token' } as any, res, next,
    );
    expect(res.locals.authUserId).toBe('user-a');
    expect(next).toHaveBeenCalledOnce();
  });
});
