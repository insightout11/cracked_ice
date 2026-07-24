import { TooltipLabel } from '../ui/tooltip';
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
}

export function PlayerScheduleHeatMap({
  rosterPlayers,
  weekRange,
  startWeek
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
      <div className='flex justify-center items-center p-[40px] text-accent'>Loading schedule data...
              </div>
    );
  }

  if (error) {
    return (
      <div className='flex justify-center items-center p-[40px] text-negative'>
        {error}
      </div>
    );
  }

  if (rosterPlayers.length === 0) {
    return (
      <div className='flex justify-center items-center p-[40px] text-accent'>No players in roster
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

  // Detect extended (full-season) view and adjust cell width for the wider grid.
  const isExtendedView = weekRange >= 20;
  const cellWidth = isExtendedView
    ? (isMobile ? '40px' : '50px')   // Narrower for extended view
    : (isMobile ? '60px' : '80px');  // Standard width

  return (
    <div
      style={{
        padding: isMobile ? '12px' : '20px'
      }}
      className='[background:linear-gradient(135deg,_var(--surface-1)_0%,_var(--surface-0)_100%)] rounded-[12px] [box-shadow:0_4px_6px_var(--surface-0)] overflow-x-auto'>
      {/* Header with legend */}
      <div className='flex justify-start items-center mb-[16px] [flex-wrap:wrap] gap-[12px]'>
        <div
          style={{
            fontSize: isMobile ? '11px' : '13px'
          }}
          className='flex items-center gap-[16px] text-accent'>
          <div className='flex items-center gap-[6px]'>
            <div className='w-[16px] h-[16px] bg-positive rounded-[4px]' />
            <span>Good (75+)</span>
          </div>
          <div className='flex items-center gap-[6px]'>
            <div className='w-[16px] h-[16px] bg-warning rounded-[4px]' />
            <span>Average (50-75)</span>
          </div>
          <div className='flex items-center gap-[6px]'>
            <div className='w-[16px] h-[16px] bg-negative rounded-[4px]' />
            <span>Bad (&lt;50)</span>
          </div>
        </div>
      </div>
      {/* Full Season Scroll Hint */}
      {isExtendedView && (
        <div className='text-accent text-[12px] mb-[8px] italic'>
          Showing full season ({weekRange} weeks). Scroll horizontally to view all weeks.
        </div>
      )}
      {/* Heat Map Table */}
      <div className='overflow-x-auto rounded-[8px] [border:1px_solid_var(--line)]'>
        <table
          style={{
            minWidth: isExtendedView
              ? `${(weekRange * 50) + 200}px`  // Dynamic min-width for full season
              : (isMobile ? '600px' : 'auto')
          }}
          className='w-[100%] [border-collapse:collapse]'>
          {/* Header Row */}
          <thead>
            <tr className='bg-accent-muted [border-bottom:2px_solid_var(--accent-muted)]'>
              <th
                style={{
                  padding: isMobile ? '8px' : '12px',
                  fontSize: isMobile ? '12px' : '14px'
                }}
                className='sticky left-[0] bg-surface-0 text-left text-accent font-extrabold [border-right:1px_solid_var(--line)] z-[10]'>
                Player
              </th>
              {weekLabels.map((label, index) => (
                <th
                  key={index}
                  style={{
                    padding: isMobile ? '8px 4px' : '12px 8px',
                    fontSize: isMobile ? '11px' : '13px',
                    minWidth: cellWidth
                  }}
                  className='text-center text-accent font-bold'>
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
                <tr
                  key={player.id}
                  style={{
                    background: isEvenRow
                      ? 'var(--line)'
                      : 'var(--line)'
                  }}
                  className='[border-bottom:1px_solid_var(--line)]'>
                  {/* Player Name Cell (Sticky) */}
                  <td
                    style={{
                      background: isEvenRow
                        ? 'var(--surface-0)'
                        : 'var(--surface-0)',

                      padding: isMobile ? '8px' : '12px',
                      fontSize: isMobile ? '12px' : '14px'
                    }}
                    className='sticky left-[0] [border-right:1px_solid_var(--line)] text-ink font-semibold z-[5]'>
                    <div className='flex flex-col gap-[2px]'>
                      <span>{player.full_name}</span>
                      <span
                        style={{
                          fontSize: isMobile ? '10px' : '11px'
                        }}
                        className='text-accent font-medium'>
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
                      <TooltipLabel
                        label={rating ? `${rating.games} games, ${rating.offNightGames} off-nights (${rating.offNightPercentage.toFixed(0)}%)` : 'No data'}><td
                          key={week}
                          style={{
                            padding: isMobile ? '8px 4px' : '12px 8px',
                            backgroundColor: bgColor,
                            color: textColor,
                            fontSize: isMobile ? '12px' : '14px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          className='text-center font-bold cursor-pointer [transition:transform_0.2s]'>
                            {score.toFixed(0)}
                          </td></TooltipLabel>
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
