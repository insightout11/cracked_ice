/**
 * Usage counts for the ChatGPT plugin: how many times each tool runs per day, split by a coarse
 * client type ("chatgpt" or "other", from the user agent) and by success or error, plus the
 * client's product name (the user agent up to its first "/", e.g. "openai-mcp"), so the
 * ChatGPT split can be checked rather than assumed. Nothing else:
 * no prompts, arguments, player names, rosters, IPs or user ids. One Redis hash per day,
 * kept 400 days. Recording never delays or breaks a tool answer.
 */
import { Redis } from 'ioredis';

const DAY_KEY = (day: string) => `plugin:usage:${day}`;
const KEEP_SECONDS = 400 * 24 * 60 * 60;
const RECORD_TIMEOUT_MS = 400;

let client: Redis | null = null;

function redis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new Redis(url, { connectTimeout: 2000, maxRetriesPerRequest: 1, lazyConnect: false });
    client.on('error', () => { /* counting is best-effort */ });
  }
  return client;
}

export type ClientKind = 'chatgpt' | 'other';

/** ChatGPT's MCP requests identify themselves as OpenAI's; anything else (tests, other clients) is "other". */
export function clientKind(userAgent: string | undefined | null): ClientKind {
  return /openai|chatgpt/i.test(userAgent ?? '') ? 'chatgpt' : 'other';
}

/** "openai-mcp/1.0 (linux)" -> "openai-mcp": the product name only, no version or platform. */
export function clientProduct(userAgent: string | undefined | null): string {
  const product = (userAgent ?? '').trim().split(/[\/\s]/)[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
  return product || 'none';
}

export function usageField(tool: string, kind: ClientKind, ok: boolean): string {
  return `${tool}|${kind}|${ok ? 'ok' : 'error'}`;
}

export async function recordToolCall(tool: string, kind: ClientKind, ok: boolean, product = 'none', now = new Date()): Promise<void> {
  const r = redis();
  if (!r) return;
  const key = DAY_KEY(now.toISOString().slice(0, 10));
  const write = r.multi().hincrby(key, usageField(tool, kind, ok), 1).hincrby(key, `client|${product}`, 1).expire(key, KEEP_SECONDS).exec();
  await Promise.race([write.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, RECORD_TIMEOUT_MS))]);
}

export interface UsageDay { date: string; total: number; byTool: Record<string, { chatgpt: number; other: number; errors: number }>; clients: Record<string, number> }

/** Rolls a day's hash fields up by tool. */
export function summarizeDay(date: string, fields: Record<string, string>): UsageDay {
  const byTool: UsageDay['byTool'] = {};
  const clients: Record<string, number> = {};
  let total = 0;
  for (const [field, raw] of Object.entries(fields)) {
    const [tool, kind, outcome] = field.split('|');
    const count = Number(raw) || 0;
    if (tool === 'client') { clients[kind] = (clients[kind] ?? 0) + count; continue; }
    const row = (byTool[tool] ??= { chatgpt: 0, other: 0, errors: 0 });
    if (outcome === 'error') row.errors += count;
    else if (kind === 'chatgpt') row.chatgpt += count;
    else row.other += count;
    total += count;
  }
  return { date, total, byTool, clients };
}

export async function usageSummary(days = 30, now = new Date()) {
  const r = redis();
  if (!r) throw new Error('REDIS_URL is not configured');
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - index);
    return date.toISOString().slice(0, 10);
  });
  const pipeline = r.pipeline();
  dates.forEach((date) => pipeline.hgetall(DAY_KEY(date)));
  const results = (await pipeline.exec()) ?? [];
  const perDay = dates.map((date, index) => summarizeDay(date, (results[index]?.[1] as Record<string, string>) ?? {}));
  const totals: Record<string, { chatgpt: number; other: number; errors: number }> = {};
  const clients: Record<string, number> = {};
  for (const day of perDay) {
    for (const [product, count] of Object.entries(day.clients)) clients[product] = (clients[product] ?? 0) + count;
    for (const [tool, row] of Object.entries(day.byTool)) {
      const total = (totals[tool] ??= { chatgpt: 0, other: 0, errors: 0 });
      total.chatgpt += row.chatgpt; total.other += row.other; total.errors += row.errors;
    }
  }
  return {
    days,
    chatgptCalls: Object.values(totals).reduce((sum, row) => sum + row.chatgpt, 0),
    otherCalls: Object.values(totals).reduce((sum, row) => sum + row.other, 0),
    errors: Object.values(totals).reduce((sum, row) => sum + row.errors, 0),
    byTool: totals,
    clients,
    perDay: perDay.filter((day) => day.total > 0),
  };
}
