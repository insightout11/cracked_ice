import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * OpenAI's domain check for the ChatGPT plugin: /.well-known/openai-apps-challenge must return
 * the challenge token from the plugin dashboard as plain text, nothing else. The token lives in
 * the OPENAI_APPS_CHALLENGE environment variable (Vercel project settings), so verifying needs
 * no code change.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  res.setHeader('Cache-Control', 'no-store');
  if (!token) {
    res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Not configured');
    return;
  }
  res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8').send(token);
}
