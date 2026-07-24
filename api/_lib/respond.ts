// Shared CORS/preflight handling for the serverless functions.
// Returns true when the request was fully handled (OPTIONS preflight or
// disallowed method) and the handler should return immediately.
export function handleCors(
  req: { method?: string },
  res: {
    setHeader: (k: string, v: string) => void;
    status: (code: number) => { end: () => void; json: (body: unknown) => void };
  },
  allowedMethods: string[] = ['GET']
): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', [...allowedMethods, 'OPTIONS'].join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  if (!req.method || !allowedMethods.includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }

  return false;
}
