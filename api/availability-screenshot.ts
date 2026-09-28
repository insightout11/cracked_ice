import Anthropic from '@anthropic-ai/sdk';
import { handleCors } from './_lib/respond.js';
import { MODEL, SCREENSHOT_SCHEMA, SYSTEM_PROMPT, allowScreenshotRequest, buildContent, parseScreenshotRequest, parseScreenshotResult } from './_lib/availability-screenshot.js';

/**
 * POST /api/availability-screenshot: the players (and free agent / waiver status) in
 * screenshots of a Yahoo Fantasy available-players list. Images are read once and not
 * stored. Without ANTHROPIC_API_KEY it answers 503 and the page says so.
 */
export default async function handler(req: any, res: any) {
  if (handleCors(req, res, ['POST'])) return;
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'reader_unavailable' });

  const request = parseScreenshotRequest(typeof req.body === 'string' ? safeJson(req.body) : req.body);
  if (!request) return res.status(400).json({ error: 'invalid_request' });

  const client = String(req.headers?.['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
  if (!allowScreenshotRequest(client)) return res.status(429).json({ error: 'rate_limited' });

  try {
    const anthropic = new Anthropic({ timeout: 25_000, maxRetries: 1 });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: SCREENSHOT_SCHEMA } },
      messages: [{ role: 'user', content: buildContent(request) }],
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return res.status(502).json({ error: 'reader_declined' });
    const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
    const result = parseScreenshotResult(text);
    if (!result) return res.status(502).json({ error: 'reader_invalid' });
    return res.json(result);
  } catch (error) {
    console.error('[availability-screenshot] read failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'reader_unavailable' });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
