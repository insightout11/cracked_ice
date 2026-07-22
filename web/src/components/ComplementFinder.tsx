import { useState, useEffect } from 'react';
import { Team, ComplementResult, MockPlayer } from '../types';
import { apiService } from '../services/api';
import { TooltipLabel } from './ui/tooltip';

interface ComplementFinderProps {
  teams: Team[];
}

export const ComplementFinder: React.FC<ComplementFinderProps> = ({ teams }) => {
  const [seedTeamId, setSeedTeamId] = useState<number>(teams.length > 0 ? teams[0].id : 12);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComplementResult[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<ComplementResult | null>(null);
  const [mockPlayers, setMockPlayers] = useState<MockPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      // Find the team and use its abbreviation instead of ID
      const team = teams.find(t => t.id === seedTeamId);
      const teamIdentifier = team ? team.abbreviation : String(seedTeamId);
      const complements = await apiService.getComplements(teamIdentifier);
      setResults(complements);
    } catch (err) {
      setError('Failed to fetch complement data. Please try again.');
      console.error('Error fetching complements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamClick = (team: ComplementResult) => {
    setSelectedTeam(team);
    const players = apiService.getMockPlayers(team.abbreviation);
    setMockPlayers(players);
  };

  useEffect(() => {
    handleSearch();
  }, [seedTeamId]);

  const seedTeam = teams.find(t => t.id === seedTeamId);

  return (
    <div className="space-y-6">
      <div className="bg-surface-1 p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Complement Finder</h2>
        <p className="text-ink-mute mb-6">
          Pick your star's team. We rank others by fewest conflicts, then by extra games, then off-night %.
        </p>
        
        <div className="flex items-center gap-4 mb-4">
          <label className="font-medium">Seed Team:</label>
          <select
            value={seedTeamId}
            onChange={(e) => setSeedTeamId(Number(e.target.value))}
            className="border rounded px-3 py-2 min-w-48"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.abbreviation})
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-negative-muted border border-negative text-negative px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      <div className="bg-surface-1 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            Teams with least overlap vs {seedTeam?.name || 'Selected Team'}
          </h3>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            <p className="mt-2">Loading complement data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-surface-2">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-mute uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-mute uppercase tracking-wider">
                    <TooltipLabel label="Games on the same nights as seed. Lower is better.">
                      <span>Conflicts</span>
                    </TooltipLabel>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-mute uppercase tracking-wider">
                    <TooltipLabel label="Games this team plays when seed is idle. Higher is better.">
                      <span>Extra Games</span>
                    </TooltipLabel>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-mute uppercase tracking-wider">
                    Sample Dates
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface-1 divide-y divide-line">
                {results.slice(0, 10).map((result) => (
                  <tr
                    key={result.teamCode}
                    className="hover:bg-surface-2 cursor-pointer"
                    onClick={() => handleTeamClick(result)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`/logos/${result.abbreviation.toLowerCase()}.png`}
                          alt={`${result.abbreviation} logo`}
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <div className="font-medium text-ink text-sm font-bold uppercase tracking-wide">
                          {result.abbreviation}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink">
                      {result.conflicts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink">
                      {result.nonOverlap}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-mute">
                      {result.datesComplement.slice(0, 3).join(', ')}
                      {result.datesComplement.length > 3 && '...'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTeam && (
        <div className="bg-surface-1 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Mock Centers for {selectedTeam.teamName}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockPlayers.map((player) => (
              <div key={player.id} className="border rounded-lg p-4 hover:bg-surface-2">
                <div className="font-medium text-ink">{player.name}</div>
                <div className="text-sm text-ink-mute">{player.position}</div>
                <div className="text-sm text-accent font-medium">
                  ~{player.projectedPoints} pts (projected)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
