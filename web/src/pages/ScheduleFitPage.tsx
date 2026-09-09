import { useEffect, useState } from 'react';
import type { Team } from '../types';
import { apiService } from '../services/api';
import { DraftHelper } from '../components/draft/DraftHelper';
import { EmptyState } from '../components/ui/empty-state';
import { Footer } from '../components/Footer';

export function ScheduleFitPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiService.getTeams()
      .then((data) => { if (!cancelled) setTeams(data); })
      .catch(() => { if (!cancelled) setError('Schedule Fit could not load NHL teams.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-10"><div className="h-72 animate-pulse rounded-xl border border-line bg-surface-1" /></main>;
  if (error) return <main className="mx-auto max-w-2xl px-4 py-10"><EmptyState title="Schedule Fit unavailable" description={error} /></main>;
  return <><main className="container mx-auto px-4 py-5 sm:px-6 sm:py-7 lg:px-8"><DraftHelper teams={teams} /></main><Footer /></>;
}
