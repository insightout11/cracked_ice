// One definition of each page's search title, description, heading and guide, shared with the
// prerender (scripts/prerender-blog.mjs reads the same JSON) so the page Google first fetches
// and the page after the app loads say the same thing.
import pages from '../seo/pages.json';

export interface PageMeta {
  title: string;
  description: string;
  heading?: string;
  eyebrow?: string;
  guide?: { heading: string; paragraphs: string[] };
  /** Long-form pages (methodology): sections of plain paragraphs. */
  sections?: Array<{ heading: string; paragraphs: string[] }>;
  /** Who writes the guides (methodology page, #author): the byline articles link to. */
  author?: { name: string; heading: string; profile: string; profileLabel: string; paragraphs: string[] };
}

export const PAGE_META: Record<string, PageMeta> = pages;

const FALLBACK: PageMeta = {
  title: 'Cracked Ice Hockey',
  description: 'League-aware fantasy hockey tools for scoring, rosters, player comparisons, schedules, drafting, and playoff planning.',
};

/** "/season/", "/season/index.html" and "/Season" all mean "/season". */
export function canonicalPath(pathname: string): string {
  const trimmed = pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed.toLowerCase();
}

export function pageMeta(pathname: string): PageMeta {
  const path = canonicalPath(pathname);
  if (path.startsWith('/coach/')) return PAGE_META['/team'];
  return PAGE_META[path] ?? FALLBACK;
}
