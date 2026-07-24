import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function getRouteTitle(pathname: string): string {
  if (pathname === '/compare') return 'Compare Players — Cracked Ice Hockey';
  if (pathname === '/' || pathname === '/optimizer') return 'Fantasy Hockey Optimizer — Cracked Ice Hockey';
  if (pathname === '/season') return 'Season Schedule — Cracked Ice Hockey';
  if (pathname === '/game-analysis') return 'Off-Nights & Back-to-Backs — Cracked Ice Hockey';
  if (pathname === '/team') return 'My Team — Cracked Ice Hockey';
  if (pathname.startsWith('/blog/')) return 'Fantasy Hockey Strategy — Cracked Ice Hockey';
  if (pathname === '/blog') return 'Fantasy Hockey Blog — Cracked Ice Hockey';
  if (pathname === '/privacy') return 'Privacy Policy — Cracked Ice Hockey';
  if (pathname === '/terms') return 'Terms of Use — Cracked Ice Hockey';
  if (pathname === '/contact') return 'Contact — Cracked Ice Hockey';
  if (pathname.startsWith('/coach/')) return 'My Team — Cracked Ice Hockey';
  return 'Cracked Ice Hockey';
}

export function RouteMeta() {
  const location = useLocation();

  useEffect(() => {
    const title = getRouteTitle(location.pathname);
    document.title = title;

    if (navigator.doNotTrack !== '1') {
      window.gtag?.('event', 'page_view', {
        page_location: window.location.href,
        page_path: `${location.pathname}${location.search}`,
        page_title: title,
      });
    }
  }, [location.pathname, location.search]);

  return null;
}
