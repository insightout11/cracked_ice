import { describe, expect, it } from 'vitest';
import { selectBeatPosts, type BeatPost } from './beatPosts';

const post = (overrides: Partial<BeatPost>): BeatPost => ({
  id: 'id',
  url: 'https://bsky.app/profile/a/post/1',
  author: { handle: 'a.bsky.social', name: 'A', outlet: 'Outlet' },
  text: 'text',
  date: '2026-09-22T18:00:00Z',
  playerIds: ['nhl:8478402'],
  ...overrides,
});

describe('selectBeatPosts', () => {
  it('returns a player\'s posts, newest day first, focused posts before long lists', () => {
    const posts = selectBeatPosts({ updatedAt: '', posts: [
      post({ id: 'older', date: '2026-09-20T10:00:00Z' }),
      post({ id: 'lines-list', date: '2026-09-22T20:00:00Z', playerIds: ['nhl:8478402', 'nhl:1', 'nhl:2', 'nhl:3'] }),
      post({ id: 'about-him', date: '2026-09-22T12:00:00Z' }),
      post({ id: 'someone-else', playerIds: ['nhl:1'] }),
    ] }, '8478402');
    expect(posts.map((p) => p.id)).toEqual(['about-him', 'lines-list', 'older']);
  });

  it('returns nothing without a snapshot', () => {
    expect(selectBeatPosts(null, 'nhl:8478402')).toEqual([]);
  });
});
