import { Link, useSearchParams } from 'react-router-dom';

const SEASON_SECTIONS = [
  { to: '/season?view=week', view: 'week', label: 'Weekly schedule' },
  { to: '/season?view=season', view: 'season', label: 'Season analysis' },
] as const;

export function SeasonSectionNav() {
  const [searchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'season' ? 'season' : 'week';
  return (
    <nav aria-label="Season tools" className="flex flex-wrap gap-2 rounded-lg border border-line bg-surface-glass p-2">
      {SEASON_SECTIONS.map((section) => (
        <Link
          key={section.to}
          to={section.to}
          aria-current={activeView === section.view ? 'page' : undefined}
          className={[
            'rounded-md border px-3 py-2 text-sm font-semibold transition-colors',
            activeView === section.view
              ? 'border-accent bg-accent text-accent-ink'
              : 'border-transparent text-ink-dim hover:border-line hover:bg-surface-raised hover:text-ink',
          ].join(' ')}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
