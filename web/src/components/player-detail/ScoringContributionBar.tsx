import { useMemo } from 'react';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import { goalieStatView } from '../../lib/goalieStats';

interface ScoringContributionBarProps {
  player: RosterPlayer;
  leagueProfile: LeagueProfile;
}

const segmentClasses = ['bg-accent', 'bg-positive', 'bg-warning', 'bg-accent/60', 'bg-positive/60', 'bg-warning/60'] as const;

export function ScoringContributionBar({ player, leagueProfile }: ScoringContributionBarProps) {
  const isGoalie = player.positions.includes('G');
  const contributions = useMemo(() => {
    const weights = {
      ...(leagueProfile.scoring_weights ?? {}),
      ...(isGoalie ? leagueProfile.goalie_scoring ?? {} : leagueProfile.skater_scoring ?? {}),
    } as Record<string, number | undefined>;
    const stats = player.stats;
    const goalie = goalieStatView(player);
    const values = (isGoalie ? [
      { label: 'Wins', value: goalie.wins * (weights.wins ?? 0) },
      { label: 'Saves', value: goalie.saves * (weights.saves ?? 0) },
      { label: 'Shutouts', value: goalie.shutouts * (weights.shutouts ?? 0) },
      { label: 'Starts', value: goalie.gamesStarted * (weights.games_started ?? 0) },
    ] : [
      { label: 'Goals', value: (stats.goals ?? 0) * (weights.goals ?? 0) },
      { label: 'Assists', value: (stats.assists ?? 0) * (weights.assists ?? 0) },
      { label: 'Shots', value: (stats.shots_on_goal ?? 0) * (weights.shots_on_goal ?? 0) },
      { label: 'Power play', value: (stats.power_play_points ?? 0) * (weights.powerplay_points ?? weights.power_play_points ?? 0) },
      { label: 'Hits', value: (stats.hits ?? 0) * (weights.hits ?? 0) },
      { label: 'Blocks', value: (stats.blocks ?? 0) * (weights.blocks ?? 0) },
    ]).filter((item) => item.value > 0);
    const total = values.reduce((sum, item) => sum + item.value, 0);
    return values.map((item, index) => ({
      ...item,
      percentage: total > 0 ? item.value / total * 100 : 0,
      className: segmentClasses[index % segmentClasses.length],
    }));
  }, [isGoalie, leagueProfile.goalie_scoring, leagueProfile.scoring_weights, leagueProfile.skater_scoring, player]);

  if (contributions.length === 0) return null;

  return (
    <figure className="rounded-xl border border-line bg-surface-0 p-5">
      <p className="scoreboard-text text-accent">League scoring</p>
      <h3 className="mt-1 text-lg font-semibold text-ink">{isGoalie ? 'Goalie fantasy-point contribution' : 'Fantasy-point contribution'}</h3>
      <p className="mt-1 text-xs text-ink-mute">Share of the player’s positive season value under the active scoring weights.</p>
      {isGoalie && <p className="mt-1 text-xs text-ink-mute">Goals-against penalties remain included in FPPG.</p>}
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-label="Fantasy point contribution by category">
        {contributions.map((item) => (
          <div key={item.label} className={item.className} style={{ width: `${item.percentage}%` }} aria-label={`${item.label}: ${item.percentage.toFixed(0)}%`} />
        ))}
      </div>
      <figcaption className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {contributions.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-ink-dim"><span className={`h-2 w-2 rounded-full ${item.className}`} />{item.label}</span>
            <strong className="scoreboard-number text-ink">{item.percentage.toFixed(0)}%</strong>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
