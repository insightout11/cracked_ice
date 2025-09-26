import { useState, useEffect } from 'react';
import { Team, ComplementResult } from '../types';
import { apiService } from '../services/api';
import { getTeamLogoUrl } from '../utils/teamLogos';
import { Card } from './Card';
import { IceDropdown, DropdownOption } from './IceDropdown';
import { TimeWindow } from './TimeWindow';
import { PlayoffModeToggle } from './TimeWindow/PlayoffModeToggle';
import { useTimeWindow } from '../contexts/TimeWindowContext';
import { TeamColorDisplay } from './TeamTier/TeamColorDisplay';
import { TierLegend } from './TeamTier/TierLegend';
import { ScheduleColorToggle } from './Settings/ScheduleColorToggle';
import { useTeamTiers } from '../contexts/TeamTierContext';
import { getPlayoffStartWeekFromTimeWindow } from '../lib/timeWindow';

interface UnifiedDraftHelperProps {
  teams: Team[];
}

// WindowType removed - now using TimeWindow system

export const UnifiedDraftHelper: React.FC<UnifiedDraftHelperProps> = ({ teams }) => {
  // Load from localStorage with fallbacks
  const [seedTeamId, setSeedTeamId] = useState<number>(() => {
    const saved = localStorage.getItem('off-night-seed-team');
    return saved ? parseInt(saved, 10) : 24; // Default to Anaheim Ducks (first alphabetical team)
  });
  
  const [lockedTeams, setLockedTeams] = useState<string[]>(() => {
    const saved = localStorage.getItem('off-night-locked-teams');
    return saved ? JSON.parse(saved) : [];
  });
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [lockButtonPulse, setLockButtonPulse] = useState(false);
  
  const [showAllTeams, setShowAllTeams] = useState<boolean>(() => {
    const saved = localStorage.getItem('off-night-show-all-teams');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [dailySlots, setDailySlots] = useState<2 | 4 | 'custom'>(() => {
    const saved = localStorage.getItem('off-night-daily-slots');
    if (saved) {
      const parsed = parseInt(saved, 10);
      return parsed === 2 || parsed === 4 ? parsed : 'custom';
    }
    return 2;
  });

  const [customSlots, setCustomSlots] = useState<number>(() => {
    const saved = localStorage.getItem('off-night-custom-slots');
    return saved ? parseInt(saved, 10) : 3;
  });
  
  // Use new TimeWindow hook
  const timeWindow = useTimeWindow();

  // Use team tiers hook
  const teamTiers = useTeamTiers();
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComplementResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'complement' | 'roster-aware'>('complement');

  const seedTeam = teams.find(t => t.id === seedTeamId);
  
  // Clamp function to ensure score is between 0 and 1
  const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

  const calculateDraftFitScore = (usableStartsZ: number, offNightShare: number, conflictRatio: number): number => {
    // New dynamic scoring formula with better range
    // usableStartsZ: Z-score of usable starts (primary factor)
    // offNightShare: 0-1 scaled off-night percentage (lightly weighted)
    // conflictRatio: conflict ratio as penalty (negative weight)

    const score = clamp01(0.7 * usableStartsZ + 0.2 * offNightShare - 0.15 * conflictRatio);
    return score;
  };

  // Helper function to get the actual numeric slot value
  const getActualSlots = () => {
    return dailySlots === 'custom' ? customSlots : dailySlots;
  };

  // Helper functions for dynamic text
  const getPositionType = () => {
    if (dailySlots === 4) return 'Defense';
    if (dailySlots === 2) return 'Forward';
    return 'Custom';
  };

  const getMinLockCount = () => {
    const slots = getActualSlots();
    return Math.max(1, Math.floor(slots / 2));
  };

  const getMaxLockCount = () => {
    return getActualSlots();
  };

  const getTargetDescription = () => {
    const slots = getActualSlots();
    if (dailySlots === 4) return `5th defense team (${slots} daily slots)`;
    if (dailySlots === 2) return `3rd team for Centers/Wings/Goalies (${slots} daily slots)`;
    return `additional team for ${slots}-slot roster`;
  };

  const getPositionDescription = () => {
    const slots = getActualSlots();
    if (dailySlots === 4) return `${slots + 1}th defenseman`;
    if (dailySlots === 2) return `${slots + 1}rd team`;
    return `${slots + 1}th roster slot`;
  };

  const getShortPositionDescription = () => {
    const slots = getActualSlots();
    if (dailySlots === 4) return `${slots + 1}th D`;
    if (dailySlots === 2) return `${slots + 1}rd Team`;
    return `${slots + 1}th Slot`;
  };

  // Calculate Z-score for usable starts across all results
  const calculateUsableStartsZScores = (results: ComplementResult[]): number[] => {
    if (results.length === 0) return [];
    
    const usableStarts = results.map(r => r.nonOverlap);
    const mean = usableStarts.reduce((a, b) => a + b, 0) / usableStarts.length;
    const variance = usableStarts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / usableStarts.length;
    const stdDev = Math.sqrt(variance);
    
    // Avoid division by zero
    if (stdDev === 0) return usableStarts.map(() => 0);
    
    // Calculate Z-scores and normalize to 0-1 range
    return usableStarts.map(val => {
      const zScore = (val - mean) / stdDev;
      // Convert Z-score to 0-1 range (assuming normal distribution, ~95% of data within 2 std devs)
      return clamp01((zScore + 2) / 4);
    });
  };


  // Neon progress bar components
  const ConflictProgressBar = ({ conflicts }: { conflicts: number }) => {
    const maxConflicts = 60; // Cap for visualization
    const percentage = Math.min((conflicts / maxConflicts) * 100, 100);
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-0">
          <span className="scoreboard-stat text-xs">{conflicts}</span>
        </div>
        <div className="bar bar-red h-1" style={{ '--v': `${percentage}%` } as React.CSSProperties}></div>
      </div>
    );
  };

  const UsableStartsProgressBar = ({ starts, isRosterMode }: { starts: number, isRosterMode: boolean }) => {
    const maxStarts = isRosterMode ? 200 : 50; // Different scales for different modes
    const percentage = Math.min((starts / maxStarts) * 100, 100);
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-0">
          <span className="scoreboard-stat text-xs">{starts}</span>
        </div>
        <div className="bar bar-green h-1" style={{ '--v': `${percentage}%` } as React.CSSProperties}></div>
      </div>
    );
  };

  const OffNightProgressBar = ({ offNightPct }: { offNightPct: number }) => {
    const percentage = offNightPct * 100;
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-0">
          <span className="scoreboard-stat text-xs">{percentage.toFixed(1)}%</span>
        </div>
        <div className="bar bar-cyan h-1" style={{ '--v': `${percentage}%` } as React.CSSProperties}></div>
      </div>
    );
  };

  // LED Star Rating Component
  const DraftFitStars = ({ score }: { score: number }) => {
    // Convert 0-1 score to 1-5 stars for better dynamic range
    const stars = Math.round(1 + score * 4); // 1..5 range
    const starCount = Math.max(1, Math.min(5, stars));
    
    const getStarClass = (index: number) => {
      if (index < starCount) {
        if (score >= 0.8) return 'star-led star-elite';
        if (score >= 0.6) return 'star-led star-good';  
        if (score >= 0.4) return 'star-led star-okay';
        return 'star-led';
      }
      return 'star-led star-dim';
    };

    return (
      <div className="stars-led">
        {[...Array(5)].map((_, i) => (
          <span key={i} className={getStarClass(i)}></span>
        ))}
      </div>
    );
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const team = teams.find(t => t.id === seedTeamId);
      const teamIdentifier = team ? team.abbreviation : String(seedTeamId);
      
      console.log('[rankings] handleSearch debug:', { 
        mode, 
        lockedTeamsLength: lockedTeams.length, 
        lockedTeams,
        condition: mode === 'complement' || lockedTeams.length === 0
      });
      
      if (mode === 'complement' || lockedTeams.length === 0) {
        // Standard complement analysis - use TimeWindow config for dates
        const startDate = new Date(timeWindow.state.config.startUtc);
        const endDate = new Date(timeWindow.state.config.endUtc);
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];
        
        const complements = await apiService.getComplements(teamIdentifier, start, end);
        
        // Calculate Z-scores for usable starts across all results
        const zScores = calculateUsableStartsZScores(complements);
        
        const enhancedResults = complements.map((result: ComplementResult, index) => {
          const conflictRatio = result.conflicts / 82; // Normalize conflicts to 0-1 range
          return {
            ...result,
            draftFitScore: calculateDraftFitScore(zScores[index], result.offNightShare, conflictRatio)
          };
        });
        setResults(enhancedResults);
      } else {
        // Roster-aware analysis for each candidate
        const seedTri = teamIdentifier;
        const lockedTriCodes = lockedTeams;
        
        console.log('[rankings] mode=roster-aware', {
          seed: seedTri,
          locked: lockedTriCodes,            // e.g., ['CAR','UTA']
          window: { start: 'auto', end: 'auto', type: window },
          slotsPerDay: getActualSlots(),
        });
        
        const allTeamCodes = teams.map(t => t.abbreviation);
        const rosterSet = new Set([seedTri, ...lockedTriCodes].map(x => x.toUpperCase()));
        const candidateTeamCodes = allTeamCodes.filter(code => 
          !rosterSet.has(code.toUpperCase())
        );
        
        console.log('[rankings] candidates after filtering:', {
          totalTeams: allTeamCodes.length,
          rosterTeams: [...rosterSet],
          candidateCount: candidateTeamCodes.length,
          sampleCandidates: candidateTeamCodes.slice(0, 5)
        });
        
        // Use bulk API for roster-aware calculations
        const rosterTeamCodes = [seedTri, ...lockedTriCodes];
        
        // Set up date range from TimeWindow config
        const startDate = new Date(timeWindow.state.config.startUtc);
        const endDate = new Date(timeWindow.state.config.endUtc);
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];
        
        const bulkPayload = {
          rosterTeamCodes,
          start,
          end,
          slotsPerDay: getActualSlots()
        };
        
        console.log('[rankings] calling /added-starts-bulk', bulkPayload);
        
        let rosterAwareResults: ComplementResult[] = [];
        
        try {
          console.log('[rankings] about to call bulk API with payload:', bulkPayload);
          const bulkResult = await apiService.getAddedStartsBulk(bulkPayload);
          
          console.log('[rankings] bulk response received, sample:', bulkResult.rows?.slice(0, 3));
          
          // Get basic complement data for enrichment
          const basicComplement = await apiService.getComplements(teamIdentifier, start, end);
          
          rosterAwareResults = bulkResult.rows.map(row => {
            // Find matching complement data
            const candidateData = basicComplement.find((r: ComplementResult) => r.abbreviation === row.team);
            
            return {
              teamCode: row.team,
              teamName: row.teamName,
              abbreviation: row.abbreviation,
              conflicts: candidateData?.conflicts || 0,
              nonOverlap: candidateData?.nonOverlap || 0,
              offNightShare: candidateData?.offNightShare || 0,
              complement: candidateData?.complement || 0,
              weightedComplement: candidateData?.weightedComplement || 0,
              datesComplement: candidateData?.datesComplement || [],
              usableStarts: row.usableStarts,
              // Temporary placeholder - will be calculated after Z-scores
              draftFitScore: 0
            };
          });
          
          console.log('[rankings] processed results sample:', rosterAwareResults?.slice(0, 3));
          
        } catch (err) {
          console.error('Error with bulk added starts:', err);
          console.error('Error details:', {
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : 'No stack trace',
            response: (err as any)?.response?.data,
            status: (err as any)?.response?.status,
            config: (err as any)?.config ? {
              url: (err as any).config.url,
              method: (err as any).config.method,
              data: (err as any).config.data
            } : 'No config'
          });
          
          // Check if it's a validation error due to limited games in the time window
          if ((err as any)?.response?.status === 400) {
            const errorData = (err as any)?.response?.data;
            const errorMessage = errorData?.message || errorData?.error || 'Not enough games in the selected time period. Try a longer time window.';
            throw new Error(errorMessage);
          }
          
          // Fall back to empty results for other errors
          rosterAwareResults = [];
        }
        
        // Calculate Z-scores and update draft fit scores for roster-aware results
        if (rosterAwareResults.length > 0) {
          const zScores = calculateUsableStartsZScores(rosterAwareResults);
          rosterAwareResults = rosterAwareResults.map((result, index) => {
            const conflictRatio = (result.conflicts || 0) / 82; // Normalize conflicts to 0-1 range
            return {
              ...result,
              draftFitScore: calculateDraftFitScore(zScores[index], result.offNightShare || 0, conflictRatio)
            };
          });
        }
        
        // Sort by usable starts (desc), then by draft fit score (desc)
        rosterAwareResults.sort((a, b) => 
          (b.usableStarts || 0) - (a.usableStarts || 0) ||
          (b.draftFitScore || 0) - (a.draftFitScore || 0)
        );
        
        console.log('[rankings] response sample', rosterAwareResults?.slice(0,3));
        
        // Check if we have meaningful results
        if (rosterAwareResults.length === 0) {
          throw new Error('No teams found for the selected time period. Try a longer time window or different settings.');
        }
        
        setResults(rosterAwareResults);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data. Please try again.';
      setError(errorMessage);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLockTeam = (teamCode: string) => {
    console.log('[lock] handleLockTeam called with:', teamCode);
    console.log('[lock] current lockedTeams:', lockedTeams);
    console.log('[lock] team already locked?', lockedTeams.includes(teamCode));

    if (!lockedTeams.includes(teamCode)) {
      const newLockedTeams = [...lockedTeams, teamCode];
      console.log('[lock] setting new locked teams:', newLockedTeams);
      setLockedTeams(newLockedTeams);
      setMode('roster-aware');
      console.log('[lock] set mode to roster-aware');

      // Success animations and feedback
      setShowToast({
        message: `${teamCode} locked in! Switching to roster-aware mode...`,
        type: 'success'
      });

      // Auto-hide toast after 3 seconds
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  const handleUnlockTeam = (teamCode: string) => {
    const newLockedTeams = lockedTeams.filter(code => code !== teamCode);
    setLockedTeams(newLockedTeams);
    if (newLockedTeams.length === 0) {
      setMode('complement');
    }
  };

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('off-night-seed-team', String(seedTeamId));
  }, [seedTeamId]);
  
  useEffect(() => {
    localStorage.setItem('off-night-locked-teams', JSON.stringify(lockedTeams));
  }, [lockedTeams]);
  
  useEffect(() => {
    localStorage.setItem('off-night-show-all-teams', JSON.stringify(showAllTeams));
  }, [showAllTeams]);
  
  useEffect(() => {
    localStorage.setItem('off-night-daily-slots', String(dailySlots));
  }, [dailySlots]);

  useEffect(() => {
    localStorage.setItem('off-night-custom-slots', String(customSlots));
  }, [customSlots]);

  useEffect(() => {
    handleSearch();
  }, [seedTeamId, timeWindow.state, lockedTeams, mode, dailySlots, customSlots]);

  // Periodic attention grabber for Lock In buttons
  useEffect(() => {
    if (results.length > 0 && !loading && lockedTeams.length === 0) {
      const pulseInterval = setInterval(() => {
        setLockButtonPulse(true);
        setTimeout(() => setLockButtonPulse(false), 2000);
      }, 8000); // Pulse every 8 seconds

      return () => clearInterval(pulseInterval);
    }
  }, [results, loading, lockedTeams]);

  // Team tiers are now managed centrally by TeamTierManager
  // No need to fetch them here - just use the shared data

  const displayedResults = showAllTeams ? results : results.slice(0, 10);
  const isRosterMode = mode === 'roster-aware' && lockedTeams.length > 0;

  // Date range display is now handled by the TimeWindow component

  // Create dropdown options
  const teamOptions: DropdownOption[] = teams.map(team => ({
    value: team.id,
    label: `${team.name} (${team.abbreviation})`
  }));

  const slotOptions: DropdownOption[] = [
    { value: 2, label: 'Standard (2 slots)' },
    { value: 4, label: 'Defense (4 slots)' },
    { value: 'custom', label: 'Custom (1-8 slots)' }
  ];

  return (
    <div className="space-y-6">
      <Card className="glass-dropdown-container p-6">
        <h2 className="text-2xl brand-title mb-4">
          Who Fits Best with the {seedTeam?.name || 'Selected Team'}?
        </h2>
        <p className="text-gray-600 mb-6 font-inter">
          Finding the best {getTargetDescription()} — Lock {getMinLockCount()}-{getMaxLockCount()} teams, we'll find the optimal complement.
        </p>
        
        {/* Mode Toggle at top level for better alignment */}
        <div className="mb-6">
          <PlayoffModeToggle
            mode={timeWindow.state.mode}
            onChange={timeWindow.setMode}
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="flex flex-col">
            <label className="font-medium mb-2 scoreboard-text">Seed Team:</label>
            <IceDropdown
              options={teamOptions}
              value={seedTeamId}
              onChange={(value) => setSeedTeamId(Number(value))}
              placeholder="Select a team"
              aria-label="Select seed team"
            />
          </div>
          
          <div className="flex flex-col">
            <label className="font-medium mb-2 scoreboard-text">Position Type:</label>
            <IceDropdown
              options={slotOptions}
              value={dailySlots}
              onChange={(value) => setDailySlots(value === 'custom' ? 'custom' : Number(value) as 2 | 4)}
              placeholder="Select position type"
              aria-label="Select position type"
            />

            {dailySlots === 'custom' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of slots (1-8):
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={customSlots}
                  onChange={(e) => setCustomSlots(Math.min(8, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
          
          <TimeWindow
            value={timeWindow.state}
            onPresetChange={timeWindow.setPreset}
            onCustomRangeChange={timeWindow.setCustomRange}
            onModeChange={timeWindow.setMode}
            onPlayoffPresetChange={timeWindow.setPlayoffPreset}
            onLeagueWeeksChange={timeWindow.setLeagueWeeks}
            showModeToggle={false}
          />
          
          <div className="flex flex-col">
            <label className="font-medium mb-2 scoreboard-text">Display:</label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowAllTeams(!showAllTeams)}
                className="btn-neon"
              >
                {showAllTeams ? 'Show Top 10' : 'Show All Teams'}
              </button>
              <ScheduleColorToggle />
            </div>
          </div>
        </div>

        {lockedTeams.length > 0 && (
          <div className="mb-6">
            <h4 className="scoreboard-text mb-3">
              Locked Teams: {lockedTeams.length}
            </h4>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-sm" style={{backgroundColor: 'var(--ice-300)', color: 'var(--navy-900)'}}>
                <img 
                  src={getTeamLogoUrl(seedTeam?.abbreviation || '')} 
                  alt={seedTeam?.name}
                  className="w-5 h-5"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="font-medium">{seedTeam?.abbreviation} (seed)</span>
              </div>
              {lockedTeams.map(teamCode => {
                const team = teams.find(t => t.abbreviation === teamCode);
                return (
                  <div key={teamCode} className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2 shadow-sm">
                    <img 
                      src={getTeamLogoUrl(teamCode)} 
                      alt={team?.name}
                      className="w-5 h-5"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="font-medium">{teamCode}</span>
                    <button
                      onClick={() => handleUnlockTeam(teamCode)}
                      className="text-green-600 hover:text-green-800 font-bold ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-green-200 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            
            {/* Summary Statistics */}
            {isRosterMode && results.length > 0 && (
              <div className="bg-gradient-to-r from-teal-50 to-green-50 border border-teal-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: 'var(--navy-900)'}}></div>
                  <span className="font-semibold" style={{color: 'var(--navy-900)'}}>Roster Summary</span>
                </div>
                <p style={{color: 'var(--navy-900)', opacity: '0.8'}}>
                  With {lockedTeams.length + 1} teams ({[seedTeam?.abbreviation, ...lockedTeams].join(', ')}):
                  <span className="font-bold ml-1">
                    {results.length > 0 ? results[0].usableStarts || 0 : 0} total usable starts
                  </span>
                  ({getPositionType()} roster analysis)
                </p>
              </div>
            )}

            {/* Contextual Help Section */}
            {lockedTeams.length === 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-800 mb-2">
                      💡 How to Build Your Optimal Roster
                    </h4>
                    <div className="text-xs text-amber-700 space-y-1">
                      <p>• <strong>Step 1:</strong> Choose your seed team from the dropdown above</p>
                      <p>• <strong>Step 2:</strong> Click "Lock In" on teams with low conflicts (🔴) and high extra games (🟢)</p>
                      <p>• <strong>Step 3:</strong> Watch as the optimizer switches to roster-aware mode and suggests the best additions</p>
                      <p>• <strong>Pro tip:</strong> Target teams with high Off-Night % (🔵) for easier lineup management</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </Card>

      <Card>
        {/* Horizontal Progress Bar */}
        <div className="mx-6 mt-6 mb-4 p-3 bg-gradient-to-r from-blue-50 via-white to-cyan-50 border border-blue-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            {/* Step 1: Seed Team Selected */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                ✓
              </div>
              <span className="text-sm font-semibold text-green-700">
                Seed Team Selected
              </span>
            </div>

            {/* Arrow */}
            <div className="text-blue-400 font-bold">→</div>

            {/* Step 2: Lock Your Choices */}
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 ${lockedTeams.length > 0 ? 'bg-blue-500 text-white' : 'bg-blue-300 text-white'} rounded-full flex items-center justify-center text-xs font-bold shadow-sm`}>
                2
              </div>
              <span className={`text-sm font-semibold ${lockedTeams.length > 0 ? 'text-blue-700' : 'text-blue-600'}`}>
                Lock Your Choices ({lockedTeams.length}/1 - 2)
              </span>
            </div>

            {/* Arrow */}
            <div className="text-blue-400 font-bold">→</div>

            {/* Step 3: Click Lock In buttons */}
            <div className="flex items-center gap-1">
              <span className={`text-sm font-bold ${lockedTeams.length === 0 ? 'text-blue-600 animate-pulse' : 'text-green-600'}`}>
                {lockedTeams.length === 0 ? '👇 Click Lock In buttons below!' : '✅ Teams locked!'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-b">
          <h3 className="text-lg brand-title">
            {isRosterMode
              ? `Team Rankings (${getPositionType()} Roster Analysis with ${lockedTeams.length + 1} teams)`
              : <span style={{ color: 'var(--rink-navy)' }}>{`Complement Analysis for ${seedTeam?.name || 'Selected Team'}`}</span>
            }
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 mt-1 font-inter">
              Ranked by: {isRosterMode ? 'Usable Starts → Draft Fit Score' : 'Fewest Conflicts → Most Extra Games → Off-Night %'}
            </p>
            <p className="text-sm text-gray-500 mt-1 sm:mt-0 font-mono">
              📅 {timeWindow.state.config.displayLabel}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{borderBottomColor: 'var(--teal-500)'}}></div>
            <p className="mt-2">Loading {isRosterMode ? 'roster-aware' : 'complement'} data...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Games in Selected Window</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {timeWindow.state.preset === '7d' ? 'No games scheduled in the next 7 days.' : 
               timeWindow.state.preset === '14d' ? 'No games scheduled in the next 14 days.' :
               timeWindow.state.preset === '30d' ? 'No games scheduled in the next 30 days.' : 
               'No games found for the selected time period.'}
              <br />
              <span className="text-sm">Try selecting "Full season" or a different time window.</span>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200 tabular-nums">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left data-label text-gray-500">
                    Team
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left data-label text-gray-500">
                    <span title="Nights both teams play (bad, avoid high numbers)" className="hidden sm:inline">
                      Games Same Nights 🔴
                    </span>
                    <span title="Nights both teams play (bad, avoid high numbers)" className="sm:hidden">
                      Conflicts 🔴
                    </span>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left data-label text-gray-500">
                    <span title={isRosterMode
                      ? `Real starts this team adds as ${getPositionDescription()} with your current roster`
                      : "Games the candidate team plays when your seed team is idle (good, higher = more starts)"
                    } className="hidden sm:inline">
                      {isRosterMode ? `Usable Starts (${getShortPositionDescription()}) 🟢` : 'Games When Idle 🟢'}
                    </span>
                    <span title={isRosterMode
                      ? `Real starts this team adds as ${getPositionDescription()} with your current roster`
                      : "Games the candidate team plays when your seed team is idle (good, higher = more starts)"
                    } className="sm:hidden">
                      {isRosterMode ? 'Starts 🟢' : 'Extra 🟢'}
                    </span>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left data-label text-gray-500">
                    <span title="% of extra games on Mon/Wed/Fri/Sun (easy lineup nights)">
                      Off-Night % 🔵
                    </span>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left data-label text-gray-500">
                    <span title="Combined metric: low conflicts, high extras, good off-night share">
                      Draft Fit ⭐
                    </span>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left data-label text-gray-500">
                    <span className="flex items-center gap-1 font-semibold text-blue-600">
                      ACTION 👇 CLICK LOCK IN!
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedResults.map((result, index) => (
                  <tr 
                    key={result.teamCode} 
                    className="hover:bg-gray-50 fade-in-row"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <img 
                          src={getTeamLogoUrl(result.abbreviation)} 
                          alt={result.teamName}
                          className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm font-bold uppercase tracking-wide font-mono">
                            <TeamColorDisplay
                              teamCode={result.abbreviation}
                              teamTier={teamTiers.getTeamTier(result.abbreviation)}
                            >
                              {result.abbreviation}
                            </TeamColorDisplay>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <ConflictProgressBar conflicts={result.conflicts} />
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <UsableStartsProgressBar 
                        starts={isRosterMode ? (result.usableStarts || 0) : result.nonOverlap}
                        isRosterMode={isRosterMode}
                      />
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <OffNightProgressBar offNightPct={result.offNightShare} />
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                      <DraftFitStars score={result.draftFitScore || 0} />
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                      {lockedTeams.includes(result.abbreviation) ? (
                        <button
                          onClick={() => handleUnlockTeam(result.abbreviation)}
                          className="btn-neon btn-danger text-xs"
                        >
                          Unlock
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLockTeam(result.abbreviation)}
                          className={`btn-neon btn-success text-xs transition-all duration-300 flex items-center gap-1 ${
                            lockButtonPulse ? 'animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.6)]' : ''
                          }`}
                        >
                          <span className="text-sm font-bold">+</span>
                          Lock In
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Team Tier Legend */}
      <TierLegend className="mt-4" />

      {/* Toast Notification */}
      {showToast && (
        <div
          className="fixed bottom-4 right-4 z-50 animate-slide-up"
          style={{
            backgroundColor: showToast.type === 'success' ? 'var(--glass-fill-active)' : 'var(--glass-fill)',
            border: showToast.type === 'success' ? '1px solid var(--laser-cyan)' : '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '12px 20px',
            color: showToast.type === 'success' ? 'var(--laser-cyan)' : 'var(--text-primary)',
            boxShadow: showToast.type === 'success'
              ? '0 0 24px rgba(94,245,255,0.3), 0 8px 32px rgba(0,0,0,0.2)'
              : '0 8px 32px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            fontWeight: '500',
            fontSize: '14px',
            maxWidth: '320px',
            animation: 'slideUpFade 0.4s ease-out'
          }}
        >
          {showToast.message}
        </div>
      )}
    </div>
  );
};