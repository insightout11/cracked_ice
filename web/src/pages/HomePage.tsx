import { useState, useEffect } from 'react';
import { Team } from '../types';
import { apiService } from '../services/api';
import { DraftHelper } from '../components/draft/DraftHelper';
import { CoachAssistant } from '../components/CoachAssistant';
import { Footer } from '../components/Footer';
import { EmptyState } from '../components/ui/empty-state';

export function HomePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'draft' | 'coach'>('draft');

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

    loadTeams();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-4"></div>
          <p className="text-[var(--ink)]">Loading NHL teams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <EmptyState title="Draft Helper unavailable" description={error} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ice-rink-bg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mode Toggle */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-lg border border-line bg-surface-glass p-1">
            <button
              onClick={() => setActiveMode('draft')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                activeMode === 'draft'
                  ? 'bg-[var(--accent)] text-accent-ink'
                  : 'text-[var(--ink-mute)] hover:text-[var(--ink)]'
              }`}
            >
              Draft Helper
            </button>
            <button
              onClick={() => setActiveMode('coach')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                activeMode === 'coach'
                  ? 'bg-[var(--accent)] text-accent-ink'
                  : 'text-[var(--ink-mute)] hover:text-[var(--ink)]'
              }`}
            >
              AI Coach
            </button>
          </div>
        </div>

        {/* Content */}
        {activeMode === 'draft' ? (
          <div className="space-y-8">
            <DraftHelper teams={teams} />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <CoachAssistant />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
