/**
 * Player Schedule Heat Map
 *
 * Shows a heat map of schedule ratings for each roster player across multiple weeks.
 * Colored cells indicate schedule difficulty: green = easy, yellow = medium, red = tough.
 */

import { useState, useEffect } from 'react';
import type { PlayerWeekRating, RosterPlayerInput } from '../../lib/playerScheduleRatings';
import { getPlayerScheduleRatings, getScheduleColor, getTextColor } from '../../lib/playerScheduleRatings';
import { fetchWeeklyScheduleData } from '../../lib/schedule';
import type { RosterPlayer } from '../../lib/coachSchemas';

interface PlayerScheduleHeatMapProps {
  rosterPlayers: RosterPlayer[];
  weekRange: number;
  startWeek: string;
  onSwitchToLines: () => void;
}

export function PlayerScheduleHeatMap({
  rosterPlayers,
  weekRange,
  startWeek,
  onSwitchToLines
}: PlayerScheduleHeatMapProps) {
  const [ratings, setRatings] = useState<PlayerWeekRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load schedule ratings
  useEffect(() => {
    const loadRatings = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPlayerScheduleRatings(
          rosterPlayers,
          startWeek,
          weekRange,
          fetchWeeklyScheduleData
        );
        setRatings(data);
      } catch (err) {
        console.error('Failed to load player schedule ratings:', err);
        setError('Failed to load schedule data');
      } finally {
        setLoading(false);
      }
    };

    if (rosterPlayers.length > 0) {
      loadRatings();
    }
  }, [rosterPlayers, startWeek, weekRange]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        color: '#9FE8FF'
      }}>
        Loading schedule data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        color: '#ef4444'
      }}>
        {error}
      </div>
    );
  }

  if (rosterPlayers.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        color: '#9FE8FF'
      }}>
        No players in roster
      </div>
    );
  }

  // Group ratings by player
  const ratingsByPlayer = new Map<string, PlayerWeekRating[]>();
  ratings.forEach(rating => {
    if (!ratingsByPlayer.has(rating.playerId)) {
      ratingsByPlayer.set(rating.playerId, []);
    }
    ratingsByPlayer.get(rating.playerId)!.push(rating);
  });

  // Get unique weeks (sorted)
  const weeks = Array.from(new Set(ratings.map(r => r.week))).sort();
  const weekLabels = ratings
    .filter(r => r.week === weeks[0])
    .slice(0, weeks.length)
    .map((_, i) => ratings.find(r => r.week === weeks[i])?.weekLabel || `Week ${i + 1}`);

  // Detect mobile/tablet
  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

  // Detect full season and adjust cell width
  const isFullSeason = weekRange >= 35;
  const cellWidth = isFullSeason
    ? (isMobile ? '40px' : '50px')   // Narrower for full season
    : (isMobile ? '60px' : '80px');  // Standard width

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1A1E2E 0%, #0F1419 100%)',
      borderRadius: '12px',
      padding: isMobile ? '12px' : '20px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      overflowX: 'auto'
    }}>
      {/* Header with legend and toggle button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: isMobile ? '11px' : '13px',
          color: '#9FE8FF'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#22c55e',
              borderRadius: '4px'
            }} />
            <span>Easy (75+)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#eab308',
              borderRadius: '4px'
            }} />
            <span>Medium (50-75)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#ef4444',
              borderRadius: '4px'
            }} />
            <span>Tough (&lt;50)</span>
          </div>
        </div>

        <button
          onClick={onSwitchToLines}
          style={{
            padding: isMobile ? '6px 12px' : '8px 16px',
            background: 'linear-gradient(135deg, #5EF5FF, #2FD3C9)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '12px' : '14px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Switch to Line Chart
        </button>
      </div>

      {/* Full Season Scroll Hint */}
      {isFullSeason && (
        <div style={{
          color: '#9FE8FF',
          fontSize: '12px',
          marginBottom: '8px',
          fontStyle: 'italic'
        }}>
          Showing full season ({weekRange} weeks). Scroll horizontally to view all weeks.
        </div>
      )}

      {/* Heat Map Table */}
      <div style={{
        overflowX: 'auto',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: isFullSeason
            ? `${(weekRange * 50) + 200}px`  // Dynamic min-width for full season
            : (isMobile ? '600px' : 'auto')
        }}>
          {/* Header Row */}
          <thead>
            <tr style={{
              background: 'rgba(94, 245, 255, 0.15)',
              borderBottom: '2px solid rgba(94, 245, 255, 0.3)'
            }}>
              <th style={{
                position: 'sticky',
                left: 0,
                background: 'rgba(26, 30, 46, 0.95)',
                padding: isMobile ? '8px' : '12px',
                textAlign: 'left',
                color: '#9FE8FF',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: '800',
                borderRight: '1px solid rgba(255, 255, 255, 0.2)',
                zIndex: 10
              }}>
                Player
              </th>
              {weekLabels.map((label, index) => (
                <th key={index} style={{
                  padding: isMobile ? '8px 4px' : '12px 8px',
                  textAlign: 'center',
                  color: '#9FE8FF',
                  fontSize: isMobile ? '11px' : '13px',
                  fontWeight: '700',
                  minWidth: cellWidth
                }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody>
            {rosterPlayers.map((player, playerIndex) => {
              const playerRatings = ratingsByPlayer.get(player.id) || [];
              const isEvenRow = playerIndex % 2 === 0;

              return (
                <tr key={player.id} style={{
                  background: isEvenRow
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(255, 255, 255, 0.06)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {/* Player Name Cell (Sticky) */}
                  <td style={{
                    position: 'sticky',
                    left: 0,
                    background: isEvenRow
                      ? 'rgba(26, 30, 46, 0.95)'
                      : 'rgba(31, 35, 49, 0.95)',
                    padding: isMobile ? '8px' : '12px',
                    borderRight: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    fontSize: isMobile ? '12px' : '14px',
                    fontWeight: '600',
                    zIndex: 5
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{player.full_name}</span>
                      <span style={{
                        fontSize: isMobile ? '10px' : '11px',
                        color: '#9FE8FF',
                        fontWeight: '500'
                      }}>
                        {player.team} - {player.positions?.[0] || ''}
                      </span>
                    </div>
                  </td>

                  {/* Schedule Score Cells */}
                  {weeks.map((week, weekIndex) => {
                    const rating = playerRatings.find(r => r.week === week);
                    const score = rating?.scheduleScore || 0;
                    const bgColor = getScheduleColor(score);
                    const textColor = getTextColor(score);

                    return (
                      <td
                        key={week}
                        title={rating ? `${rating.games} games, ${rating.offNightGames} off-nights (${rating.offNightPercentage.toFixed(0)}%)` : 'No data'}
                        style={{
                          padding: isMobile ? '8px 4px' : '12px 8px',
                          textAlign: 'center',
                          backgroundColor: bgColor,
                          color: textColor,
                          fontSize: isMobile ? '12px' : '14px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        {score.toFixed(0)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
