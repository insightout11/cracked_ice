/**
 * Player news snapshot written nightly by scripts/fetch-nhl-news.mjs and served as
 * a static file (/player-news.json). Headlines and summaries are NHL.com's; the
 * fantasy takeaways are one-line Claude Haiku summaries of the linked story, one
 * per tagged player.
 */
export type PlayerNewsCategory = 'injury' | 'lineup' | 'transaction' | 'performance' | 'feature';

export interface PlayerNewsStory {
  id: string;
  headline: string;
  nhlSummary: string | null;
  url: string;
  date: string;
  category: PlayerNewsCategory;
  playerIds: string[];
  /** Per-player fantasy takeaway, keyed by `nhl:<id>`; players without one had nothing fantasy-relevant. */
  takeaways?: Record<string, string>;
  /** Snapshots written before per-player takeaways had a single story-level takeaway. */
  fantasyTakeaway?: string | null;
  /** 'ok' has takeaways, 'none' was judged not fantasy-relevant, 'pending'/'skipped' not summarised yet. */
  takeawayStatus: 'ok' | 'none' | 'pending' | 'skipped';
}

export interface PlayerNewsSnapshot {
  updatedAt: string;
  stories: PlayerNewsStory[];
}

export interface PlayerNewsItem {
  story: PlayerNewsStory;
  /** This player's takeaway, when the story has one for them. */
  takeaway: string | null;
}

const CATEGORY_WEIGHT: Record<PlayerNewsCategory, number> = {
  injury: 0,
  lineup: 1,
  transaction: 2,
  performance: 3,
  feature: 4,
};

export const PLAYER_NEWS_CATEGORY_LABEL: Record<PlayerNewsCategory, string> = {
  injury: 'Injury',
  lineup: 'Lines & role',
  transaction: 'Roster move',
  performance: 'Game',
  feature: 'Feature',
};

let snapshotRequest: Promise<PlayerNewsSnapshot | null> | null = null;

/** One request per page load; a failure resolves to null and is retried on the next load. */
export function loadPlayerNews(): Promise<PlayerNewsSnapshot | null> {
  snapshotRequest ??= fetch('/player-news.json')
    .then((response) => (response.ok ? response.json() as Promise<PlayerNewsSnapshot> : null))
    .catch(() => null)
    .then((snapshot) => {
      if (!snapshot) snapshotRequest = null;
      return snapshot;
    });
  return snapshotRequest;
}

function toItem(story: PlayerNewsStory, playerId: string): { item: PlayerNewsItem; relevant: boolean } {
  if (story.takeaways) {
    const takeaway = story.takeaways[playerId] ?? null;
    if (takeaway) return { item: { story, takeaway }, relevant: true };
    // Summarised: the story had nothing fantasy-relevant for this player.
    if (story.takeawayStatus === 'ok' || story.takeawayStatus === 'none') return { item: { story, takeaway: null }, relevant: false };
  } else if (story.takeawayStatus === 'ok' && story.fantasyTakeaway) {
    return { item: { story, takeaway: story.fantasyTakeaway }, relevant: true };
  }
  if (story.takeawayStatus === 'none') return { item: { story, takeaway: null }, relevant: false };
  // Not summarised yet: fall back to the rule-based category.
  return { item: { story, takeaway: null }, relevant: story.category !== 'feature' };
}

/**
 * A player's stories, split into fantasy-relevant ones (a takeaway for this player,
 * or not yet summarised and not a feature) and the rest. Ordered by day, with
 * injury and lineup news first within a day.
 */
export function selectPlayerNews(snapshot: PlayerNewsSnapshot | null, playerId: string): { relevant: PlayerNewsItem[]; other: PlayerNewsItem[] } {
  if (!snapshot) return { relevant: [], other: [] };
  const id = `nhl:${playerId.replace(/^nhl:/, '')}`;
  const stories = snapshot.stories
    .filter((story) => story.playerIds.includes(id))
    .sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))
      || CATEGORY_WEIGHT[a.category] - CATEGORY_WEIGHT[b.category]
      || b.date.localeCompare(a.date));
  const relevant: PlayerNewsItem[] = [];
  const other: PlayerNewsItem[] = [];
  for (const story of stories) {
    const { item, relevant: isRelevant } = toItem(story, id);
    (isRelevant ? relevant : other).push(item);
  }
  return { relevant, other };
}
