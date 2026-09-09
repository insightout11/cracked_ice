import type { NextFunction, Request, Response } from 'express';

interface Counter { count: number; resetsAt: number }
const counters = new Map<string, Counter>();

function consume(key: string, limit: number, windowMs: number, now: number): boolean {
  const current = counters.get(key);
  if (!current || current.resetsAt <= now) {
    counters.set(key, { count: 1, resetsAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
export function resetOcrLimitsForTests(): void {
  counters.clear();
}

export function enforceOcrLimits(req: Request, res: Response, next: NextFunction): void {
  const userId = String(res.locals.authUserId ?? 'unknown');
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const burstLimit = Number(process.env.OCR_RATE_LIMIT_PER_10_MINUTES ?? 5);
  const dailyLimit = Number(process.env.OCR_DAILY_USER_LIMIT ?? 20);
  const allowed = consume(`burst:user:${userId}`, burstLimit, 10 * 60_000, now)
    && consume(`burst:ip:${ip}`, burstLimit, 10 * 60_000, now)
    && consume(`daily:user:${userId}`, dailyLimit, 24 * 60 * 60_000, now);

  if (!allowed) {
    res.status(429).json({ error: 'ocr_rate_limit_exceeded' });
    return;
  }
  next();
}
