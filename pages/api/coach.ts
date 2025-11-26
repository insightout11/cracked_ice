import { CoachRequestSchema } from '../../server/src/features/coach/types';
import { generateCoachRecommendations } from '../../server/src/features/coach';
import { REQUIRED_ENV } from '../../server/src/features/coach/constants';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (payload: unknown) => void;
};

function ensureStagingEnvironment() {
  if (
    process.env.NEXT_PUBLIC_ENV !== REQUIRED_ENV.NEXT_PUBLIC_ENV ||
    process.env.DISABLE_PROD !== REQUIRED_ENV.DISABLE_PROD
  ) {
    throw new Error('Coach endpoint disabled outside staging environment');
  }
}

export default function handler(
  req: ApiRequest,
  res: ApiResponse
) {
  try {
    ensureStagingEnvironment();
  } catch (error) {
    return res.status(403).json({ error: (error as Error).message });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userIdHeader = req.headers['x-user-id'];
  if (!userIdHeader) {
    return res.status(401).json({ error: 'Missing x-user-id header' });
  }

  const resolvedUserId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;

  const parseResult = CoachRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.format() });
  }

  try {
    const payload = generateCoachRecommendations(resolvedUserId, parseResult.data.window);
    return res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('1s') ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}
