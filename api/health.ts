import { VercelRequest, VercelResponse } from '@vercel/node';
import cors from 'cors';

// CORS helper
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8092',
    'https://cracked-ice-web.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
};

function runMiddleware(req: VercelRequest, res: VercelResponse, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Run CORS
  await runMiddleware(req, res, cors(corsOptions));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.json({ ok: true });
}