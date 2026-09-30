import { describe, expect, it } from 'vitest';
import { canonicalPath, pageMeta } from './pageMeta';

describe('page metadata', () => {
  it('treats trailing slashes and index.html as the same page', () => {
    expect(canonicalPath('/season/')).toBe('/season');
    expect(canonicalPath('/season/index.html')).toBe('/season');
    expect(canonicalPath('/')).toBe('/');
    expect(canonicalPath('/index.html')).toBe('/');
  });

  it("gives /season/ the schedule page's title, not the unknown-page fallback", () => {
    expect(pageMeta('/season/').title).toBe(pageMeta('/season').title);
    expect(pageMeta('/season/').title).toContain('NHL Off-Nights');
    expect(pageMeta('/no-such-page').title).toBe('Cracked Ice Hockey');
  });
});
