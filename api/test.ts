import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    message: 'Test endpoint working',
    method: req.method,
    query: req.query,
    timestamp: new Date().toISOString()
  });
}