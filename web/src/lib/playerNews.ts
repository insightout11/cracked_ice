/**
 * Player news snapshot written nightly by scripts/fetch-nhl-news.mjs and served as
 * a static file (/player-news.json). Headlines and summaries are NHL.com's; the
 * fantasy takeaway is a one-line Claude Haiku summary of the linked story.
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
  fantasyTakeaway: string | null;
  /** 'ok' has a takeaway, 'none' was judged not fantasy-relevant, 'pending'/'skipped' not summarised yet. */
  takeawayStatus: 'ok' | 'none' | 'pending' | 'skipped';
}

export interface PlayerNewsSnapshot {
  updatedAt: string;
  stories: PlayerNewsStory[];
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

function isFantasyRelevant(story: PlayerNewsStory): boolean {
  if (story.takeawayStatus === 'ok') return true;
  if (story.takeawayStatus === 'none') return false;
  return story.category !== 'feature';
}

/**
 * A player's stories, split into fantasy-relevant ones (summarised with a takeaway,
 * or not yet summarised but not a feature) and the rest. Relevant stories are
 * ordered by recency, with injury and lineup news first on the same day.
 */
export function selectPlayerNews(snapshot: PlayerNewsSnapshot | null, playerId: string): { relevant: PlayerNewsStory[]; other: PlayerNewsStory[] } {
  if (!snapshot) return { relevant: [], other: [] };
  const id = `nhl:${playerId.replace(/^nhl:/, '')}`;
  const stories = snapshot.stories
    .filter((story) => story.playerIds.includes(id))
    .sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))
      || CATEGORY_WEIGHT[a.category] - CATEGORY_WEIGHT[b.category]
      || b.date.localeCompare(a.date));
  return {
    relevant: stories.filter(isFantasyRelevant),
    other: stories.filter((story) => !isFantasyRelevant(story)),
  };
}
