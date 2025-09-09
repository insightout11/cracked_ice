import { useState, useEffect } from 'react';
import { Team, ComplementResult, MockPlayer } from '../types';
import { apiService } from '../services/api';

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
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Complement Finder</h2>
        <p className="text-gray-600 mb-6">
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
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            Teams with least overlap vs {seedTeam?.name || 'Selected Team'}
          </h3>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2">Loading complement data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span title="Games on the same nights as seed. Lower is better.">
                      Conflicts
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span title="Games this team plays when seed is idle. Higher is better.">
                      Extra Games
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span title="Share of those extra games on Mon/Wed/Fri/Sun, when it's easier to fit them in.">
                      Off-Night %
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sample Dates
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.slice(0, 10).map((result) => (
                  <tr
                    key={result.teamCode}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleTeamClick(result)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {result.teamName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.abbreviation}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.conflicts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.nonOverlap}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(result.offNightShare * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Mock Centers for {selectedTeam.teamName}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockPlayers.map((player) => (
              <div key={player.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="font-medium text-gray-900">{player.name}</div>
                <div className="text-sm text-gray-600">{player.position}</div>
                <div className="text-sm text-blue-600 font-medium">
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