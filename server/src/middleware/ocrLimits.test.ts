import { afterEach, describe, expect, it, vi } from 'vitest';
import { enforceOcrLimits, resetOcrLimitsForTests } from './ocrLimits';

afterEach(() => {
  delete process.env.OCR_RATE_LIMIT_PER_10_MINUTES;
  resetOcrLimitsForTests();
});
describe('OCR limits', () => {
  it('rate-limits repeated paid OCR calls per authenticated user', () => {
    process.env.OCR_RATE_LIMIT_PER_10_MINUTES = '1';
    const request = { ip: '127.0.0.1', socket: {}, } as any;
    const response: any = { locals: { authUserId: 'user-a' }, status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    const next = vi.fn();

    enforceOcrLimits(request, response, next);
    enforceOcrLimits(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(429);
  });
});
