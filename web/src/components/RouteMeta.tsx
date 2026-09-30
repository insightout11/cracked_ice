import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
// Titles and excerpts only: the article bodies stay in the blog article chunk.
import posts from '../generated/blog-meta.json';
import { initializeAnalytics } from '../lib/analytics';
import { resolveRootExperience } from '../lib/navigation';
import { canonicalPath, PAGE_META, pageMeta } from '../lib/pageMeta';

const ORIGIN = 'https://www.crackedicehockey.com';

export function RouteMeta() {
  const location = useLocation();

  useEffect(() => {
    // "/season/" and "/season/index.html" are "/season": same title, canonical and robots
    // before and after the app loads (the server redirects them too).
    const pathname = canonicalPath(location.pathname);
    const article = pathname.startsWith('/blog/')
      ? posts.find((post) => `/blog/${post.id}` === pathname)
      : undefined;
    const rootExperience = pathname === '/' ? resolveRootExperience(location.search) : 'home';
    const routeMeta = rootExperience === 'draft'
      ? PAGE_META['/draft']
      : rootExperience === 'fit' ? PAGE_META['/optimizer'] : pageMeta(pathname);
    const title = article ? (article.seoTitle || article.title) : routeMeta.title;
    document.title = title;

    const canonicalUrl = `${ORIGIN}${pathname}`;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = canonicalUrl;
    const description = article?.excerpt || routeMeta.description;
    // An undated article is a preview before distribution (see prepare-content): noindex until dated.
    const isKnownRoute = Boolean((article && article.publishDate) || (!article && PAGE_META[pathname]) || pathname.startsWith('/coach/'));
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = isKnownRoute ? 'index,follow' : 'noindex,follow';
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute('content', canonicalUrl);

    // GA4 Enhanced Measurement owns page views, including SPA history changes.
    // Initializing here happens after hydration and avoids duplicate manual events.
    initializeAnalytics();
  }, [location.pathname, location.search]);

  return null;
}
