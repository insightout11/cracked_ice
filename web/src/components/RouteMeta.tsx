import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import posts from '../generated/blog-posts.json';
import { initializeAnalytics } from '../lib/analytics';

const ROUTE_META: Record<string, { title: string; description: string }> = {
  '/': { title: 'Fantasy Hockey Schedule Optimizer | Cracked Ice', description: 'Turn league scoring, roster slots, and the 2026–27 NHL schedule into better fantasy hockey draft, pickup, and lineup decisions.' },
  '/optimizer': { title: 'Fantasy Hockey Schedule Optimizer | Cracked Ice', description: 'Turn league scoring, roster slots, and the 2026–27 NHL schedule into better fantasy hockey draft, pickup, and lineup decisions.' },
  '/season': { title: '2026–27 NHL Schedule Analysis | Cracked Ice', description: 'Explore the 2026–27 NHL schedule by week, off-nights, back-to-backs, fantasy playoff games, and schedule strength.' },
  '/game-analysis': { title: '2026–27 NHL Schedule Analysis | Cracked Ice', description: 'Explore the 2026–27 NHL schedule by week, off-nights, back-to-backs, fantasy playoff games, and schedule strength.' },
  '/compare': { title: 'Compare Fantasy Hockey Players | Cracked Ice', description: 'Compare fantasy hockey players using your league scoring, lineup fit, position value, usable starts, and fantasy playoff schedule.' },
  '/team': { title: 'My Fantasy Hockey Team | Cracked Ice', description: 'Manage a private league workspace, roster, draft board, scoring settings, and lineup decisions.' },
  '/blog': { title: 'Fantasy Hockey Schedule Strategy | Cracked Ice', description: 'Original fantasy hockey schedule analysis, draft strategy, and lineup decisions from Cracked Ice.' },
  '/privacy': { title: 'Privacy Policy | Cracked Ice Hockey', description: 'How Cracked Ice handles league settings, rosters, accounts, analytics, imports, and optional fantasy-provider connections.' },
  '/terms': { title: 'Terms of Use | Cracked Ice Hockey', description: 'Terms governing Cracked Ice fantasy hockey projections, schedule analysis, provider integrations, and user responsibilities.' },
  '/contact': { title: 'Contact Cracked Ice Hockey', description: 'Contact Cracked Ice for product support, account and privacy requests, security reports, and fantasy hockey feedback.' },
};

function getRouteMeta(pathname: string): { title: string; description: string } {
  if (pathname.startsWith('/coach/')) return ROUTE_META['/team'];
  return ROUTE_META[pathname] ?? { title: 'Cracked Ice Hockey', description: 'League-aware fantasy hockey tools for scoring, rosters, player comparisons, schedules, drafting, and playoff planning.' };
}

export function RouteMeta() {
  const location = useLocation();

  useEffect(() => {
    const article = location.pathname.startsWith('/blog/')
      ? posts.find((post) => `/blog/${post.id}` === location.pathname)
      : undefined;
    const routeMeta = getRouteMeta(location.pathname);
    const title = article ? article.title : routeMeta.title;
    document.title = title;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = `https://www.crackedicehockey.com${location.pathname === '/' ? '/' : location.pathname}`;
    const description = article?.excerpt || routeMeta.description;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute('content', window.location.href.split('?')[0]);

    // GA4 Enhanced Measurement owns page views, including SPA history changes.
    // Initializing here happens after hydration and avoids duplicate manual events.
    initializeAnalytics();
  }, [location.pathname, location.search]);

  return null;
}
