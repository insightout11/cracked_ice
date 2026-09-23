import { useEffect, useState } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { loadPlayerNews, PLAYER_NEWS_CATEGORY_LABEL, selectPlayerNews, type PlayerNewsItem, type PlayerNewsSnapshot } from '../../lib/playerNews';

const MAX_RELEVANT = 4;

function formatAge(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StoryRow({ item: { story, takeaway } }: { item: PlayerNewsItem }) {
  return (
    <li className="text-xs leading-relaxed">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-ink-mute">
        <span className={story.category === 'injury' ? 'font-semibold text-negative' : 'font-semibold text-accent'}>
          {PLAYER_NEWS_CATEGORY_LABEL[story.category]}
        </span>
        <span aria-hidden="true">·</span>
        <time dateTime={story.date}>{formatAge(story.date)}</time>
      </div>
      {takeaway && <p className="mt-1 font-medium text-ink">{takeaway}</p>}
      <a
        href={story.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-0.5 inline-flex items-start gap-1 hover:text-accent ${takeaway ? 'text-ink-dim' : 'font-medium text-ink'}`}
      >
        <span>{story.headline}</span>
        <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">(opens NHL.com)</span>
      </a>
    </li>
  );
}

/** Recent NHL.com news for one player, fantasy-relevant stories first. Hidden when there is none. */
export function PlayerNewsBlock({ playerId }: { playerId: string }) {
  const [snapshot, setSnapshot] = useState<PlayerNewsSnapshot | null | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadPlayerNews().then((result) => {
      if (alive) setSnapshot(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => setShowAll(false), [playerId]);

  if (!snapshot) return null;
  const { relevant, other } = selectPlayerNews(snapshot, playerId);
  if (!relevant.length && !other.length) return null;

  const visible = showAll ? [...relevant, ...other] : relevant.slice(0, MAX_RELEVANT);
  const hiddenCount = relevant.length + other.length - visible.length;

  return (
    <section className="rounded-xl border border-line bg-surface-0 p-4" aria-labelledby={`player-news-${playerId}`}>
      <h3 id={`player-news-${playerId}`} className="flex items-center gap-2 text-xs font-semibold text-ink">
        <Newspaper className="size-4 shrink-0 text-accent" aria-hidden="true" />
        Recent news
      </h3>
      {visible.length > 0
        ? <ul className="mt-3 space-y-3">{visible.map((item) => <StoryRow key={item.story.id} item={item} />)}</ul>
        : <p className="mt-2 text-xs text-ink-dim">No fantasy-relevant news in the last two weeks.</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink-mute">
        {hiddenCount > 0
          ? <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setShowAll(true)}>Show {hiddenCount} more {hiddenCount === 1 ? 'story' : 'stories'}</button>
          : <span />}
        <span>Source: NHL.com · takeaways written by AI</span>
      </div>
    </section>
  );
}
