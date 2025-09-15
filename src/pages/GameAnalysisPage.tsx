import { useState, useEffect } from 'react';
import { OffNightResult, BackToBackResult } from '../types';
import { apiService } from '../services/api';
import { Card } from '../components/Card';
import { getTeamLogoUrl } from '../utils/teamLogos';
import { TimeWindow } from '../components/TimeWindow/TimeWindow';
import { useTimeWindow } from '../hooks/useTimeWindow';

type TabMode = 'offnights' | 'backtobacks';

interface DateRange {
  start: string;
  end: string;
}

export function GameAnalysisPage() {
  const [tabMode, setTabMode] = useState<TabMode>('offnights');
  const [offNightsData, setOffNightsData] = useState<OffNightResult[]>([]);
  const [backToBacksData, setBackToBacksData] = useState<BackToBackResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'totalOffNights' | 'remainingOffNights' | 'totalBackToBack' | 'remainingBackToBack'>('remainingOffNights');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Use TimeWindow hook for date management
  const timeWindow = useTimeWindow();

  const getDateRange = (): DateRange => {
    // Use TimeWindow config for dates
    const startDate = new Date(timeWindow.state.config.startUtc);
    const endDate = new Date(timeWindow.state.config.endUtc);
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const range = getDateRange();
      
      // Fetch both datasets in parallel
      const [offNightsResults, backToBacksResults] = await Promise.all([
        apiService.getOffNights(range.start, range.end),
        apiService.getBackTobacks(range.start, range.end)
      ]);
      
      setOffNightsData(offNightsResults);
      setBackToBacksData(backToBacksResults);
    } catch (err) {
      setError('Failed to load data. Please check if the server is running.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeWindow.state.config]);

  const handleSort = (field: 'totalOffNights' | 'remainingOffNights' | 'totalBackToBack' | 'remainingBackToBack') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get current data based on tab mode
  const currentData = tabMode === 'offnights' ? offNightsData : backToBacksData;
  
  const sortedData = [...currentData].sort((a, b) => {
    const aValue = (a as any)[sortField];
    const bValue = (b as any)[sortField];
    
    if (sortDirection === 'desc') {
      return bValue - aValue;
    } else {
      return aValue - bValue;
    }
  });

  const getSortIcon = (field: 'totalOffNights' | 'remainingOffNights' | 'totalBackToBack' | 'remainingBackToBack') => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'desc' ? '↓' : '↑';
  };
  
  // Update sort field when tab changes
  useEffect(() => {
    if (tabMode === 'offnights') {
      if (sortField === 'totalBackToBack' || sortField === 'remainingBackToBack') {
        setSortField(sortField === 'totalBackToBack' ? 'totalOffNights' : 'remainingOffNights');
      }
    } else {
      if (sortField === 'totalOffNights' || sortField === 'remainingOffNights') {
        setSortField(sortField === 'totalOffNights' ? 'totalBackToBack' : 'remainingBackToBack');
      }
    }
  }, [tabMode]);


  if (loading) {
    return (
      <div className="min-h-screen ice-rink-bg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-screen">
          <Card className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ice-cyan)] mb-4"></div>
            <p className="text-[var(--ice-text-100)]">Loading off-night data...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen ice-rink-bg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-screen">
          <Card className="p-6 max-w-md border-[var(--bad)]">
            <p className="text-[var(--bad)]">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ice-rink-bg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Panel */}
        <Card className="mb-6 p-6 pb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Game Analysis</h1>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setTabMode('offnights')}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                tabMode === 'offnights'
                  ? 'border-[var(--ice-cyan)] text-[var(--ice-cyan)]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Off-Night Totals
            </button>
            <button
              onClick={() => setTabMode('backtobacks')}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                tabMode === 'backtobacks'
                  ? 'border-[var(--ice-cyan)] text-[var(--ice-cyan)]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Back-to-Back Games
            </button>
          </div>
          
          <p className="text-gray-700 mb-4">
            {tabMode === 'offnights' 
              ? 'Track total off-night games (≤ 8 games league-wide) per team. Off-nights provide better matchup opportunities.'
              : 'Track back-to-back games (consecutive day games) per team. Back-to-backs can impact player performance and availability.'
            }
          </p>
          
          {/* Time Window Controls */}
          <div className="mb-4">
            <TimeWindow
              value={timeWindow.state}
              onPresetChange={timeWindow.setPreset}
              onCustomRangeChange={timeWindow.setCustomRange}
              onModeChange={timeWindow.setMode}
              onPlayoffPresetChange={timeWindow.setPlayoffPreset}
              onLeagueWeeksChange={timeWindow.setLeagueWeeks}
            />
          </div>
        </Card>

        {/* Data Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Team
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors"
                    onClick={() => handleSort(tabMode === 'offnights' ? 'totalOffNights' : 'totalBackToBack')}
                  >
                    {tabMode === 'offnights' ? 'Total Off-Nights' : 'Total Back-to-Backs'} {getSortIcon(tabMode === 'offnights' ? 'totalOffNights' : 'totalBackToBack')}
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors"
                    onClick={() => handleSort(tabMode === 'offnights' ? 'remainingOffNights' : 'remainingBackToBack')}
                  >
                    {/* Show "Total Games" in playoff mode, "Remaining" in regular season */}
                    {timeWindow.state.mode === 'playoff' 
                      ? 'Total Games' 
                      : (tabMode === 'offnights' ? 'Remaining Off-Nights' : 'Remaining Back-to-Backs')
                    } {getSortIcon(tabMode === 'offnights' ? 'remainingOffNights' : 'remainingBackToBack')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedData.map((team, index) => (
                  <tr
                    key={team.teamCode}
                    className={`
                      ${index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}
                      transition-colors hover:bg-white/10
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={getTeamLogoUrl(team.teamCode)}
                          alt={`${team.teamName} logo`}
                          className="h-8 w-8 rounded-full mr-3"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `/api/placeholder/32/32?text=${team.teamCode}`;
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 hidden sm:block">
                            {team.teamName}
                          </div>
                          <div className="text-sm text-gray-600 sm:text-gray-600 block sm:block">
                            {team.teamCode}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-semibold text-gray-900">
                        {tabMode === 'offnights' ? (team as OffNightResult).totalOffNights : (team as BackToBackResult).totalBackToBack}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-semibold text-gray-900">
                        {/* Show totalGames in playoff mode, remaining in regular season */}
                        {timeWindow.state.mode === 'playoff' 
                          ? (team as OffNightResult | BackToBackResult).totalGames
                          : (tabMode === 'offnights' ? (team as OffNightResult).remainingOffNights : (team as BackToBackResult).remainingBackToBack)
                        }
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Info Panel */}
        <Card className="mt-6 p-4">
          <p className="text-sm text-gray-700">
            {tabMode === 'offnights' ? (
              <>
                <strong className="text-gray-900">Off-nights</strong> are days with ≤ 8 total NHL games. These typically offer better streaming opportunities 
                and less competition for waiver pickups.
              </>
            ) : (
              <>
                <strong className="text-gray-900">Back-to-back games</strong> are games played on consecutive days. These can impact player performance, 
                rest, and lineup decisions due to fatigue and rotation strategies.
              </>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}