import type { NextFunction, Request, Response } from 'express';
import { authenticateProfile } from '../features/providers/supabaseProviderStore';

export type Authenticator = (authorization?: string) => Promise<string>;

export function createCoachAuthMiddleware(authenticate: Authenticator = authenticateProfile) {
  return async function requireCoachAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (/^\/player-schedule(?:\/|$)/.test(req.path)) {
      next();
      return;
    }
    try {
      const profileId = await authenticate(req.header('authorization'));
      const pathUserId = req.path.match(/(?:^|\/)users\/([^/]+)/)?.[1];

      if (pathUserId && decodeURIComponent(pathUserId) !== profileId) {
        res.status(403).json({ error: 'workspace_forbidden' });
        return;
      }

      res.locals.authUserId = profileId;
      next();
    } catch (error) {
      const unavailable = error instanceof Error && error.message.includes('configuration is incomplete');
      res.status(unavailable ? 503 : 401).json({
        error: unavailable ? 'authentication_unavailable' : 'authentication_required',
      });
    }
  };
}

export const requireCoachAuth = createCoachAuthMiddleware();
