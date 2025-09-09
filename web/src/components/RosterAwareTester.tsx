import { useState } from 'react';
import { Team, AddedStartsResult } from '../types';
import { apiService } from '../services/api';

interface RosterAwareTesterProps {
  teams: Team[];
}

export const RosterAwareTester: React.FC<RosterAwareTesterProps> = ({ teams }) => {
  const [rosteredTeamCodes, setRosteredTeamCodes] = useState<string[]>(['CAR']);
  const [candidateTeamCode, setCandidateTeamCode] = useState<string>('ANA');
  const [window, setWindow] = useState<'7d' | '14d' | 'season'>('14d');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AddedStartsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddTeam = () => {
    if (rosteredTeamCodes.length < 4) {
      const nextTeamCode = teams.find(t => !rosteredTeamCodes.includes(t.abbreviation))?.abbreviation || 'ANA';
      setRosteredTeamCodes([...rosteredTeamCodes, nextTeamCode]);
    }
  };

  const handleRemoveTeam = (index: number) => {
    if (rosteredTeamCodes.length > 1) {
      setRosteredTeamCodes(rosteredTeamCodes.filter((_, i) => i !== index));
    }
  };

  const handleTeamChange = (index: number, teamCode: string) => {
    const newTeamCodes = [...rosteredTeamCodes];
    newTeamCodes[index] = teamCode;
    setRosteredTeamCodes(newTeamCodes);
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const addedStarts = await apiService.getAddedStarts({
        rosterTeamCodes: rosteredTeamCodes,
        candidateTeamCode,
        window,
      });
      setResult(addedStarts);
    } catch (err) {
      setError('Failed to calculate added starts. Please try again.');
      console.error('Error calculating added starts:', err);
    } finally {
      setLoading(false);
    }
  };

  const candidateTeam = teams.find(t => t.abbreviation === candidateTeamCode);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Roster-Aware Tester</h2>
        <p className="text-gray-600 mb-6">
          Select the centers you already roster. We show how many extra starts a candidate truly adds, only counting nights when a slot is free.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Your Rostered Center Teams:</label>
            <div className="space-y-2">
              {rosteredTeamCodes.map((teamCode, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={teamCode}
                    onChange={(e) => handleTeamChange(index, e.target.value)}
                    className="border rounded px-3 py-2 flex-1 max-w-xs"
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.abbreviation}>
                        {team.name} ({team.abbreviation})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemoveTeam(index)}
                    className="px-3 py-2 text-red-600 border border-red-300 rounded hover:bg-red-50"
                    disabled={rosteredTeamCodes.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddTeam}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={rosteredTeamCodes.length >= 4}
              >
                Add Team
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-medium">Candidate Team:</label>
            <select
              value={candidateTeamCode}
              onChange={(e) => setCandidateTeamCode(e.target.value)}
              className="border rounded px-3 py-2 min-w-48"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.abbreviation}>
                  {team.name} ({team.abbreviation})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-medium">Time Window:</label>
            <select
              value={window}
              onChange={(e) => setWindow(e.target.value as '7d' | '14d' | 'season')}
              className="border rounded px-3 py-2"
            >
              <option value="7d">Next 7 days</option>
              <option value="14d">Next 14 days</option>
              <option value="season">Full season</option>
            </select>
          </div>

          <button
            onClick={handleCalculate}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            disabled={loading}
          >
            {loading ? 'Calculating...' : 'Calculate Added Starts'}
          </button>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Added Starts Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">
                {result.addedStarts}
              </div>
              <div className="text-gray-600">
                Additional starts from {candidateTeam?.name}
              </div>
              <div className="text-sm text-gray-500 mt-1" title="How many real starts the candidate adds given your lineup slots.">
                Usable Extra Games (Your Roster) in the {window === '7d' ? 'next 7 days' : window === '14d' ? 'next 14 days' : 'full season'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Sample Added Dates:
              </div>
              <div className="text-sm text-gray-600">
                {result.dates.slice(0, 5).join(', ')}
                {result.dates.length > 5 && ` ... and ${result.dates.length - 5} more`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};