import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GameLogEntry, LeagueProfile } from '../../lib/coachSchemas';

interface PlayerFormChartProps {
  games: GameLogEntry[];
  leagueProfile: LeagueProfile;
  isGoalie: boolean;
}

const tooltipStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--line-strong)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--ink)',
} as const;

const legendStyle = { color: 'var(--ink-dim)', fontSize: 12 } as const;
const chartMargin = { top: 8, right: 8, left: 0, bottom: 0 } as const;
const axisTick = { fill: 'var(--ink-mute)', fontSize: 11 } as const;
const fantasyDot = { fill: 'var(--surface-0)', stroke: 'var(--accent)', strokeWidth: 2, r: 3 } as const;
const fantasyActiveDot = { r: 5 } as const;

function weight(profile: LeagueProfile, key: string, alias?: string): number {
  const weights = { ...(profile.scoring_weights ?? {}), ...(profile.skater_scoring ?? {}), ...(profile.goalie_scoring ?? {}) } as Record<string, number | undefined>;
  return weights[key] ?? (alias ? weights[alias] : undefined) ?? 0;
}

function fantasyPoints(game: GameLogEntry, profile: LeagueProfile, isGoalie: boolean): number {
  if (isGoalie) {
    return (game.decision === 'W' ? weight(profile, 'wins') : 0)
      + (game.decision === 'L' ? weight(profile, 'losses') : 0)
      + (game.decision === 'O' ? weight(profile, 'overtime_losses', 'otl') : 0)
      + ((game.saves ?? 0) * weight(profile, 'saves'))
      + ((game.goalsAgainst ?? 0) * weight(profile, 'goals_against'))
      + ((game.gamesStarted ?? 0) * weight(profile, 'games_started'))
      + (game.shutout ? weight(profile, 'shutouts') : 0);
  }
  return (game.goals * weight(profile, 'goals'))
    + (game.assists * weight(profile, 'assists'))
    + (game.shots * weight(profile, 'shots_on_goal'))
    + ((game.hits ?? 0) * weight(profile, 'hits'))
    + ((game.blocks ?? 0) * weight(profile, 'blocks'))
    + (game.powerPlayPoints * weight(profile, 'powerplay_points', 'power_play_points'))
    + ((game.pim ?? 0) * weight(profile, 'penalty_minutes'))
    + ((game.plusMinus ?? 0) * weight(profile, 'plus_minus'));
}

export function PlayerFormChart({ games, leagueProfile, isGoalie }: PlayerFormChartProps) {
  const data = useMemo(() => {
    const chronological = [...games]
      .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
      .slice(-15);
    return chronological.map((game, index) => {
      const start = Math.max(0, index - 4);
      const window = chronological.slice(start, index + 1);
      const rolling = window.reduce((sum, item) => sum + fantasyPoints(item, leagueProfile, isGoalie), 0) / window.length;
      return {
        date: new Date(game.gameDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        fppg: Number(rolling.toFixed(2)),
        toi: game.toiSeconds ? Number((game.toiSeconds / 60).toFixed(1)) : undefined,
      };
    });
  }, [games, isGoalie, leagueProfile]);

  if (data.length < 2) {
    return <div className="rounded-xl border border-line bg-surface-0 p-5 text-sm text-ink-dim">A rolling form chart will appear after at least two game-log entries are available.</div>;
  }

  const hasToi = data.some((point) => point.toi !== undefined);
  return (
    <figure className="rounded-xl border border-line bg-surface-0 p-5">
      <div className="mb-4">
        <p className="scoreboard-text text-accent">Recent games</p>
        <h3 className="mt-1 text-lg font-semibold text-ink">Five-game fantasy form{hasToi ? ' and ice time' : ''}</h3>
        <p className="mt-1 text-xs text-ink-mute">Fantasy points use the active league scoring profile; each point is a rolling five-game average.</p>
      </div>
      <div className="h-64 min-h-64 min-w-0 w-full" aria-label="Rolling fantasy production chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--ink-mute)" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis yAxisId="fantasy" stroke="var(--ink-mute)" tick={axisTick} tickLine={false} axisLine={false} width={32} />
            {hasToi && <YAxis yAxisId="toi" orientation="right" stroke="var(--ink-mute)" tick={axisTick} tickLine={false} axisLine={false} width={32} />}
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={legendStyle} />
            <Line yAxisId="fantasy" type="monotone" dataKey="fppg" name="Rolling FPPG" stroke="var(--accent)" strokeWidth={3} dot={fantasyDot} activeDot={fantasyActiveDot} />
            {hasToi && <Line yAxisId="toi" type="monotone" dataKey="toi" name="TOI (min)" stroke="var(--warning)" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
