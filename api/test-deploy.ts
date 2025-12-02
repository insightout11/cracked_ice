import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({
    message: 'Test endpoint deployed',
    timestamp: new Date().toISOString()
  });
}
