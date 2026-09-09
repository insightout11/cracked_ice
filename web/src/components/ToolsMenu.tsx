import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { resolveRootExperience, TOOL_NAV_ITEMS } from '../lib/navigation';

export function ToolsMenu() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toolActive = ['/optimizer', '/draft', '/compare', '/blog'].some((path) => location.pathname.startsWith(path)) || (location.pathname === '/' && resolveRootExperience(location.search) !== 'home');

  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return <div className="relative"><button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`inline-flex min-h-11 items-center gap-1 rounded-md border px-4 text-sm font-semibold transition-colors ${toolActive ? 'border-accent bg-surface-raised text-accent' : 'border-transparent text-ink-mute hover:border-line hover:text-ink'}`}>Tools<ChevronDown size={14} /></button>{open && <div ref={panelRef} role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-line-strong bg-surface-raised p-1 shadow-raised">{TOOL_NAV_ITEMS.map((item) => <Link role="menuitem" key={item.to} to={item.to} className="block min-h-11 rounded-md px-3 py-3 text-sm font-semibold text-ink hover:bg-accent-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{item.label}</Link>)}</div>}</div>;
}
