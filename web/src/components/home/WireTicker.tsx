import { useEffect, useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import './home.css';

interface NewsStory { id: string; headline: string; url: string; date: string; playerIds?: string[]; takeaways?: Record<string, string> }
interface BeatPost { id: string; url: string; text: string; date: string; playerIds?: string[]; author: { name?: string; handle: string; outlet?: string } }

interface WireItem { id: string; text: string; source: string; url: string; date: string; mine: boolean }

let wireRequest: Promise<{ news: NewsStory[]; posts: BeatPost[] }> | null = null;
function loadWire() {
  wireRequest ??= Promise.all([
    fetch('/player-news.json').then((response) => (response.ok ? response.json() : { stories: [] })).catch(() => ({ stories: [] })),
    fetch('/beat-posts.json').then((response) => (response.ok ? response.json() : { posts: [] })).catch(() => ({ posts: [] })),
  ]).then(([news, beat]) => ({ news: news.stories ?? [], posts: beat.posts ?? [] }));
  return wireRequest;
}

const normalizeId = (id: string) => id.replace(/^nhl:/, '');

/**
 * The wire: a broadcast-style crawl of the latest player-news takeaways and beat
 * writer posts, the user's own players first. Both files refresh nightly.
 */
export function WireTicker({ rosterIds }: { rosterIds: string[] }) {
  const [data, setData] = useState<{ news: NewsStory[]; posts: BeatPost[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadWire().then((result) => { if (alive) setData(result); });
    return () => { alive = false; };
  }, []);

  const items = useMemo<WireItem[]>(() => {
    if (!data) return [];
    const mine = new Set(rosterIds.map(normalizeId));
    const fromNews = data.news.flatMap((story) => Object.entries(story.takeaways ?? {}).map(([playerId, takeaway]): WireItem => ({
      id: `${story.id}-${playerId}`,
      text: takeaway,
      source: 'NHL.com',
      url: story.url,
      date: story.date,
      mine: mine.has(normalizeId(playerId)),
    })));
    const fromPosts = data.posts.map((post): WireItem => {
      const own = (post.playerIds ?? []).find((id) => mine.has(normalizeId(id)));
      return {
        id: post.id,
        text: post.text.replace(/\s+/g, ' ').trim(),
        source: post.author.name ?? post.author.handle,
        url: post.url,
        date: post.date,
        mine: Boolean(own),
      };
    }).filter((item) => item.text.length >= 30);
    const byDate = (a: WireItem, b: WireItem) => b.date.localeCompare(a.date);
    const own = [...fromNews, ...fromPosts].filter((item) => item.mine).sort(byDate).slice(0, 8);
    const league = [...fromNews.filter((item) => !item.mine).sort(byDate).slice(0, 8), ...fromPosts.filter((item) => !item.mine).sort(byDate).slice(0, 6)].sort(byDate);
    return [...own, ...league].slice(0, 16);
  }, [data, rosterIds]);

  if (!items.length) return null;
  const hasMine = items.some((item) => item.mine);
  // Duplicated once so the crawl loops seamlessly.
  const loop = [...items, ...items];

  return (
    <section className="wire relative flex items-stretch overflow-hidden rounded-xl border border-line bg-surface-1" aria-label="Latest player news">
      <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-line bg-surface-0 px-3 text-sm font-semibold text-negative">
        <Radio size={15} aria-hidden="true" />
        <span>{hasMine ? 'Your wire' : 'The wire'}</span>
      </div>
      <div className="wire-viewport min-w-0 flex-1 overflow-hidden">
        <ul className="wire-track py-2" style={{ ['--wire-duration' as string]: `${Math.max(60, items.length * 9)}s` }}>
          {loop.map((item, index) => (
            <li key={`${item.id}-${index}`} className="flex shrink-0 items-center px-4 text-sm" aria-hidden={index >= items.length ? true : undefined}>
              {item.mine && <span className="mr-2 inline-block size-1.5 rounded-full bg-accent" aria-label="Your player" />}
              <a href={item.url} target="_blank" rel="noreferrer" tabIndex={index >= items.length ? -1 : undefined} className="max-w-[34rem] truncate text-ink hover:text-accent hover:underline">
                {item.text}
              </a>
              <span className="ml-2 shrink-0 text-xs text-ink-mute">{item.source}</span>
              <span className="ml-4 text-ink-mute" aria-hidden="true">/</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
