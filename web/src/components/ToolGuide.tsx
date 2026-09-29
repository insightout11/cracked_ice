import { Link } from 'react-router-dom';
import { pageMeta } from '../lib/pageMeta';

/**
 * The short "how this works" guide for a tool page (web/src/seo/pages.json). The prerendered
 * page carries the same text, so it stays on the page once the app has loaded instead of
 * disappearing with the placeholder.
 */
export function ToolGuide({ path, className = '' }: { path: '/season' | '/optimizer' | '/draft' | '/compare'; className?: string }) {
  const guide = pageMeta(path).guide;
  if (!guide) return null;
  return (
    <section aria-labelledby={`guide-${path.slice(1)}`} className={`rounded-xl border border-line bg-surface-glass p-5 sm:p-6 ${className}`}>
      <h2 id={`guide-${path.slice(1)}`} className="font-display text-lg font-bold text-ink">{guide.heading}</h2>
      <div className="mt-3 grid gap-3 text-sm leading-relaxed text-ink-dim md:grid-cols-2">
        {guide.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <p className="mt-4 text-xs text-ink-mute">
        Where the numbers come from: <Link to="/methodology" className="text-accent hover:underline">data and methodology</Link>.
      </p>
    </section>
  );
}
