import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PublicBriefing } from '../../lib/homeBriefing';
import { getTeamLogoUrl } from '../../lib/teamLogos';
import { buildHomeActionLink } from '../../lib/navigationContext';
import { mugshotSeason } from '../../lib/season';
import { Button } from '../ui/button';
import { headshotUrl, useCountUp, useNow } from './homeMotion';
import './home.css';

export interface TonightPlayer {
  id: string;
  name: string;
  team: string;
  onIr: boolean;
}

/** Nights with this many games or fewer leave open lineup spots league-wide. */
const OFF_NIGHT_MAX_GAMES = 8;

function dayLabel(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function timeLabel(startTime: string | undefined, timezone: string): string {
  if (!startTime || Number.isNaN(new Date(startTime).getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(startTime));
}

function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The home page hero: tonight's slate as an arena scoreboard. Game count in LED
 * numerals, a live puck-drop countdown, an off-night flag, the matchups as logos,
 * and the user's players who play tonight.
 */
export function Jumbotron({ briefing, timezone, phase, leagueId, tonight }: {
  briefing: PublicBriefing;
  timezone: string;
  phase: 'preseason' | 'regular-season' | 'outside-coverage';
  leagueId: string;
  tonight: TonightPlayer[];
}) {
  const now = useNow(1000);
  const regular = phase === 'regular-season';
  const slateDate = regular && briefing.gameCount > 0 ? briefing.date : briefing.nextGameDate;
  const games = regular && briefing.gameCount > 0 ? briefing.gameCount : briefing.nextGameCount ?? 0;
  const matchups = regular && briefing.gameCount > 0 ? briefing.matchups : briefing.nextMatchups;
  const shownGames = Math.round(useCountUp(games, 700));
  const puckDrop = regular && briefing.firstPuckDrop ? Date.parse(briefing.firstPuckDrop) : NaN;
  const offNight = games > 0 && games <= OFF_NIGHT_MAX_GAMES;
  const daysAway = slateDate ? daysBetween(briefing.date, slateDate) : null;
  const scheduleLink = buildHomeActionLink(`/season?start=${slateDate ?? briefing.date}`, { leagueId, date: slateDate ?? briefing.date, source: 'home-briefing', returnTo: '/' });

  let headline: string;
  if (!slateDate) headline = 'No games left in this schedule';
  else if (daysAway === 0) headline = phase === 'preseason' ? 'Opening night is tonight' : 'Tonight';
  else if (phase === 'preseason') headline = `Opening night in ${daysAway} day${daysAway === 1 ? '' : 's'}`;
  else headline = `Next games ${daysAway === 1 ? 'tomorrow' : dayLabel(slateDate, { weekday: 'long' })}`;

  let clock: string | null = null;
  if (Number.isFinite(puckDrop)) clock = puckDrop > now ? `Puck drop in ${countdown(puckDrop - now)}` : 'Pucks have dropped';

  return (
    <section className="jumbotron relative h-full overflow-hidden rounded-2xl border border-line-strong shadow-panel" aria-labelledby="jumbotron-heading">
      <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div className="relative mx-auto grid size-40 place-items-center sm:size-48" aria-hidden="true">
          <div className="faceoff-ring absolute inset-0" />
          <div className="faceoff-ring absolute inset-[18%] opacity-60" />
          <span className="led-numeral text-[5.5rem] sm:text-[7rem]">{shownGames}</span>
        </div>

        <div className="min-w-0">
          <p className="scoreboard-text text-sm text-ink-dim">
            {slateDate ? dayLabel(slateDate, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Schedule'}
          </p>
          <h1 id="jumbotron-heading" className="mt-1 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {headline}
          </h1>
          <p className="mt-2 text-base text-ink-dim">
            <span className="sr-only">{games} </span>NHL game{games === 1 ? '' : 's'}{slateDate && daysAway !== 0 ? ' on the slate' : ' tonight'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {clock && <span className="led-numeral led-amber rounded-md border border-warning/30 bg-surface-0/70 px-3 py-1.5 text-base" aria-live="off">{clock}</span>}
            {offNight && (
              <span className="rounded-md border border-positive/40 bg-positive-muted px-3 py-1.5 text-sm font-semibold text-positive" title={`${OFF_NIGHT_MAX_GAMES} or fewer games: lineup spots open up league-wide`}>
                Off-night: easy starts
              </span>
            )}
          </div>
        </div>
      </div>

      {matchups.length > 0 && (
        <div className="relative border-t border-line bg-surface-0/60 px-5 py-3 sm:px-7">
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Matchups">
            {matchups.map((game) => (
              <li key={`${game.away}-${game.home}`} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-1/80 px-2.5 py-1.5" title={`${game.away} at ${game.home}`}>
                <img src={getTeamLogoUrl(game.away)} alt={game.away} className="size-7 object-contain" />
                <span className="text-[10px] text-ink-mute">at</span>
                <img src={getTeamLogoUrl(game.home)} alt={game.home} className="size-7 object-contain" />
                {game.startTime && <span className="ml-1 text-[11px] tabular-nums text-ink-dim">{timeLabel(game.startTime, timezone)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tonight.length > 0 && daysAway === 0 && (
        <div className="relative border-t border-line px-5 py-4 sm:px-7">
          <p className="text-sm font-semibold text-ink">Your players on the ice tonight</p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {tonight.map((player) => (
              <li key={player.id} className={`flex w-16 flex-col items-center text-center ${player.onIr ? 'opacity-50' : ''}`} title={player.onIr ? `${player.name} (on IR)` : player.name}>
                <img
                  src={headshotUrl(mugshotSeason, player.team, player.id)}
                  alt=""
                  loading="lazy"
                  className="size-14 rounded-full border-2 border-accent/50 bg-surface-0 object-cover"
                  onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
                />
                <span className="mt-1 w-full truncate text-[11px] text-ink-dim">{player.name.split(' ').slice(-1)[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 sm:px-7">
        <p className="text-xs text-ink-mute">{timezone.replace(/_/g, ' ')} times</p>
        <Button asChild size="sm" variant="ghost">
          <Link to={phase === 'regular-season' ? scheduleLink : buildHomeActionLink('/draft', { leagueId, date: briefing.date, source: 'home-briefing', returnTo: '/' })}>
            {phase === 'regular-season' ? 'Open the schedule' : 'Open Draft Board'}<ArrowRight size={15} />
          </Link>
        </Button>
      </div>
    </section>
  );
}
