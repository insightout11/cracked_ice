import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';

/**
 * Recent news block for player cards.
 *
 * Data comes from data/player-news.json (FantasyPros feed, attributed), exposed via
 * /api/player-news?id=nhl:<id> — a read-only endpoint that filters the snapshot by playerId.
 * Falls back to null rendering (block hidden) when the feed is empty or the player has no items.
 */

interface NewsItem {
  itemid: string;
  title: string;
  url: string | null;
  date: string | null;
  dateLabel: string | null;
  source: { href: string; label: string } | null;
  impact: string | null;
  category: string | null;
  author: string | null;
}

function formatAge(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 31) return `${Math.floor(days / 7)}w ago`;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PlayerNewsBlock({ playerId }: { playerId: string }) {
  const [items, setItems] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    setItems(null);
    fetch(`/api/player-news?playerId=${encodeURIComponent(playerId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { items?: NewsItem[] }) => {
        if (alive) setItems(data.items ?? []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [playerId]);

  if (items && items.length === 0) return null;

  return (
    <details className="rounded-xl border border-line bg-surface-0" open>
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-ink">
        <span className="inline-flex items-center gap-2">
          <Newspaper className="size-4 shrink-0 text-accent" aria-hidden="true" />
          Recent news
          {items && (
            <span className="text-ink-dim font-normal">({items.length})</span>
          )}
        </span>
      </summary>
      <div className="border-t border-line px-4 py-3 space-y-3">
        {(items ?? Array.from({ length: 2 }, () => null)).map((item, i) =>
          item === null ? (
            <div key={i} className="h-4 w-3/4 animate-pulse rounded bg-surface-1" aria-hidden="true" />
          ) : (
            <div key={item.itemid} className="text-xs leading-relaxed">
              <div className="flex items-baseline justify-between gap-2">
                <a
                  href={item.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink hover:text-accent"
                >
                  {item.title}
                </a>
                {item.date && (
                  <span className="shrink-0 text-[10px] text-ink-dim">{formatAge(item.date)}</span>
                )}
              </div>
              {item.impact && <p className="mt-0.5 text-ink-dim">{item.impact}</p>}
              <p className="mt-0.5 text-[10px] text-ink-dim">
                {item.author ? `By ${item.author}` : null}
                {item.source && (
                  <>
                    {' • '}
                    <a
                      href={item.source.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent"
                    >
                      {item.source.label}
                      <ExternalLink className="ml-0.5 inline size-3" aria-hidden="true" />
                    </a>
                  </>
                )}
                <span className="ml-1 opacity-70">via FantasyPros</span>
              </p>
            </div>
          )
        )}
      </div>
    </details>
  );
}
