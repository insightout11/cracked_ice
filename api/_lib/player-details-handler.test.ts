import { describe, expect, it, vi } from 'vitest';
import handler from '../player-details';

function response() {
  const res: any = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('public player details endpoint', () => {
  it('returns career history without a user identity or authorization header', () => {
    const res = response();

    handler({ method: 'GET', query: { playerId: '8480817' } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      player: expect.objectContaining({
        id: 'nhl:8480817',
        name: "K'Andre Miller",
        careerHistory: expect.objectContaining({ '20252026': expect.any(Object) }),
      }),
    });
  });

  it('rejects malformed player ids', () => {
    const res = response();

    handler({ method: 'GET', query: { playerId: '../stats.json' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid_player_id' });
  });
});
