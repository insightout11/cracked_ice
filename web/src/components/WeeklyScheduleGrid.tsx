import { isOffNight, computeB2B, type DayId, type TeamWeek, type WeeklySchedule, type SortMode, type TeamWeekWithScore } from '../lib/schedule';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, TooltipLabel } from '../components/ui/tooltip';
import { useIsTablet, useIsDesktop } from '../hooks/useMediaQuery';
import type { ScheduleOverlaySettings } from '../hooks/useScheduleOverlaySettings';

function computeTotals(team: TeamWeek, b2bSet: Set<DayId>) {
  const days = Object.keys(team.gamesByDay) as DayId[];
  let games = 0, offNights = 0, b2b = 0;
  days.forEach(d => {
    const dayGames = team.gamesByDay[d] || [];
    games += dayGames.length;
    // Count actual off-night games using real flags
    dayGames.forEach(game => {
      if (game.isOffNight) offNights += 1;
    });
    if (dayGames.length > 0 && b2bSet.has(d)) b2b += 1;
  });
  return { games, offNights, b2b };
}

// Helper to build enhanced streaming value tooltip
function buildStreamingTooltip(extraStarts: number, gapDatesCovered: string[]): string {
  const gapDays = gapDatesCovered
    .map(dateStr => format(new Date(dateStr), 'EEE'))
    .join(', ');
  const gapCount = gapDatesCovered.length;

  return gapCount === 1
    ? `${extraStarts} slots on 1 gap date (${gapDays})`
    : `${extraStarts} slots across ${gapCount} gap dates (${gapDays})`;
}

interface WeeklyScheduleGridProps {
  data: WeeklySchedule;
  sortMode?: SortMode;
  overlaySettings?: ScheduleOverlaySettings;
  offNightDays?: Partial<Record<DayId, boolean>>;
  gamesPerDay?: Partial<Record<DayId, number>>;
  userTeamCodes?: Set<string>;
  playerCountsByTeam?: Record<string, number>;
  onDayClick?: (dayId: DayId) => void;
  selectedDay?: DayId | null;
  dayConflicts?: Partial<Record<DayId, {
    rosteredPlayersPlaying: number;
    activeSlots: number;
    conflictLevel: 'free' | 'tight' | 'conflict';
    color: string;
  }>>;
  streamingValues?: Record<string, {
    team: string;
    extraUsableStarts: number;
    gapDatesCovered: string[];
  }>;
}

export function WeeklyScheduleGrid({
  data,
  overlaySettings = {
    showOffNightIndicators: true,
    highlightUserTeams: false,
    showPlayerCounts: false,
    filterUserTeamsOnly: false,
    showConflictOverlay: false,
    showStreamingValue: false
  },
  offNightDays = {},
  gamesPerDay = {},
  userTeamCodes = new Set(),
  playerCountsByTeam = {},
  onDayClick,
  selectedDay = null,
  dayConflicts = {},
  streamingValues = {}
}: WeeklyScheduleGridProps) {
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  // Debug logging

  if (!data || !data.teams || data.teams.length === 0) {
    return (
      <div className='p-[20px] [color:white] text-center text-[18px]'>No schedule data available
              </div>
    );
  }

  // Get responsive logo sizes based on breakpoint
  const getLogoSizes = () => {
    if (isTablet) {
      return {
        teamLogo: { width: '64px', height: '64px' },
        opponentLogo: { width: '52px', height: '52px' }
      };
    }
    // Mobile sizes
    return {
      teamLogo: { width: '40px', height: '40px' },
      opponentLogo: { width: '28px', height: '28px' }
    };
  };

  const logoSizes = getLogoSizes();
  

  // Mobile grid view component
  const MobileScheduleView = () => (
    <div
      className='mobile-schedule-grid [background:linear-gradient(135deg,_var(--line),_var(--line))] rounded-[16px] [border:1px_solid_var(--accent-muted)] overflow-visible [backdrop-filter:blur(15px)]'>
      {/* Mobile Grid Header */}
      <div className='grid [grid-template-columns:60px_repeat(7,_1fr)_80px] gap-[1px] [background:linear-gradient(180deg,_var(--surface-0),_var(--surface-0))] [padding:8px_4px] [border-bottom:2px_solid_var(--accent)] [border-top:1px_solid_var(--accent-muted)] sticky top-[0px] z-[100] [backdrop-filter:blur(20px)_saturate(150%)] [-webkit-backdrop-filter:blur(20px)_saturate(150%)] [box-shadow:0_2px_10px_var(--surface-0)]'>
        <div className='text-accent text-[10px] font-bold text-center [padding:6px_2px] uppercase [border-right:1px_solid_var(--line)]'>
          Team
        </div>
        {data.days.map((day) => (
          <TooltipLabel label={onDayClick ? `Click to sort by ${day.id}` : undefined}><div
            key={day.id}
            onClick={() => onDayClick?.(day.id)}
            style={{
              cursor: onDayClick ? 'pointer' : 'default',
              backgroundColor: selectedDay === day.id ? 'var(--accent-muted)' : 'transparent'
            }}
            className='text-accent text-[9px] font-bold text-center [padding:6px_2px] uppercase leading-[1.1] [border-right:1px_solid_var(--line)] relative [transition:background-color_0.2s]'>
              <div>{day.id}</div>
              <div className='opacity-[0.7] text-[8px]'>{day.date}</div>
              {/* Horizontal container for game count and conflict indicators */}
              <div className='flex items-center justify-center gap-[4px] mt-[3px] min-h-[12px]'>
                {/* Game count badge */}
                {gamesPerDay?.[day.id] !== undefined && (
                  <div className='text-[7px] text-accent font-semibold'>
                    ({gamesPerDay[day.id]}g)
                  </div>
                )}

                {/* Conflict Overlay - Mobile */}
                {overlaySettings?.showConflictOverlay && dayConflicts?.[day.id] && (
                  <div
                    style={{
                      color: dayConflicts[day.id].color
                    }}
                    className='text-[7px] font-bold flex items-center gap-[2px]'>
                    <div
                      style={{
                        background: dayConflicts[day.id].color
                      }}
                      className='w-[4px] h-[4px] rounded-full' />
                    {dayConflicts[day.id].rosteredPlayersPlaying}/{dayConflicts[day.id].activeSlots}
                  </div>
                )}
              </div>
              {/* Off-night indicator for mobile */}
              {overlaySettings?.showOffNightIndicators && offNightDays?.[day.id] && (
                <TooltipLabel label="Off-night (≤8 league games)">
                  <div className='absolute top-[2px] right-[2px] w-[6px] h-[6px] bg-positive rounded-full [box-shadow:0_0_4px_var(--positive)]' />
                </TooltipLabel>
              )}
            </div></TooltipLabel>
        ))}
        <div className='text-accent text-[10px] font-bold text-center [padding:6px_2px] uppercase'>
          Total
        </div>
      </div>

      {/* Mobile Grid Rows */}
      {data.teams.map((team, teamIndex) => {
        const b2bSet = computeB2B(team);
        const totals = computeTotals(team, b2bSet);
        const isUserTeam = overlaySettings?.highlightUserTeams && userTeamCodes?.has(team.team);
        const playerCount = playerCountsByTeam?.[team.team] || 0;

        return (
          <div
            key={team.team}
            style={{
              background: isUserTeam
                ? 'var(--accent-muted)'
                : (teamIndex % 2 === 1 ? 'var(--surface-2)' : 'var(--surface-1)'),

              borderBottom: teamIndex === data.teams.length - 1 ? 'none' : '1px solid var(--line)',
              borderLeft: isUserTeam ? '3px solid var(--accent)' : 'none',
              minHeight: isTablet ? '25px' : '40px'
            }}
            className='grid [grid-template-columns:60px_repeat(7,_1fr)_80px] gap-[1px]'>
            {/* Team Logo/Name */}
            <div
              style={{
                padding: isTablet ? '2px 4px' : '4px 2px'
              }}
              className='flex items-center justify-center flex-col [border-right:1px_solid_var(--line)] relative'>
              <img
                src={team.logo}
                alt={team.teamName}
                style={{ ...logoSizes.teamLogo, marginBottom: isTablet ? '0px' : '2px' }}
              />
              <span
                style={{
                  fontSize: isTablet ? '12px' : '10px'
                }}
                className='text-ink font-extrabold text-center [text-shadow:0_1px_2px_var(--surface-0)]'>
                {team.team}
              </span>

              {/* Player count badge for mobile */}
              {overlaySettings?.showPlayerCounts && playerCount > 0 && (
                <div className='absolute bottom-[2px] right-[2px] [background:linear-gradient(135deg,_var(--accent),_var(--accent))] text-accent-ink text-[7px] font-extrabold [padding:1px_3px] rounded-[6px] [border:1px_solid_var(--surface-0)]'>
                  {playerCount}
                </div>
              )}

              {/* Streaming Value Badge - Mobile */}
              {overlaySettings?.showStreamingValue && streamingValues?.[team.team] && streamingValues[team.team].extraUsableStarts > 0 && (
                <TooltipLabel
                  label={buildStreamingTooltip(
                    streamingValues[team.team].extraUsableStarts,
                    streamingValues[team.team].gapDatesCovered
                  )}><div
                    className='absolute top-[2px] left-[2px] [background:linear-gradient(135deg,_var(--warning),_var(--warning))] text-accent-ink text-[7px] font-extrabold [padding:2px_4px] rounded-[6px] [border:1px_solid_var(--surface-0)] [box-shadow:0_2px_4px_var(--warning-muted)] z-[10]'>+{streamingValues[team.team].extraUsableStarts}
                  </div></TooltipLabel>
              )}
            </div>
            {/* Game Days */}
            {data.days.map((day) => {
              const games = team.gamesByDay[day.id] || [];
              const hasGames = games.length > 0;
              const isOffNightDay = hasGames && games.some(g => g.isOffNight);
              const isB2B = hasGames && b2bSet.has(day.id);
              
              return (
                <div
                  key={day.id}
                  style={{
                    padding: isTablet ? '2px 2px' : '2px 1px',
                    minHeight: isTablet ? '25px' : '40px',

                    backgroundColor: hasGames
                      ? (isOffNightDay ? 'var(--positive-muted)' : 'var(--accent-muted)')
                      : 'transparent',

                    border: hasGames ? '1px solid var(--accent-muted)' : 'none'
                  }}
                  className='flex items-center justify-center rounded-[4px] relative [border-right:1px_solid_var(--line)]'>
                  {hasGames ? (
                    <div className='flex flex-col items-center justify-center h-[100%] relative'>
                      <div
                        style={{
                          fontSize: isTablet ? '12px' : '8px',
                          marginBottom: isTablet ? '0px' : '2px'
                        }}
                        className='text-ink font-extrabold [text-shadow:0_1px_2px_var(--surface-0)]'>
                        {games[0].home ? 'vs' : '@'}
                      </div>
                      <img
                        src={games[0].opponentLogo}
                        alt={games[0].opponent}
                        style={{
                          ...logoSizes.opponentLogo
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.textContent = games[0].opponent;
                            fallback.style.fontSize = '6px';
                            fallback.style.color = 'var(--ink)';
                            fallback.style.fontWeight = '500';
                            parent.appendChild(fallback);
                          }
                        }}
                        className='[object-fit:contain]' />
                      {isB2B && (
                        <div className='absolute top-[1px] right-[1px] w-[6px] h-[6px] bg-negative rounded-full' />
                      )}
                    </div>
                  ) : (
                    <div className='text-[8px] text-ink-mute opacity-[0.5]'>-</div>
                  )}
                </div>
              );
            })}
            {/* Totals Column */}
            <div
              style={{
                padding: isTablet ? '2px 4px' : '4px 2px'
              }}
              className='flex flex-col items-center justify-center [background:linear-gradient(135deg,_var(--surface-0),_var(--surface-0))] rounded-[4px] [border:1px_solid_var(--accent-muted)]'>
              <div
                style={{
                  fontSize: isTablet ? '16px' : '12px'
                }}
                className='font-extrabold text-ink [text-shadow:0_1px_2px_var(--surface-0),_0_0_6px_var(--accent-muted)] mb-[2px]'>
                {totals.games}
              </div>
              <div
                style={{
                  fontSize: isTablet ? '10px' : '8px'
                }}
                className='text-ink uppercase font-semibold opacity-[0.9] mb-[4px] [text-shadow:0_1px_2px_var(--surface-0)]'>
                games
              </div>
              <div className='flex flex-col gap-[2px] w-[100%] items-center'>
                <div
                  style={{
                    fontSize: isTablet ? '10px' : '8px'
                  }}
                  className='flex items-center gap-[3px]'>
                  <span className='text-accent font-bold [text-shadow:0_1px_2px_var(--surface-0),_0_0_6px_var(--accent-muted)]'>OFF</span>
                  <span className='text-ink font-extrabold [text-shadow:0_1px_2px_var(--surface-0)]'>{totals.offNights}</span>
                </div>
                <div
                  style={{
                    fontSize: isTablet ? '10px' : '8px'
                  }}
                  className='flex items-center gap-[3px]'>
                  <span className='text-warning font-bold [text-shadow:0_1px_2px_var(--surface-0),_0_0_6px_var(--warning-muted)]'>B2B</span>
                  <span className='text-ink font-extrabold [text-shadow:0_1px_2px_var(--surface-0)]'>{totals.b2b}</span>
                </div>
              </div>
              {(team as TeamWeekWithScore).metrics && (
                <div
                  style={{
                    marginTop: isTablet ? '6px' : '4px',
                    paddingTop: isTablet ? '6px' : '4px'
                  }}
                  className='[border-top:1px_solid_var(--line)] w-[100%] flex flex-col items-center'>
                  <div
                    style={{
                      fontSize: isTablet ? '8px' : '7px'
                    }}
                    className='text-accent mb-[2px] uppercase font-semibold'>
                    Schedule Strength
                  </div>
                  <div
                    style={{
                      fontSize: isTablet ? '14px' : '11px'
                    }}
                    className='font-extrabold text-ink [text-shadow:0_1px_2px_var(--surface-0)]'>
                    {(team as TeamWeekWithScore).metrics.scheduleScore.toFixed(1)}
                  </div>
                  {/* Progress bar */}
                  <div className='w-[100%] h-[3px] bg-line rounded-[2px] overflow-hidden mt-[2px]'>
                    <div
                      style={{
                        width: `${(team as TeamWeekWithScore).metrics.scheduleScore}%`
                      }}
                      className='h-[100%] [background:linear-gradient(90deg,_var(--accent),_var(--accent))] [box-shadow:0_0_8px_var(--accent-muted)]' />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const containerStyle = {
    width: '100%',
    background: 'linear-gradient(135deg, var(--line), var(--line))',
    borderRadius: '20px',
    border: '2px solid var(--accent-muted)',
    overflow: 'hidden',
    backdropFilter: 'blur(20px) saturate(130%)',
    WebkitBackdropFilter: 'blur(20px) saturate(130%)',
    boxShadow: '0 0 30px var(--accent-muted), 0 15px 40px var(--surface-0), inset 0 1px 0 var(--line)'
  };

  const tableStyle = {
    width: '100%',
    color: 'var(--ink)',
    borderCollapse: 'collapse' as const
  };

  const headerStyle = {
    background: 'linear-gradient(180deg, var(--surface-0), var(--surface-0))',
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    boxShadow: '0 6px 20px var(--accent-muted), 0 3px 12px var(--surface-0), inset 0 1px 0 var(--line)',
    color: 'var(--accent)',
    fontWeight: '800',
    padding: '18px 12px',
    textAlign: 'center' as const,
    fontSize: '14px',
    fontFamily: 'Rajdhani, sans-serif',
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    borderBottom: '4px solid var(--accent)',
    borderTop: '1px solid var(--accent-muted)',
    position: 'relative' as const,
    textShadow: '0 0 12px var(--accent), 0 2px 4px var(--surface-0)',
    minHeight: '70px',
    verticalAlign: 'middle' as const
  };

  const cellStyle = {
    padding: '18px 14px',
    color: 'var(--ink)',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
    height: '70px',
    verticalAlign: 'middle' as const,
    border: 'none',
    borderRight: '2px solid var(--line)'
  };

  return (
    <TooltipProvider>
      <div
        className='weekly-schedule-container w-[100%] overflow-x-auto [overflow-y:visible] min-h-[800px] p-[20px] [background:linear-gradient(135deg,_transparent,_var(--surface-glass)_50%,_transparent)] rounded-[8px]'>
        {/* Show mobile view for mobile and tablet (under 1024px) */}
        <div className="mobile-schedule-grid">
          <MobileScheduleView />
        </div>

        {/* Show desktop table view only for large screens (1024px+) */}
        {isDesktop && (
          <div className="desktop-schedule-table">
            <div style={containerStyle}>
            <table style={tableStyle}>
          <thead>
            <tr>
              <th
                style={{
                  ...headerStyle
                }}
                className='text-center w-[80px] [border-top-left-radius:16px]'>Team</th>
              {data.days.map((d) => (
                <TooltipLabel
                  label={onDayClick ? `Click to filter teams playing on ${d.id}` : undefined}><th
                  key={d.id}
                  onClick={() => onDayClick?.(d.id)}
                  onMouseEnter={(e) => {
                    if (onDayClick && selectedDay !== d.id) {
                      e.currentTarget.style.backgroundColor = 'var(--accent-muted)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onDayClick && selectedDay !== d.id) {
                      e.currentTarget.style.backgroundColor = headerStyle.background as string;
                    }
                  }}
                  style={{
                    ...headerStyle,
                    cursor: onDayClick ? 'pointer' : 'default',
                    backgroundColor: selectedDay === d.id ? 'var(--accent-muted)' : headerStyle.background
                  }}
                  className='w-[120px] relative [transition:background-color_0.2s]'>
                    {d.id}<br/>
                    <small className='opacity-[0.7] tracking-[.04em]'>{d.date}</small>
                    {/* Horizontal container for game count and conflict indicators */}
                    <div className='flex items-center justify-center gap-[8px] mt-[4px]'>
                      {/* Game count */}
                      {gamesPerDay?.[d.id] !== undefined && (
                        <div className='text-[10px] text-accent font-semibold'>
                          ({gamesPerDay[d.id]} games)
                        </div>
                      )}

                      {/* Conflict Overlay - Desktop */}
                      {overlaySettings?.showConflictOverlay && dayConflicts?.[d.id] && (
                        <div
                          style={{
                            border: `1px solid ${dayConflicts[d.id].color}`
                          }}
                          className='flex items-center gap-[4px] bg-surface-0 [padding:2px_6px] rounded-[8px] text-[9px] whitespace-nowrap'>
                          <div
                            style={{
                              background: dayConflicts[d.id].color,
                              boxShadow: `0 0 6px ${dayConflicts[d.id].color}`
                            }}
                            className='w-[6px] h-[6px] rounded-full' />
                          <span className='text-ink font-bold'>
                            {dayConflicts[d.id].rosteredPlayersPlaying}/{dayConflicts[d.id].activeSlots}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Off-night indicator for desktop */}
                    {overlaySettings?.showOffNightIndicators && offNightDays?.[d.id] && (
                      <TooltipLabel label="Off-night (≤8 league games)">
                        <div
                          className='absolute top-[8px] right-[8px] w-[10px] h-[10px] bg-positive rounded-full [box-shadow:0_0_8px_var(--positive)] [border:1px_solid_var(--positive-muted)]'
                        />
                      </TooltipLabel>
                    )}
                  </th></TooltipLabel>
              ))}
              <th
                style={{
                  ...headerStyle
                }}
                className='w-[140px] [border-top-right-radius:16px]'>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team, teamIndex) => {
              const b2bSet = computeB2B(team);
              const totals = computeTotals(team, b2bSet);
              const isLastRow = teamIndex === data.teams.length - 1;
              const isUserTeam = overlaySettings?.highlightUserTeams && userTeamCodes?.has(team.team);
              const playerCount = playerCountsByTeam?.[team.team] || 0;

              return (
                <tr
                  key={team.team}
                  style={{
                    background: isUserTeam
                      ? 'var(--accent-muted)'
                      : (teamIndex % 2 === 1 ? 'var(--surface-2)' : 'var(--surface-1)'),

                    borderLeft: isUserTeam ? '4px solid var(--accent)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--positive-muted)';
                    e.currentTarget.style.boxShadow = '0 0 16px var(--positive-muted)';
                    e.currentTarget.style.borderLeft = '3px solid var(--positive)';
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    const bg = isUserTeam
                      ? 'var(--accent-muted)'
                      : (teamIndex % 2 === 1 ? 'var(--surface-2)' : 'var(--surface-1)');
                    e.currentTarget.style.background = bg;
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderLeft = isUserTeam ? '4px solid var(--accent)' : 'none';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.border = 'none';
                    if (isUserTeam) {
                      e.currentTarget.style.borderLeft = '4px solid var(--accent)';
                    }
                  }}
                  className='[transition:all_0.2s_ease] rounded-[0] [border:none] mb-[0] [box-shadow:none] h-[70px]'>
                  <td
                    style={{
                      ...cellStyle,
                      borderBottomLeftRadius: isLastRow ? '16px' : '0'
                    }}
                    className='text-center [background:linear-gradient(135deg,_var(--surface-0),_var(--surface-0))] [backdrop-filter:blur(10px)_saturate(120%)]'>
                    <div className='flex items-center justify-center w-[100%] h-[100%]'>
                      <div className='w-[50px] h-[50px] flex items-center justify-center relative'>
                        <TooltipLabel label={team.teamName}><img
                            src={team.logo}
                            alt={team.teamName}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            className='w-[72px] h-[72px] [object-fit:contain] [filter:drop-shadow(0_0_8px_var(--surface-0))_drop-shadow(0_0_4px_var(--accent-muted))] [transition:all_0.2s_ease]' /></TooltipLabel>

                        {/* Player count badge for desktop */}
                        {overlaySettings?.showPlayerCounts && playerCount > 0 && (
                          <div className='absolute bottom-[-2px] right-[-8px] [background:linear-gradient(135deg,_var(--accent),_var(--accent))] text-accent-ink text-[9px] font-extrabold [padding:2px_5px] rounded-[8px] [border:1px_solid_var(--surface-0)] [box-shadow:0_2px_4px_var(--surface-0)] whitespace-nowrap'>
                            {playerCount}P
                          </div>
                        )}

                        {/* Streaming Value Badge - Desktop */}
                        {overlaySettings?.showStreamingValue && streamingValues?.[team.team] && streamingValues[team.team].extraUsableStarts > 0 && (
                          <TooltipLabel
                            label={buildStreamingTooltip(
                              streamingValues[team.team].extraUsableStarts,
                              streamingValues[team.team].gapDatesCovered
                            )}><div
                              className='absolute top-[-2px] left-[-8px] [background:linear-gradient(135deg,_var(--warning),_var(--warning))] text-accent-ink text-[9px] font-extrabold [padding:2px_5px] rounded-[8px] [border:1px_solid_var(--surface-0)] [box-shadow:0_2px_4px_var(--warning-muted)] whitespace-nowrap z-[10]'>+{streamingValues[team.team].extraUsableStarts}
                            </div></TooltipLabel>
                        )}
                      </div>
                    </div>
                  </td>
                  {data.days.map((d, dayIndex) => {
                    const games = team.gamesByDay[d.id] ?? [];
                    // compute off-night on demand if needed
                    
                    return (
                      <td
                        key={d.id}
                        style={{
                          ...cellStyle
                        }}
                        className='text-center [background:transparent]'>
                        <div className='flex flex-col items-center justify-center w-[100%] h-[100%] gap-[4px]'>
                          {games.length === 0 ? (
                            <div className='text-accent opacity-[0.5] text-[16px]'>—</div>
                          ) : games.map((g, idx) => {
                          const gameTime = new Date(g.start);
                          const formattedTime = format(gameTime, 'h:mm a');
                          const opponentTeam = data.teams.find(t => t.team === g.opponent);
                          const opponentName = opponentTeam?.teamName || g.opponent;
                          const tooltipContent = g.home 
                            ? `${team.teamName} vs ${opponentName} • ${formattedTime}`
                            : `${team.teamName} @ ${opponentName} • ${formattedTime}`;
                          
                          return (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <div onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--surface-0)';
                                  e.currentTarget.style.borderColor = 'var(--accent)';
                                  e.currentTarget.style.boxShadow = '0 0 20px var(--accent), 0 6px 16px var(--surface-0)';
                                  e.currentTarget.style.color = 'var(--ink)';
                                  e.currentTarget.style.fontWeight = '800';
                                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
                                }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'var(--accent-muted)';
                                      e.currentTarget.style.borderColor = 'var(--accent)';
                                      e.currentTarget.style.boxShadow = '0 3px 12px var(--surface-0), 0 0 8px var(--accent-muted)';
                                      e.currentTarget.style.color = 'var(--ink)';
                                      e.currentTarget.style.fontWeight = '700';
                                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                    }}
                                    className='bg-accent-muted [border:2px_solid_var(--accent)] text-ink [padding:6px_8px] rounded-[10px] text-[12px] m-[0] flex items-center gap-[8px] justify-center min-w-[100px] max-w-[100px] [transition:none] font-bold [backdrop-filter:blur(8px)_saturate(120%)] [box-shadow:0_3px_12px_var(--surface-0),_0_0_8px_var(--accent-muted)] [text-shadow:0_1px_2px_var(--surface-0)] relative z-[1] cursor-pointer'>
                                      <span className='text-[10px] [flex-shrink:0] w-[14px]'>{g.home ? 'vs' : '@'}</span>
                                      <img
                                        src={g.opponentLogo}
                                        alt={g.opponent}
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                        className='max-w-[34px] max-h-[32px] [object-fit:contain] [flex-shrink:0]'
                                      />
                                    </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{tooltipContent}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        </div>
                      </td>
                    );
                  })}
                  <td
                    style={{
                      ...cellStyle,
                      borderBottomRightRadius: isLastRow ? '16px' : '0'
                    }}
                    className='text-center [background:linear-gradient(135deg,_var(--surface-0),_var(--surface-0))] [backdrop-filter:blur(10px)_saturate(120%)] [border:2px_solid_var(--accent-muted)] [border-left:4px_solid_var(--accent-muted)] w-[160px] min-w-[160px] max-w-[160px] overflow-hidden relative z-[10] [box-shadow:0_6px_20px_var(--surface-0),_0_0_12px_var(--accent-muted),_inset_0_1px_0_var(--line)]'>
                        <div className='flex items-center gap-[12] justify-center'>
                          <div className='text-center'>
                            <div className='font-black text-[24px] leading-[1] text-accent [text-shadow:0_0_12px_var(--accent),_0_0_24px_var(--accent-muted)] [font-family:Rajdhani,_sans-serif]'>{totals.games}</div>
                            <div className='text-[11px] opacity-[0.9] text-ink font-medium uppercase tracking-[0.1em]'>games</div>
                          </div>
                          <div className='grid gap-[6] w-[120]'>
                            <div className='grid [grid-template-columns:auto_1fr_auto] items-center gap-[6]'>
                              <span className='text-[10px] text-accent font-semibold [text-shadow:0_0_4px_var(--accent-muted)]'>OFF</span>
                              <div className='relative h-[6px] w-[100%] bg-line rounded-[999px] overflow-hidden'>
                                <div
                                  style={{
                                    width: `${Math.min(100, totals.games ? (totals.offNights / totals.games) * 100 : 0)}%`
                                  }}
                                  className='absolute [inset:0] [background:linear-gradient(90deg,_var(--accent),_var(--accent))] [box-shadow:0_0_8px_var(--accent-muted)]' />
                              </div>
                              <span className='text-[10px] opacity-[1] text-ink font-semibold'>{totals.offNights}</span>
                            </div>
                            <div className='grid [grid-template-columns:auto_1fr_auto] items-center gap-[6]'>
                              <span className='text-[10px] text-warning font-semibold [text-shadow:0_0_4px_var(--warning-muted)]'>B2B</span>
                              <div className='relative h-[6px] w-[100%] bg-line rounded-[999px] overflow-hidden'>
                                <div
                                  style={{
                                    width: `${Math.min(100, totals.games ? (totals.b2b / totals.games) * 100 : 0)}%`
                                  }}
                                  className='absolute [inset:0] [background:linear-gradient(90deg,_var(--warning),_var(--warning))] [box-shadow:0_0_8px_var(--warning-muted)]' />
                              </div>
                              <span className='text-[10px] opacity-[1] text-ink font-semibold'>{totals.b2b}</span>
                            </div>
                          </div>
                        </div>
                        {(team as TeamWeekWithScore).metrics && (
                            <div className='mt-[8px] pt-[8px] [border-top:1px_solid_var(--line)] w-[100%] flex flex-col items-center'>
                              <div className='text-[10px] text-accent mb-[4px] uppercase font-semibold'>
                                Schedule Strength
                              </div>
                              <div className='text-[16px] font-extrabold text-ink [text-shadow:0_1px_2px_var(--surface-0)]'>
                                {(team as TeamWeekWithScore).metrics.scheduleScore.toFixed(1)}
                              </div>
                              {/* Progress bar */}
                              <div className='w-[100%] h-[4px] bg-line rounded-[2px] overflow-hidden mt-[4px]'>
                                <div
                                  style={{
                                    width: `${(team as TeamWeekWithScore).metrics.scheduleScore}%`
                                  }}
                                  className='h-[100%] [background:linear-gradient(90deg,_var(--accent),_var(--accent))] [box-shadow:0_0_8px_var(--accent-muted)]' />
                              </div>
                            </div>
                          )}
                      </td>
                </tr>
              );
            })}
          </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
