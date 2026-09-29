import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sortTeams, type DayId, type WeeklySchedule } from '../../lib/schedule';
import { getTeamLogoUrl } from '../../lib/teamLogos';

const PACKED_NIGHT = 13;
const QUIET_NIGHT = 8;

export interface WeekStream {
  team: string;
  games: number;
  offNightGames: number;
  backToBacks: number;
}

/** The week's best streaming schedules: most games, most of them on off-nights. */
export function bestStreamingTeams(schedule: WeeklySchedule, count = 4): WeekStream[] {
  return sortTeams(schedule.teams, 'best', null)
    .filter((team) => team.metrics.totalGames > 0)
    .slice(0, count)
    .map((team) => ({ team: team.team, games: team.metrics.totalGames, offNightGames: team.metrics.offNightGames, backToBacks: team.metrics.b2bGames }));
}

export function streamNote(stream: WeekStream): string {
  const offNights = stream.offNightGames === stream.games ? 'all on off-nights' : stream.offNightGames > 0 ? `${stream.offNightGames} on off-nights` : 'none on off-nights';
  return `${stream.games} games, ${offNights}${stream.backToBacks > 0 ? ', back-to-back' : ''}`;
}

/**
 * The schedule page's answer before any setup: the teams to stream this week and the
 * quiet and packed nights, with adding a roster as the next step.
 */
export function WeekStreamsPanel({ schedule, gamesPerDay, onSelectTeam }: {
  schedule: WeeklySchedule;
  gamesPerDay: Partial<Record<DayId, number>>;
  onSelectTeam: (team: string) => void;
}) {
  const streams = bestStreamingTeams(schedule);
  const playing = schedule.days.filter((day) => (gamesPerDay[day.id] ?? 0) > 0);
  const quiet = playing.filter((day) => (gamesPerDay[day.id] ?? 0) <= QUIET_NIGHT).map((day) => day.id);
  const packed = playing.filter((day) => (gamesPerDay[day.id] ?? 0) >= PACKED_NIGHT).map((day) => day.id);
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="scoreboard-text text-accent">THIS WEEK'S STREAMS</p>
        <h2 id="schedule-answer-title" className="mt-0.5 text-lg font-semibold text-ink">Best streaming schedules this week</h2>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Teams with the best schedules this week">
          {streams.map((stream) => (
            <li key={stream.team}>
              <button type="button" onClick={() => onSelectTeam(stream.team)} className="keep-flex inline-flex min-h-11 items-center gap-2 rounded-lg border border-positive/40 bg-positive-muted px-3 text-left hover:border-positive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`${stream.team}: ${streamNote(stream)}. See the players.`}>
                <img src={getTeamLogoUrl(stream.team)} alt="" className="size-6 shrink-0 object-contain" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{stream.team}</span>
                  <span className="block text-[11px] text-ink-dim">{streamNote(stream)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {(quiet.length > 0 || packed.length > 0) && (
          <p className="mt-2 text-sm text-ink-dim">
            {quiet.length > 0 && <>Quiet nights: <strong className="text-ink">{quiet.join(', ')}</strong></>}
            {quiet.length > 0 && packed.length > 0 && <span aria-hidden="true"> · </span>}
            {packed.length > 0 && <>Packed: <strong className="text-negative">{packed.join(', ')}</strong> (most rosters are already full)</>}
          </p>
        )}
        <p className="mt-1 text-xs text-ink-mute">Tap a team to see who's worth adding.</p>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 lg:items-end">
        <Link to="/team" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-accent bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Add your roster <ChevronRight size={16} aria-hidden="true" /></Link>
        <p className="text-xs text-ink-mute">See the nights <em>your</em> lineup has room.</p>
      </div>
    </div>
  );
}
