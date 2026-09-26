import Anthropic from '@anthropic-ai/sdk';
import { handleCors } from './_lib/respond.js';
import { ROAST_SCHEMA, allowRequest, buildUserMessage, cacheKey, cachedRoast, parseRoast, parseRoastRequest, rememberRoast, modelFor, systemPrompt } from './_lib/roster-roast.js';

/**
 * POST /api/roster-card: a team name, verdict title and roast for a Roster Card.
 * Without ANTHROPIC_API_KEY (or on any failure) it answers 503 and the page keeps its
 * own hand-written copy.
 */
export default async function handler(req: any, res: any) {
  if (handleCors(req, res, ['POST'])) return;
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'roast_unavailable' });

  const request = parseRoastRequest(typeof req.body === 'string' ? safeJson(req.body) : req.body);
  if (!request) return res.status(400).json({ error: 'invalid_request' });

  const key = cacheKey(request);
  const hit = cachedRoast(key);
  if (hit) return res.json(hit);

  const client = String(req.headers?.['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
  if (!allowRequest(client)) return res.status(429).json({ error: 'rate_limited' });

  try {
    const message = buildUserMessage(request, new Date().toISOString().slice(0, 10));
    if (!message) return res.status(400).json({ error: 'unknown_players' });
    const anthropic = new Anthropic({ timeout: 12_000, maxRetries: 1 });
    const ask = () => anthropic.messages.create({
      model: modelFor(request.level),
      max_tokens: 400,
      system: systemPrompt(request.level),
      output_config: { format: { type: 'json_schema', schema: ROAST_SCHEMA } },
      messages: [{ role: 'user', content: message }],
    });
    let response = await ask();
    // A savage roast is sometimes declined; one more try usually lands.
    if (response.stop_reason === 'refusal') response = await ask();
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      console.error('[roster-card] roast declined:', request.level, response.stop_reason);
      return res.status(502).json({ error: 'roast_declined' });
    }
    const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
    const roast = parseRoast(text, request.verdict.title);
    if (!roast) return res.status(502).json({ error: 'roast_invalid' });
    rememberRoast(key, roast);
    return res.json(roast);
  } catch (error) {
    console.error('[roster-card] roast failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'roast_unavailable' });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
