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
        <UnifiedDraftHelper teams={teams} />
      </div>
    </div>
  );
}