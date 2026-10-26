import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogArticlePage } from './BlogArticlePage';

const track = vi.hoisted(() => vi.fn());
vi.mock('../lib/analytics', () => ({ track }));
vi.mock('../generated/blog-posts.json', () => ({ default: [{ id: 'test-guide', title: 'Test guide', excerpt: '', tags: [], related: [], readTimeMinutes: 1, html: '<p><a href="/season?start=2026-10-26"><strong>Weekly grid</strong></a><a href="https://example.com/season">External</a></p>' }] }));

describe('article tool clicks', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    track.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<MemoryRouter initialEntries={['/blog/test-guide']}><Routes><Route path="/blog/:id" element={<BlogArticlePage />} /></Routes></MemoryRouter>));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('tracks nested article links once and leaves navigation intact', () => {
    const link = container.querySelector('article a') as HTMLAnchorElement;
    // Prevent jsdom navigation in the test only, after the React listener runs.
    const stopNavigation = (event: Event) => event.preventDefault();
    document.addEventListener('click', stopNavigation);
    act(() => link.querySelector('strong')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    document.removeEventListener('click', stopNavigation);
    expect(link.getAttribute('href')).toBe('/season?start=2026-10-26');
    expect(track.mock.calls).toEqual([['article_tool_click', { article_id: 'test-guide', destination: 'season', placement: 'body' }]]);
  });

  it('tracks middle clicks but excludes unrelated external destinations', () => {
    const links = container.querySelectorAll('article a');
    act(() => links[0].dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true })));
    act(() => links[1].dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true })));
    expect(track).toHaveBeenCalledTimes(1);
  });
});
