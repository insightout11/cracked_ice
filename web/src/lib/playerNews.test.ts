import { describe, expect, it } from 'vitest';
import { selectPlayerNews, type PlayerNewsSnapshot, type PlayerNewsStory } from './playerNews';

const story = (overrides: Partial<PlayerNewsStory>): PlayerNewsStory => ({
  id: 'id',
  headline: 'headline',
  nhlSummary: null,
  url: 'https://www.nhl.com/news/x',
  date: '2026-09-20T12:00:00Z',
  category: 'feature',
  playerIds: ['nhl:8478402'],
  takeawayStatus: 'pending',
  ...overrides,
});

const snapshot = (stories: PlayerNewsStory[]): PlayerNewsSnapshot => ({ updatedAt: '2026-09-23T00:00:00Z', stories });

describe('selectPlayerNews', () => {
  it('matches prefixed and bare player ids', () => {
    const data = snapshot([story({ id: 'a', category: 'lineup' })]);
    expect(selectPlayerNews(data, '8478402').relevant.map((item) => item.story.id)).toEqual(['a']);
    expect(selectPlayerNews(data, 'nhl:8478402').relevant.map((item) => item.story.id)).toEqual(['a']);
    expect(selectPlayerNews(data, 'nhl:1').relevant).toEqual([]);
  });

  it('uses the takeaway written for this player and folds stories with none for them', () => {
    const { relevant, other } = selectPlayerNews(snapshot([
      story({ id: 'mine', category: 'feature', takeawayStatus: 'ok', playerIds: ['nhl:8478402', 'nhl:8477934'], takeaways: { 'nhl:8478402': 'McDavid opens on the top line.' } }),
      story({ id: 'teammate-only', category: 'lineup', takeawayStatus: 'ok', playerIds: ['nhl:8478402', 'nhl:8477934'], takeaways: { 'nhl:8477934': 'Draisaitl on PP1.' } }),
      story({ id: 'none', category: 'transaction', takeawayStatus: 'none', takeaways: {} }),
      story({ id: 'pending-feature', category: 'feature' }),
      story({ id: 'pending-injury', category: 'injury' }),
    ]), '8478402');
    expect(relevant.map((item) => [item.story.id, item.takeaway])).toEqual([['pending-injury', null], ['mine', 'McDavid opens on the top line.']]);
    expect(other.map((item) => item.story.id)).toEqual(['teammate-only', 'none', 'pending-feature']);
  });

  it('still shows story-level takeaways from older snapshots', () => {
    const { relevant } = selectPlayerNews(snapshot([
      story({ id: 'legacy', takeawayStatus: 'ok', fantasyTakeaway: 'Top line.' }),
    ]), '8478402');
    expect(relevant.map((item) => item.takeaway)).toEqual(['Top line.']);
  });

  it('orders by day, injury and lineup first within a day', () => {
    const { relevant } = selectPlayerNews(snapshot([
      story({ id: 'older-injury', category: 'injury', date: '2026-09-18T09:00:00Z' }),
      story({ id: 'game', category: 'performance', date: '2026-09-20T23:00:00Z' }),
      story({ id: 'lines', category: 'lineup', date: '2026-09-20T10:00:00Z' }),
    ]), '8478402');
    expect(relevant.map((item) => item.story.id)).toEqual(['lines', 'game', 'older-injury']);
  });

  it('returns nothing without a snapshot', () => {
    expect(selectPlayerNews(null, '8478402')).toEqual({ relevant: [], other: [] });
  });
});
