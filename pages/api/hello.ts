import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.json({
    message: 'Hello from Vercel API!',
    timestamp: new Date().toISOString(),
    path: req.url
  })
}