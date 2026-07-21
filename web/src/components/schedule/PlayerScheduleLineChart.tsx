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
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#a855f7', // Purple
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#0ea5e9', // Sky
  '#64748b', // Slate
  '#059669', // Green-600
  '#dc2626', // Red-600
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

  // Adjust chart height for the extended (full-season) view.
  const chartHeight = weekRange >= 20
    ? (isMobile ? 400 : 600)  // Taller for extended view
    : (isMobile ? 300 : isTablet ? 400 : 500);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(26, 30, 46, 0.95)',
          border: '1px solid rgba(94, 245, 255, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
          <p style={{
            color: '#9FE8FF',
            fontSize: '13px',
            fontWeight: '700',
            marginBottom: '8px'
          }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{
              color: entry.color,
              fontSize: '12px',
              margin: '4px 0'
            }}>
              {entry.name}: {entry.value.toFixed(0)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1A1E2E 0%, #0F1419 100%)',
      borderRadius: '12px',
      padding: isMobile ? '12px' : '20px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      {/* Header with toggle button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          color: '#9FE8FF',
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: '700'
        }}>
          Player Schedule Trends
        </div>

        <button
          onClick={onSwitchToHeatmap}
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis
            dataKey="week"
            stroke="#9FE8FF"
            style={{
              fontSize: isMobile ? '9px' : '12px',
              fontWeight: '600'
            }}
            angle={weekRange >= 20 ? -45 : 0}
            textAnchor={weekRange >= 20 ? 'end' : 'middle'}
            height={weekRange >= 20 ? 80 : 30}
          />
          <YAxis
            stroke="#9FE8FF"
            style={{
              fontSize: isMobile ? '10px' : '12px',
              fontWeight: '600'
            }}
            domain={[0, 100]}
            label={{
              value: 'Schedule Score',
              angle: -90,
              position: 'insideLeft',
              style: {
                fill: '#9FE8FF',
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: '700'
              }
            }}
          />
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
      <div style={{
        marginTop: '16px',
        display: 'flex',
        justifyContent: 'center',
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
    </div>
  );
}
