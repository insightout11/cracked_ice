import { useEffect, useState } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { loadPlayerNews, PLAYER_NEWS_CATEGORY_LABEL, selectPlayerNews, type PlayerNewsItem, type PlayerNewsSnapshot } from '../../lib/playerNews';
import { loadBeatPosts, selectBeatPosts, type BeatPost, type BeatPostsSnapshot } from '../../lib/beatPosts';

const MAX_RELEVANT = 4;
const MAX_BEAT_POSTS = 3;

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

function BeatPostRow({ post }: { post: BeatPost }) {
  return (
    <li className="text-xs leading-relaxed">
      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-ink-mute">
        <span className="font-semibold text-ink">{post.author.name}</span>
        <span>{post.author.outlet}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={post.date}>{formatAge(post.date)}</time>
      </div>
      {/* Blank lines would use up the clamp; keep line breaks, drop empty lines. */}
      <p className="mt-1 line-clamp-5 whitespace-pre-line text-ink">{post.text.replace(/\n\s*\n+/g, '\n')}</p>
      <a href={post.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-ink-dim hover:text-accent">
        View on Bluesky
        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
      </a>
    </li>
  );
}

function useSnapshot<T>(load: () => Promise<T | null>): T | null | undefined {
  const [snapshot, setSnapshot] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void load().then((result) => {
      if (alive) setSnapshot(result);
    });
    return () => {
      alive = false;
    };
  }, [load]);
  return snapshot;
}

/**
 * Recent news for one player: beat writers' Bluesky posts that name him, then
 * NHL.com stories with fantasy-relevant ones first. Hidden when there is neither.
 */
export function PlayerNewsBlock({ playerId }: { playerId: string }) {
  const news = useSnapshot<PlayerNewsSnapshot>(loadPlayerNews);
  const beat = useSnapshot<BeatPostsSnapshot>(loadBeatPosts);
  const [showAllStories, setShowAllStories] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);

  useEffect(() => {
    setShowAllStories(false);
    setShowAllPosts(false);
  }, [playerId]);

  const { relevant, other } = selectPlayerNews(news ?? null, playerId);
  const posts = selectBeatPosts(beat ?? null, playerId);
  if (!relevant.length && !other.length && !posts.length) return null;

  const visibleStories = showAllStories ? [...relevant, ...other] : relevant.slice(0, MAX_RELEVANT);
  const hiddenStories = relevant.length + other.length - visibleStories.length;
  const visiblePosts = showAllPosts ? posts : posts.slice(0, MAX_BEAT_POSTS);
  const hasStories = relevant.length + other.length > 0;

  return (
    <section className="rounded-xl border border-line bg-surface-0 p-4" aria-labelledby={`player-news-${playerId}`}>
      <h3 id={`player-news-${playerId}`} className="flex items-center gap-2 text-xs font-semibold text-ink">
        <Newspaper className="size-4 shrink-0 text-accent" aria-hidden="true" />
        Recent news
      </h3>

      {posts.length > 0 && (
        <div className="mt-3">
          <p className="scoreboard-text text-[10px] text-accent">FROM THE BEAT</p>
          <ul className="mt-2 space-y-3">{visiblePosts.map((post) => <BeatPostRow key={post.id} post={post} />)}</ul>
          {posts.length > visiblePosts.length && (
            <button type="button" className="mt-2 text-[10px] font-semibold text-accent hover:underline" onClick={() => setShowAllPosts(true)}>
              Show {posts.length - visiblePosts.length} more {posts.length - visiblePosts.length === 1 ? 'post' : 'posts'}
            </button>
          )}
        </div>
      )}

      {hasStories && (
        <div className={posts.length ? 'mt-4 border-t border-line pt-3' : 'mt-3'}>
          {posts.length > 0 && <p className="scoreboard-text text-[10px] text-accent">NHL.COM</p>}
          {visibleStories.length > 0
            ? <ul className="mt-2 space-y-3">{visibleStories.map((item) => <StoryRow key={item.story.id} item={item} />)}</ul>
            : <p className="mt-2 text-xs text-ink-dim">No fantasy-relevant NHL.com stories in the last two weeks.</p>}
          {hiddenStories > 0 && (
            <button type="button" className="mt-2 text-[10px] font-semibold text-accent hover:underline" onClick={() => setShowAllStories(true)}>
              Show {hiddenStories} more {hiddenStories === 1 ? 'story' : 'stories'}
            </button>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] text-ink-mute">
        {[posts.length ? 'Beat posts from Bluesky' : null, hasStories ? 'stories from NHL.com, takeaways written by AI' : null].filter(Boolean).join(' · ')}
      </p>
    </section>
  );
}
