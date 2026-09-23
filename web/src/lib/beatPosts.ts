/**
 * Beat-writer posts from Bluesky, written nightly by scripts/fetch-bluesky-posts.mjs
 * and served as a static file (/beat-posts.json). Posts are shown as written, with
 * the author credited and a link back to the post.
 */
export interface BeatPost {
  id: string;
  url: string;
  author: { handle: string; name: string; outlet: string };
  text: string;
  date: string;
  playerIds: string[];
}

export interface BeatPostsSnapshot {
  updatedAt: string;
  posts: BeatPost[];
}

let snapshotRequest: Promise<BeatPostsSnapshot | null> | null = null;

/** One request per page load; a failure resolves to null and is retried on the next load. */
export function loadBeatPosts(): Promise<BeatPostsSnapshot | null> {
  snapshotRequest ??= fetch('/beat-posts.json')
    .then((response) => (response.ok ? response.json() as Promise<BeatPostsSnapshot> : null))
    .catch(() => null)
    .then((snapshot) => {
      if (!snapshot) snapshotRequest = null;
      return snapshot;
    });
  return snapshotRequest;
}

/**
 * A player's posts, newest first. Posts naming the fewest players come first on the
 * same day, so a note about this player outranks a 20-name line-rush list.
 */
export function selectBeatPosts(snapshot: BeatPostsSnapshot | null, playerId: string): BeatPost[] {
  if (!snapshot) return [];
  const id = `nhl:${playerId.replace(/^nhl:/, '')}`;
  return snapshot.posts
    .filter((post) => post.playerIds.includes(id))
    .sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))
      || a.playerIds.length - b.playerIds.length
      || b.date.localeCompare(a.date));
}
