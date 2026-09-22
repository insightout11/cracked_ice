import fs from 'node:fs';
import path from 'node:path';
import { handleCors } from './_lib/respond.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/player-news?playerId=nhl:8480069
 * Serves the FantasyPros news snapshot (data/player-news.json) filtered to one player.
 * Read-only, no auth, harmless CORS. Returns {items: [...]} — empty array when nothing.
 */

interface NewsItem {
  itemid: string;
  playerId?: string | null;
  title: string;
  url: string | null;
  date: string | null;
  dateLabel?: string | null;
  source?: { href: string; label: string } | null;
  impact?: string | null;
  category?: string | null;
  author?: string | null;
}

interface NewsDoc {
  updatedAt?: string;
  items: NewsItem[];
}

let cache: { doc: NewsDoc; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function loadDoc(): NewsDoc {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.doc;
  const candidates = [
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), '..', 'data'),
  ];
  const dataDir = candidates.find((c) => fs.existsSync(path.join(c, 'player-news.json')));
  if (!dataDir) return { items: [] };
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(dataDir, 'player-news.json'), 'utf8')) as NewsDoc;
    cache = { doc, loadedAt: Date.now() };
    return doc;
  } catch {
    return { items: [] };
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res, ['GET'])) return;
  try {
    const playerId = String(req.query.playerId ?? '').trim();
    if (!playerId) {
      res.status(400).json({ error: 'playerId is required (e.g. nhl:8478402)' });
      return;
    }
    const doc = loadDoc();
    const items = doc.items
      .filter((item) => item.playerId === playerId)
      .slice(0, 5)
      .map((item) => ({
        itemid: item.itemid,
        title: item.title,
        url: item.url,
        date: item.date,
        dateLabel: item.dateLabel ?? null,
        source: item.source ?? null,
        impact: item.impact ?? null,
        category: item.category ?? null,
        author: item.author ?? null,
      }));
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({ items, updatedAt: doc.updatedAt ?? null });
  } catch (error) {
    res.status(500).json({ error: 'player-news unavailable' });
  }
}
