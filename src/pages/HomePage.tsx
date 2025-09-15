import { useState, useEffect } from 'react';
import { Team } from '../types';
import { apiService } from '../services/api';
import { UnifiedDraftHelper } from '../components/UnifiedDraftHelper';

export function HomePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamsData = await apiService.getTeams();
        setTeams(teamsData);
      } catch (err) {
        console.error('Error loading teams:', err);
        // Fallback to hardcoded teams if API fails
        const fallbackTeams = [
          { id: 1, name: 'Anaheim Ducks', abbreviation: 'ANA', triCode: 'ANA' },
          { id: 2, name: 'Boston Bruins', abbreviation: 'BOS', triCode: 'BOS' },
          { id: 3, name: 'Buffalo Sabres', abbreviation: 'BUF', triCode: 'BUF' },
          { id: 4, name: 'Calgary Flames', abbreviation: 'CGY', triCode: 'CGY' },
          { id: 5, name: 'Carolina Hurricanes', abbreviation: 'CAR', triCode: 'CAR' }
        ];
        setTeams(fallbackTeams);
        setError('Using offline mode - some features may be limited');
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
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-[var(--ci-white)]">Loading NHL teams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ice-rink-bg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* SEO Hero Section */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--laser-cyan)', textShadow: '0 0 20px var(--laser-cyan)' }}>
            Fantasy Hockey Optimizer & NHL Weekly Schedule Tool
          </h1>
          <p className="text-xl mb-6" style={{ color: 'var(--ice-text-100)' }}>
            Free fantasy hockey tools for off-night strategy, back-to-back games analysis, and lineup optimization.
            Dominate your fantasy hockey league with data-driven decisions.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <span className="bg-[var(--glass-fill)] px-4 py-2 rounded-lg border border-[var(--glass-border)]" style={{ color: 'var(--ice-text-100)' }}>
              🗓️ NHL Weekly Schedule Analysis
            </span>
            <span className="bg-[var(--glass-fill)] px-4 py-2 rounded-lg border border-[var(--glass-border)]" style={{ color: 'var(--ice-text-100)' }}>
              🏒 Off-Night Strategy Tools
            </span>
            <span className="bg-[var(--glass-fill)] px-4 py-2 rounded-lg border border-[var(--glass-border)]" style={{ color: 'var(--ice-text-100)' }}>
              ⚡ Back-to-Back Games Tracker
            </span>
          </div>
        </header>

        <UnifiedDraftHelper teams={teams} />

        {/* SEO Content Section */}
        <section className="mt-12 glass p-8">
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--laser-cyan)' }}>
            Why Choose Cracked Ice Hockey for Fantasy Hockey?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--neon-mint)' }}>
                Advanced NHL Schedule Analysis
              </h3>
              <p style={{ color: 'var(--ice-text-100)' }}>
                Get comprehensive NHL weekly schedule breakdowns with off-night identification and back-to-back game tracking.
                Our tools help you find the best fantasy hockey matchups for every week of the season.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--neon-mint)' }}>
                Fantasy Hockey Complement Analysis
              </h3>
              <p style={{ color: 'var(--ice-text-100)' }}>
                Find the perfect team combinations for your fantasy hockey lineup using our complement analysis tool.
                Maximize your daily starts and minimize scheduling conflicts across all NHL teams.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}