import { isOffNight, computeB2B, type DayId, type TeamWeek, type WeeklySchedule } from '../lib/schedule';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

function computeTotals(team: TeamWeek, b2bSet: Set<DayId>) {
  const days = Object.keys(team.gamesByDay) as DayId[];
  let games = 0, offNights = 0, b2b = 0;
  days.forEach(d => {
    const gs = team.gamesByDay[d]?.length ?? 0;
    games += gs;
    if (gs > 0 && isOffNight(d)) offNights += gs;
    if (gs > 0 && b2bSet.has(d)) b2b += 1;
  });
  return { games, offNights, b2b };
}

interface WeeklyScheduleGridProps {
  data: WeeklySchedule;
}

export function WeeklyScheduleGrid({ data }: WeeklyScheduleGridProps) {
  if (!data || !data.teams || data.teams.length === 0) {
    return (
      <div style={{ padding: '20px', color: 'white', textAlign: 'center', fontSize: '18px' }}>
        No schedule data available
      </div>
    );
  }

  const containerStyle = {
    width: '100%',
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.05))',
    borderRadius: '20px',
    border: '2px solid rgba(93, 227, 255, 0.3)',
    overflow: 'hidden',
    backdropFilter: 'blur(20px) saturate(130%)',
    WebkitBackdropFilter: 'blur(20px) saturate(130%)',
    boxShadow: '0 0 30px rgba(93, 227, 255, 0.2), 0 15px 40px rgba(11,20,32,.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
  };

  const tableStyle = {
    width: '100%',
    color: '#EAF7FF',
    borderCollapse: 'collapse' as const
  };

  const headerStyle = {
    background: 'linear-gradient(180deg, rgba(20, 30, 40, 0.95), rgba(20, 30, 40, 0.9))',
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    boxShadow: '0 6px 20px rgba(93, 227, 255, 0.4), 0 3px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    color: '#9FE8FF',
    fontWeight: '800',
    padding: '18px 12px',
    textAlign: 'center' as const,
    fontSize: '14px',
    fontFamily: 'Rajdhani, sans-serif',
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    borderBottom: '4px solid #9FE8FF',
    borderTop: '1px solid rgba(159, 232, 255, 0.3)',
    position: 'relative' as const,
    textShadow: '0 0 12px rgba(159, 232, 255, 0.8), 0 2px 4px rgba(0, 0, 0, 0.5)',
    minHeight: '70px',
    verticalAlign: 'middle' as const
  };

  const cellStyle = {
    padding: '18px 14px',
    color: '#EAF7FF',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
    height: '70px',
    verticalAlign: 'middle' as const,
    border: 'none',
    borderRight: '2px solid rgba(255, 255, 255, 0.35)'
  };

  return (
    <TooltipProvider>
      <div style={{ 
        width: '100%', 
        overflowX: 'auto', 
        minHeight: '800px', 
        padding: '20px',
        background: 'linear-gradient(135deg, transparent, var(--glass-fill) 50%, transparent)',
        borderRadius: '8px'
      }}>
          <div style={containerStyle}>
          <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...headerStyle, textAlign: 'center', width: '80px', borderTopLeftRadius: '16px' }}>Team</th>
              {data.days.map((d) => (
                <th key={d.id} style={{ ...headerStyle, width: '120px' }}>
                  {d.id}<br/>
                  <small style={{ opacity: 0.7, letterSpacing: '.04em' }}>{d.date}</small>
                </th>
              ))}
              <th style={{ ...headerStyle, width: '140px', borderTopRightRadius: '16px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team, teamIndex) => {
              const b2bSet = computeB2B(team);
              const totals = computeTotals(team, b2bSet);
              const isLastRow = teamIndex === data.teams.length - 1;
              
              return (
                <tr 
                  key={team.team}
                  style={{ 
                    background: teamIndex % 2 === 1 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)',
                    transition: 'all 0.2s ease',
                    borderRadius: '0',
                    border: 'none',
                    marginBottom: '0',
                    boxShadow: 'none',
                    height: '70px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(93, 227, 255, 0.15)';
                    e.currentTarget.style.boxShadow = '0 0 16px rgba(93, 227, 255, 0.2)';
                    e.currentTarget.style.borderLeft = '3px solid #9FE8FF';
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    const bg = teamIndex % 2 === 1 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.background = bg;
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderLeft = 'none';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.border = 'none';
                  }}
                >
                  <td style={{ 
                    ...cellStyle, 
                    textAlign: 'center', 
                    background: 'linear-gradient(135deg, rgba(20, 30, 40, 0.8), rgba(20, 30, 40, 0.7))',
                    borderBottomLeftRadius: isLastRow ? '16px' : '0',
                    backdropFilter: 'blur(10px) saturate(120%)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%'
                    }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img 
                          src={team.logo} 
                          alt={team.teamName}
                          title={team.teamName}
                          style={{ 
                            width: '44px', 
                            height: '44px', 
                            objectFit: 'contain', 
                            filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.4)) drop-shadow(0 0 4px rgba(159,232,255,0.3))',
                            transition: 'all 0.2s ease'
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  
                  {data.days.map((d, dayIndex) => {
                    const games = team.gamesByDay[d.id] ?? [];
                    // compute off-night on demand if needed
                    
                    return (
                      <td key={d.id} style={{ 
                        ...cellStyle, 
                        textAlign: 'center', 
                        background: 'transparent'
                      }}>
                        {games.length === 0 ? (
                          <div style={{ color: '#9FE8FF', opacity: 0.5, fontSize: '16px' }}>—</div>
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
                                <div style={{
                                      backgroundColor: 'rgba(159, 232, 255, 0.55)',
                                      border: '2px solid rgba(159, 232, 255, 0.8)',
                                      color: '#FFFFFF',
                                      padding: '8px 10px',
                                      borderRadius: '10px',
                                      fontSize: '12px',
                                      margin: '3px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      justifyContent: 'center',
                                      minWidth: '100px',
                                      maxWidth: '100px',
                                      transition: 'none',
                                      fontWeight: '700',
                                      backdropFilter: 'blur(8px) saturate(120%)',
                                      boxShadow: '0 3px 12px rgba(0, 0, 0, 0.3), 0 0 8px rgba(159, 232, 255, 0.2)',
                                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                      position: 'relative',
                                      zIndex: 1,
                                      cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = 'rgba(20, 30, 40, 0.9)';
                                      e.currentTarget.style.borderColor = '#9FE8FF';
                                      e.currentTarget.style.boxShadow = '0 0 20px rgba(93,227,255,0.8), 0 6px 16px rgba(0, 0, 0, 0.4)';
                                      e.currentTarget.style.color = '#FFFFFF';
                                      e.currentTarget.style.fontWeight = '800';
                                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'rgba(159, 232, 255, 0.55)';
                                      e.currentTarget.style.borderColor = 'rgba(159, 232, 255, 0.8)';
                                      e.currentTarget.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.3), 0 0 8px rgba(159, 232, 255, 0.2)';
                                      e.currentTarget.style.color = '#FFFFFF';
                                      e.currentTarget.style.fontWeight = '700';
                                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                    }}>
                                      <span style={{ fontSize: '10px', flexShrink: 0, width: '14px' }}>{g.home ? 'vs' : '@'}</span>
                                      <img 
                                        src={g.opponentLogo} 
                                        alt={g.opponent}
                                        style={{ maxWidth: '28px', maxHeight: '26px', objectFit: 'contain', flexShrink: 0 }}
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    </div>
                              </TooltipTrigger>
                              <TooltipContent 
                                style={{
                                  backgroundColor: 'rgba(20, 30, 40, 0.95)',
                                  border: '1px solid rgba(159, 232, 255, 0.3)',
                                  color: '#FFFFFF',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  backdropFilter: 'blur(10px)',
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
                                }}
                              >
                                <p style={{ margin: 0 }}>{tooltipContent}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </td>
                    );
                  })}
                  
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, rgba(20, 30, 40, 0.8), rgba(20, 30, 40, 0.7))',
                      backdropFilter: 'blur(10px) saturate(120%)',
                      border: '2px solid rgba(93, 227, 255, 0.4)',
                      borderLeft: '4px solid rgba(93, 227, 255, 0.6)',
                      borderBottomRightRadius: isLastRow ? '16px' : '0',
                      width: '160px',
                      minWidth: '160px',
                      maxWidth: '160px',
                      overflow: 'hidden',
                      position: 'relative',
                      zIndex: 10,
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35), 0 0 12px rgba(93, 227, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                  >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ 
                              fontWeight: 900, 
                              fontSize: '24px', 
                              lineHeight: 1, 
                              color: '#9FE8FF',
                              textShadow: '0 0 12px rgba(159, 232, 255, 0.8), 0 0 24px rgba(159, 232, 255, 0.4)',
                              fontFamily: 'Rajdhani, sans-serif'
                            }}>{totals.games}</div>
                            <div style={{ 
                              fontSize: '11px', 
                              opacity: .9, 
                              color: '#EAF7FF',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em'
                            }}>games</div>
                          </div>
                          <div style={{ display: 'grid', gap: 6, width: 120 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '10px', color: '#9FE8FF', fontWeight: '600', textShadow: '0 0 4px rgba(159, 232, 255, 0.5)' }}>OFF</span>
                              <div style={{ position: 'relative', height: '6px', width: '100%', background: 'rgba(255,255,255,.12)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: `${Math.min(100, totals.games ? (totals.offNights / totals.games) * 100 : 0)}%`,
                                    background: 'linear-gradient(90deg, #9FE8FF, #2FD3C9)',
                                    boxShadow: '0 0 8px rgba(159,232,255,.5)'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '10px', opacity: 1, color: '#EAF7FF', fontWeight: '600' }}>{totals.offNights}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '10px', color: '#FFC857', fontWeight: '600', textShadow: '0 0 4px rgba(255, 200, 87, 0.5)' }}>B2B</span>
                              <div style={{ position: 'relative', height: '6px', width: '100%', background: 'rgba(255,255,255,.12)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: `${Math.min(100, totals.games ? (totals.b2b / totals.games) * 100 : 0)}%`,
                                    background: 'linear-gradient(90deg, #FFC857, #FFD27E)',
                                    boxShadow: '0 0 8px rgba(255,200,87,.45)'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '10px', opacity: 1, color: '#EAF7FF', fontWeight: '600' }}>{totals.b2b}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}