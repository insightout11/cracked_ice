/**
 * Player Schedule Line Chart
 *
 * Shows line chart visualization of schedule ratings for each roster player across multiple weeks.
 * Each player gets their own colored line showing schedule difficulty trends.
 */

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { PlayerWeekRating, RosterPlayerInput } from '../../lib/playerScheduleRatings';
import { getPlayerScheduleRatings } from '../../lib/playerScheduleRatings';
import { fetchWeeklyScheduleData } from '../../lib/schedule';
import type { RosterPlayer } from '../../lib/coachSchemas';

interface PlayerScheduleLineChartProps {
  rosterPlayers: RosterPlayer[];
  weekRange: number;
  startWeek: string;
  onSwitchToHeatmap: () => void;
}

// Color palette for player lines (up to 20 distinct colors)
const PLAYER_COLORS = [
  'var(--positive)', // Green
  'var(--accent)', // Blue
  'var(--warning)', // Amber
  'var(--negative)', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  'var(--accent)', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#a855f7', // Purple
  '#14b8a6', // Teal
  'var(--warning)', // Yellow
  '#6366f1', // Indigo
  'var(--positive)', // Emerald
  'var(--negative)', // Rose
  'var(--accent)', // Sky
  'var(--ink-mute)', // Slate
  'var(--positive)', // Green-600
  'var(--negative)', // Red-600
  '#7c3aed', // Violet-600
];

export function PlayerScheduleLineChart({
  rosterPlayers,
  weekRange,
  startWeek,
  onSwitchToHeatmap
}: PlayerScheduleLineChartProps) {
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

  // Transform data for Recharts
  // Format: [{ week: 'Week 15', 'Player1': 78, 'Player2': 65, ... }, ...]
  const weeks = Array.from(new Set(ratings.map(r => r.weekLabel))).sort((a, b) => {
    const weekA = parseInt(a.replace('Week ', ''));
    const weekB = parseInt(b.replace('Week ', ''));
    return weekA - weekB;
  });

  const chartData = weeks.map(weekLabel => {
    const dataPoint: any = { week: weekLabel };
    rosterPlayers.forEach(player => {
      const rating = ratings.find(r => r.playerId === player.id && r.weekLabel === weekLabel);
      // Use player name as key (shorten if too long)
      const playerName = player.full_name || '';
      const displayName = playerName.length > 15 ? playerName.substring(0, 15) + '...' : playerName;
      dataPoint[displayName] = rating ? rating.scheduleScore : 0;
    });
    return dataPoint;
  });

  // Detect mobile/tablet
  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

  // Adjust chart height for extended season view (26 weeks = season end on April 20)
  const chartHeight = weekRange >= 20
    ? (isMobile ? 400 : 600)  // Taller for extended view
    : (isMobile ? 300 : isTablet ? 400 : 500);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className='bg-surface-0 [border:1px_solid_var(--accent-muted)] rounded-[8px] p-[12px] [box-shadow:0_4px_6px_var(--surface-0)]'>
          <p className='text-accent text-[13px] font-bold mb-[8px]'>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              style={{
                color: entry.color
              }}
              className='text-[12px] [margin:4px_0]'>
              {entry.name}: {entry.value.toFixed(0)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        padding: isMobile ? '12px' : '20px'
      }}
      className='[background:linear-gradient(135deg,_var(--surface-1)_0%,_var(--surface-0)_100%)] rounded-[12px] [box-shadow:0_4px_6px_var(--surface-0)]'>
      {/* Header with toggle button */}
      <div className='flex justify-between items-center mb-[16px] [flex-wrap:wrap] gap-[12px]'>
        <div
          style={{
            fontSize: isMobile ? '14px' : '16px'
          }}
          className='text-accent font-bold'>
          Player Schedule Trends
        </div>

        <button
          onClick={onSwitchToHeatmap}
          style={{
            padding: isMobile ? '6px 12px' : '8px 16px',
            fontSize: isMobile ? '12px' : '14px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          className='[background:linear-gradient(135deg,_var(--accent),_var(--accent))] [color:#000] [border:none] rounded-[8px] font-bold cursor-pointer [box-shadow:0_2px_4px_var(--surface-0)] [transition:transform_0.2s]'>
          Switch to Heat Map
        </button>
      </div>
      {/* Line Chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: isMobile ? 10 : 30,
            left: isMobile ? -20 : 0,
            bottom: 5
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="week"
            stroke="var(--accent)"
            style={{
              fontSize: isMobile ? '9px' : '12px'
            }}
            angle={weekRange >= 20 ? -45 : 0}
            textAnchor={weekRange >= 20 ? 'end' : 'middle'}
            height={weekRange >= 20 ? 80 : 30}
            className='font-semibold' />
          <YAxis
            stroke="var(--accent)"
            style={{
              fontSize: isMobile ? '10px' : '12px'
            }}
            domain={[0, 100]}
            label={{
              value: 'Schedule Score',
              angle: -90,
              position: 'insideLeft',
              style: {
                fill: 'var(--accent)',
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: '700'
              }
            }}
            className='font-semibold' />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              fontSize: isMobile ? '10px' : '12px',
              fontWeight: '600',
              paddingTop: '20px'
            }}
            iconType="line"
          />

          {/* Draw a line for each player */}
          {rosterPlayers.map((player, index) => {
            const playerName = player.full_name || '';
            const displayName = playerName.length > 15 ? playerName.substring(0, 15) + '...' : playerName;
            const color = PLAYER_COLORS[index % PLAYER_COLORS.length];

            return (
              <Line
                key={player.id}
                type="monotone"
                dataKey={displayName}
                stroke={color}
                strokeWidth={isMobile ? 1.5 : 2}
                dot={{ r: isMobile ? 2 : 3 }}
                activeDot={{ r: isMobile ? 4 : 6 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      {/* Score Reference */}
      <div
        style={{
          fontSize: isMobile ? '11px' : '13px'
        }}
        className='mt-[16px] flex justify-center gap-[16px] text-accent'>
        <div className='flex items-center gap-[6px]'>
          <div className='w-[16px] h-[16px] bg-positive rounded-[4px]' />
          <span>Easy (75+)</span>
        </div>
        <div className='flex items-center gap-[6px]'>
          <div className='w-[16px] h-[16px] bg-warning rounded-[4px]' />
          <span>Medium (50-75)</span>
        </div>
        <div className='flex items-center gap-[6px]'>
          <div className='w-[16px] h-[16px] bg-negative rounded-[4px]' />
          <span>Tough (&lt;50)</span>
        </div>
      </div>
    </div>
  );
}
