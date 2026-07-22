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
import { CalendarDays, Lock, LockKeyhole, Star } from 'lucide-react';
import { Button } from './ui/button';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader } from './ui/data-table';
import { EmptyState } from './ui/empty-state';
import { StatBar } from './ui/stat-bar';
import { Toast } from './ui/toast';
import { TooltipLabel } from './ui/tooltip';

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

  // LED Star Rating Component
  const DraftFitStars = ({ score }: { score: number }) => {
    // Convert 0-1 score to 1-5 stars for better dynamic range
    const stars = Math.round(1 + score * 4); // 1..5 range
    const starCount = Math.max(1, Math.min(5, stars));
    
    return (
      <div className="flex items-center gap-1" aria-label={`${starCount} of 5 draft fit`}>
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={14} className={i < starCount ? 'fill-warning text-warning' : 'text-ink-mute'} aria-hidden="true" />
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
        
        
        const allTeamCodes = teams.map(t => t.abbreviation);
        const rosterSet = new Set([seedTri, ...lockedTriCodes].map(x => x.toUpperCase()));
        const candidateTeamCodes = allTeamCodes.filter(code => 
          !rosterSet.has(code.toUpperCase())
        );
        
        
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
        
        
        let rosterAwareResults: ComplementResult[] = [];
        
        try {
          const bulkResult = await apiService.getAddedStartsBulk(bulkPayload);
          
          
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

    if (!lockedTeams.includes(teamCode)) {
      const newLockedTeams = [...lockedTeams, teamCode];
      setLockedTeams(newLockedTeams);
      setMode('roster-aware');

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
        <p className="text-ink-mute mb-6 font-inter">
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
          <div className="flex flex-col mb-4 sm:mb-0">
            <label className="font-medium mb-2 scoreboard-text">Seed Team:</label>
            <IceDropdown
              options={teamOptions}
              value={seedTeamId}
              onChange={(value) => setSeedTeamId(Number(value))}
              placeholder="Select a team"
              aria-label="Select seed team"
            />
          </div>

          <div className="flex flex-col mb-4 sm:mb-0">
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
                <label className="block text-sm font-medium text-ink mb-2">
                  Number of slots (1-8):
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={customSlots}
                  onChange={(e) => setCustomSlots(Math.min(8, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-20 px-3 py-2 border border-line rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent"
                />
              </div>
            )}
          </div>

          <div className="mb-4 sm:mb-0">
            <TimeWindow
              value={timeWindow.state}
              onPresetChange={timeWindow.setPreset}
              onCustomRangeChange={timeWindow.setCustomRange}
              onModeChange={timeWindow.setMode}
              onPlayoffPresetChange={timeWindow.setPlayoffPreset}
              onLeagueWeeksChange={timeWindow.setLeagueWeeks}
              showModeToggle={false}
            />
          </div>

          <div className="flex flex-col mb-4 sm:mb-0">
            <label className="font-medium mb-2 scoreboard-text">Display:</label>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setShowAllTeams(!showAllTeams)}
                variant="ghost"
              >
                {showAllTeams ? 'Show Top 10' : 'Show All Teams'}
              </Button>
              <ScheduleColorToggle />
            </div>
          </div>
        </div>


        {error && (
          <div className="bg-negative-muted border border-negative text-negative px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </Card>
      {/* Sticky Locked Teams - positioned outside Card containers for proper viewport sticking */}
      {lockedTeams.length > 0 && (
        <div className="mb-6 locked-teams-sticky">
          <div className="flex flex-wrap gap-3">
            <div
              className='px-4 py-2 rounded-full border border-line bg-surface-2 text-sm text-ink flex items-center gap-2 shadow-sm'>
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
                <div key={teamCode} className="px-4 py-2 bg-positive-muted text-positive rounded-full text-sm flex items-center gap-2 shadow-sm">
                  <Lock size={12} className="text-positive" aria-hidden="true" />
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
                    className="text-positive hover:text-positive font-bold ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-positive transition-colors"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Card>
        <p className="mx-6 mb-2 mt-6 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink-dim">
          <LockKeyhole size={16} className="text-accent" aria-hidden="true" />
          Lock one or more teams to compare how each candidate fits your full roster.
        </p>

        <div className="px-6 py-4 border-b">
          <h3 className="text-lg brand-title">
            {isRosterMode
              ? `Team Rankings (${getPositionType()} Roster Analysis with ${lockedTeams.length + 1} teams)`
              : <span className="text-ink">{`Complement Analysis for ${seedTeam?.name || 'Selected Team'}`}</span>
            }
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-mute mt-1 font-inter">
              Ranked by: {isRosterMode ? 'Usable Starts → Draft Fit Score' : 'Fewest Conflicts → Most Extra Games → Off-Night %'}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-ink-mute mt-1 sm:mt-0 font-mono">
              <CalendarDays size={14} aria-hidden="true" /> {timeWindow.state.config.displayLabel}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div
              className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 [border-bottom-color:var(--accent)]'></div>
            <p className="mt-2">Loading {isRosterMode ? 'roster-aware' : 'complement'} data...</p>
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            className="m-6"
            title="No games in selected window"
            icon={<CalendarDays size={22} />}
            description={<>
              {timeWindow.state.preset === '7d' ? 'No games scheduled in the next 7 days.' : 
               timeWindow.state.preset === '14d' ? 'No games scheduled in the next 14 days.' :
               timeWindow.state.preset === '30d' ? 'No games scheduled in the next 30 days.' : 
               'No games found for the selected time period.'}
              <br />
              <span className="text-sm">Try selecting "Full season" or a different time window.</span>
            </>}
          />
        ) : (
          <div className="team-ranking-table">
            {/* Desktop Table */}
            <div className="overflow-x-auto -mx-4 sm:mx-0 hidden sm:block">
              <DataTable className="min-w-full tabular-nums">
                <DataTableHeader sticky>
                  <tr>
                    <DataTableHead className="px-3 sm:px-6">
                      Team
                    </DataTableHead>
                    <DataTableHead className="px-3 sm:px-6">
                      <TooltipLabel label="Nights both teams play (avoid high numbers)">
                        <span className="hidden sm:inline">Games same nights</span>
                      </TooltipLabel>
                      <TooltipLabel label="Nights both teams play (avoid high numbers)">
                        <span className="sm:hidden">Conflicts</span>
                      </TooltipLabel>
                    </DataTableHead>
                    <DataTableHead className="px-3 sm:px-6">
                      <TooltipLabel label={isRosterMode
                        ? `Real starts this team adds as ${getPositionDescription()} with your current roster`
                        : "Games the candidate team plays when your seed team is idle (good, higher = more starts)"
                      }>
                        <span className="hidden sm:inline">{isRosterMode ? `Usable starts (${getShortPositionDescription()})` : 'Games when idle'}</span>
                      </TooltipLabel>
                      <TooltipLabel label={isRosterMode
                        ? `Real starts this team adds as ${getPositionDescription()} with your current roster`
                        : "Games the candidate team plays when your seed team is idle (good, higher = more starts)"
                      }>
                        <span className="sm:hidden">{isRosterMode ? 'Starts' : 'Extra'}</span>
                      </TooltipLabel>
                    </DataTableHead>
                    <DataTableHead className="px-3 sm:px-6"><TooltipLabel label="Share of extra games on easier lineup nights"><span>Off-night %</span></TooltipLabel></DataTableHead>
                    <DataTableHead className="px-3 sm:px-6"><TooltipLabel label="Combined metric: low conflicts, high extras, and off-night share"><span>Draft fit</span></TooltipLabel></DataTableHead>
                    <DataTableHead className="px-3 sm:px-6">Roster</DataTableHead>
                  </tr>
                </DataTableHeader>
                <DataTableBody>
                  {displayedResults.map((result, index) => (
                    <tr
                      key={result.teamCode}
                      className="hover:bg-surface-2 fade-in-row"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <DataTableCell className="px-3 sm:px-6 whitespace-nowrap">
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
                            <div className="font-medium text-ink text-sm font-bold uppercase tracking-wide font-mono">
                              <TeamColorDisplay
                                teamCode={result.abbreviation}
                                teamTier={teamTiers.getTeamTier(result.abbreviation)}
                              >
                                {result.abbreviation}
                              </TeamColorDisplay>
                            </div>
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="px-3 sm:px-6"><StatBar value={result.conflicts} max={60} intent="negative" /></DataTableCell>
                      <DataTableCell className="px-3 sm:px-6"><StatBar value={isRosterMode ? (result.usableStarts || 0) : result.nonOverlap} max={isRosterMode ? 200 : 50} intent="positive" /></DataTableCell>
                      <DataTableCell className="px-3 sm:px-6"><StatBar value={result.offNightShare * 100} max={100} intent="accent" displayValue={`${(result.offNightShare * 100).toFixed(1)}%`} /></DataTableCell>
                      <DataTableCell className="px-3 sm:px-6 whitespace-nowrap text-sm">
                        <DraftFitStars score={result.draftFitScore || 0} />
                      </DataTableCell>
                      <DataTableCell className="px-3 sm:px-6 whitespace-nowrap text-sm">
                        {lockedTeams.includes(result.abbreviation) ? (
                          <Button
                            onClick={() => handleUnlockTeam(result.abbreviation)}
                            variant="danger" size="sm"
                          >
                            Unlock
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleLockTeam(result.abbreviation)}
                            size="sm"
                          >
                            <span className="text-sm font-bold">+</span>
                            Lock In
                          </Button>
                        )}
                      </DataTableCell>
                    </tr>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>

            {/* Mobile Card Layout - Professional 2x2 Design */}
            <div className="mobile-ranking-cards sm:hidden">
              {displayedResults.map((result, index) => (
                <div key={result.teamCode} className="team-ranking-card fade-in-row" style={{ animationDelay: `${index * 50}ms` }}>
                  {/* Card Header - Logo + Team Code */}
                  <div className="team-ranking-card-header">
                    <div className="team-ranking-card-team-info">
                      <div className="team-ranking-card-logo">
                        <img
                          src={getTeamLogoUrl(result.abbreviation)}
                          alt={result.teamName}
                          className='mobile-card-logo w-[38px] h-[38px] max-w-[38px] max-h-[38px]'
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }} />
                      </div>
                      <div className="team-ranking-card-tricode">
                        <TeamColorDisplay
                          teamCode={result.abbreviation}
                          teamTier={teamTiers.getTeamTier(result.abbreviation)}
                        >
                          {result.abbreviation}
                        </TeamColorDisplay>
                      </div>
                    </div>
                  </div>

                  {/* 2x2 Stats Grid */}
                  <div className="team-ranking-card-stats">
                    <div className="team-ranking-stat-box">
                      <div className="team-ranking-stat-label">Conflicts</div>
                      <div className="team-ranking-stat-value">{result.conflicts}</div>
                    </div>
                    <div className="team-ranking-stat-box">
                      <div className="team-ranking-stat-label">
                        {isRosterMode ? 'Starts' : 'Extra'}
                      </div>
                      <div className="team-ranking-stat-value">
                        {isRosterMode ? (result.usableStarts || 0) : result.nonOverlap}
                      </div>
                    </div>
                    <div className="team-ranking-stat-box">
                      <div className="team-ranking-stat-label">Off-night</div>
                      <div className="team-ranking-stat-value">
                        {Math.round((result.offNightShare || 0) * 100)}%
                      </div>
                    </div>
                    <div className="team-ranking-stat-box">
                      <div className="team-ranking-stat-label">Draft fit</div>
                      <div className="team-ranking-stat-value">
                        <DraftFitStars score={result.draftFitScore || 0} />
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="team-ranking-mobile-action">
                    {lockedTeams.includes(result.abbreviation) ? (
                      <Button
                        onClick={() => handleUnlockTeam(result.abbreviation)}
                        variant="danger"
                      >
                        Unlock
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleLockTeam(result.abbreviation)}
                        className="w-full"
                      >
                        <span className="font-bold">+</span>
                        Lock In
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
      {/* Team Tier Legend */}
      <TierLegend className="mt-4" />
      {showToast && (
        <Toast className="fixed bottom-4 right-4 z-50" intent={showToast.type === 'success' ? 'success' : 'info'}>
          {showToast.message}
        </Toast>
      )}
    </div>
  );
};
