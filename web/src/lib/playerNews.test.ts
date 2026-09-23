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
  fantasyTakeaway: null,
  takeawayStatus: 'pending',
  ...overrides,
});

const snapshot = (stories: PlayerNewsStory[]): PlayerNewsSnapshot => ({ updatedAt: '2026-09-23T00:00:00Z', stories });

describe('selectPlayerNews', () => {
  it('matches prefixed and bare player ids', () => {
    const data = snapshot([story({ id: 'a', category: 'lineup' })]);
    expect(selectPlayerNews(data, '8478402').relevant.map((s) => s.id)).toEqual(['a']);
    expect(selectPlayerNews(data, 'nhl:8478402').relevant.map((s) => s.id)).toEqual(['a']);
    expect(selectPlayerNews(data, 'nhl:1').relevant).toEqual([]);
  });

  it('separates fantasy-relevant stories from features and NONE takeaways', () => {
    const { relevant, other } = selectPlayerNews(snapshot([
      story({ id: 'takeaway', category: 'feature', takeawayStatus: 'ok', fantasyTakeaway: 'Top line.' }),
      story({ id: 'none', category: 'transaction', takeawayStatus: 'none' }),
      story({ id: 'pending-feature', category: 'feature' }),
      story({ id: 'pending-injury', category: 'injury' }),
    ]), '8478402');
    expect(relevant.map((s) => s.id).sort()).toEqual(['pending-injury', 'takeaway']);
    expect(other.map((s) => s.id).sort()).toEqual(['none', 'pending-feature']);
  });

  it('orders by day, injury and lineup first within a day', () => {
    const { relevant } = selectPlayerNews(snapshot([
      story({ id: 'older-injury', category: 'injury', date: '2026-09-18T09:00:00Z' }),
      story({ id: 'game', category: 'performance', date: '2026-09-20T23:00:00Z' }),
      story({ id: 'lines', category: 'lineup', date: '2026-09-20T10:00:00Z' }),
    ]), '8478402');
    expect(relevant.map((s) => s.id)).toEqual(['lines', 'game', 'older-injury']);
  });

  it('returns nothing without a snapshot', () => {
    expect(selectPlayerNews(null, '8478402')).toEqual({ relevant: [], other: [] });
  });
});
