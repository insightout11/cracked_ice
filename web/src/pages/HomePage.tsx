import { useEffect, useState } from 'react';
import type { Team } from '../types';
import { apiService } from '../services/api';
import { DraftHelper } from '../components/draft/DraftHelper';
import { DraftBoard } from '../components/draft/DraftBoard';
import { Footer } from '../components/Footer';
import { EmptyState } from '../components/ui/empty-state';
import { ArrowLeftRight, ListOrdered, Network } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamsData = await apiService.getTeams();
        setTeams(teamsData);
      } catch (err) {
        setError('Failed to load teams. Please check if the server is running.');
        console.error('Error loading teams:', err);
      } finally {
        setLoading(false);
      }
    };

    void loadTeams();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-4" />
          <p className="text-ink">Loading NHL teams…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <EmptyState title="Optimizer unavailable" description={error} />
        </div>
      </div>
    );
  }

  const tool = searchParams.get('tool') === 'draft' ? 'draft' : 'fit';

  return (
    <div className="min-h-screen ice-rink-bg">
      <main className="container mx-auto px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <nav className="mx-auto mb-4 flex max-w-6xl flex-wrap gap-2" aria-label="Optimizer tools">
          <button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.set('tool', 'fit'); setSearchParams(next); }} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${tool === 'fit' ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-1 text-ink-dim hover:text-ink'}`}><Network size={15} />Schedule fit</button>
          <button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.set('tool', 'draft'); setSearchParams(next); }} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${tool === 'draft' ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-1 text-ink-dim hover:text-ink'}`}><ListOrdered size={15} />Draft board</button>
          <Link to="/compare?mode=draft" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface-1 px-3 text-sm font-semibold text-ink-dim hover:border-accent hover:text-accent"><ArrowLeftRight size={15} />Compare players</Link>
        </nav>
        {tool === 'draft' ? <DraftBoard /> : <DraftHelper teams={teams} />}
      </main>
      <Footer />
    </div>
  );
}
