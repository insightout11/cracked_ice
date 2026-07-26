import React from 'react';
import { CalendarDays, Moon, Rocket, Sparkles } from 'lucide-react';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { getTeamColor } from '../lib/teamLogos';
import { getIceCircleStyle, ICE_RATING_MAX, ICE_RATING_MIN } from '../lib/iceScore';
import { getPlayerProjection } from '../lib/playerProjection';
import { mugshotSeason, SEASON_LABEL } from '../lib/season';

interface RosterShareFrameProps {
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
}

const SLOT_ORDER: Record<string, number> = {
  LW: 0,
  C: 1,
  RW: 2,
  F: 3,
  D: 4,
  G: 5,
  BN: 6,
  IR: 7,
  'IR+': 8,
};

function parseSlot(slot = ''): { type: string; index: number } {
  const match = slot.toUpperCase().match(/^([A-Z+]+)(?:[- ]?(\d+))?$/);
  if (!match) return { type: slot.toUpperCase(), index: 0 };
  return { type: match[1], index: match[2] ? Number(match[2]) : 0 };
}

function displaySlot(slot = ''): string {
  const parsed = parseSlot(slot);
  if (!parsed.type) return 'ROSTER';
  if (!/\d/.test(slot)) return parsed.type;
  return `${parsed.type}${parsed.index + 1}`;
}

function sortRoster(roster: RosterPlayer[]): RosterPlayer[] {
  return [...roster].sort((a, b) => {
    const slotA = parseSlot(a.current_slot);
    const slotB = parseSlot(b.current_slot);
    return (SLOT_ORDER[slotA.type] ?? 99) - (SLOT_ORDER[slotB.type] ?? 99)
      || slotA.index - slotB.index
      || a.full_name.localeCompare(b.full_name);
  });
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function windowLabel(timeWindow: TimeWindowState): string {
  const start = timeWindow.config?.startUtc;
  const end = timeWindow.config?.endUtc;
  if (!start || !end) return 'Full-season roster';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function scoringLabel(profile: LeagueProfile): string {
  if (profile.preset_name) return profile.preset_name;
  return profile.scoring_type === 'points' ? 'Custom points' : 'League scoring';
}

function PlayerCard({
  player,
  projection,
  roomy = false,
}: {
  player: RosterPlayer;
  projection?: PlayerProjection;
  roomy?: boolean;
}) {
  const fppg = projection?.fppg ?? player.seasonFppg ?? 0;
  const iceScore = projection?.iceScore ?? fppg;
  const iceStyle = getIceCircleStyle(iceScore, ICE_RATING_MIN, ICE_RATING_MAX);
  const playerId = player.id.replace(/^nhl:/, '');
  const positions = player.positions.join('/');
  const headshotUrl = `/api/coach/share-assets/headshot/${mugshotSeason}/${player.team}/${playerId}`;
  const teamLogoUrl = `/api/coach/share-assets/logo/${player.team}`;

  return (
    <article className={`relative flex overflow-hidden rounded-xl border border-line bg-surface-1 px-3 py-3 ${roomy ? 'h-[126px]' : 'h-[104px]'}`}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: getTeamColor(player.team) }} />
      <div className={`relative ml-1 shrink-0 ${roomy ? 'size-20' : 'size-16'}`}>
        <img
          src={headshotUrl}
          alt=""
          crossOrigin="anonymous"
          className={`${roomy ? 'size-20' : 'size-16'} rounded-full border border-line bg-surface-0 object-cover`}
        />
        <img
          src={teamLogoUrl}
          alt=""
          crossOrigin="anonymous"
          className="absolute -bottom-1 -right-1 size-7 object-contain"
        />
      </div>

      <div className="ml-3 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`truncate font-bold leading-tight text-ink ${roomy ? 'text-[20px]' : 'text-[17px]'}`}>{player.full_name}</h3>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-accent">
              {displaySlot(player.current_slot)} · {player.team} · {positions}
            </p>
          </div>
          <div
            className="grid size-10 shrink-0 place-items-center rounded-full font-mono text-[13px] font-bold"
            style={{
              background: iceStyle.backgroundColor,
              border: iceStyle.border,
              boxShadow: iceStyle.boxShadow,
              color: iceStyle.textColor,
            }}
          >
            {iceScore > 0 ? iceScore.toFixed(1) : '—'}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-dim">
          <span><strong className="font-mono text-sm text-ink">{fppg.toFixed(2)}</strong> FPPG</span>
          <span><strong className="font-mono text-sm text-ink">{projection?.gamesAvailable ?? '—'}</strong> GP</span>
          <span><strong className="font-mono text-sm text-accent">{projection?.starts ?? '—'}</strong> starts</span>
        </div>
      </div>
    </article>
  );
}

function SummaryMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-4 py-3">
      <div className="flex items-center gap-2 text-accent">{icon}<span className="scoreboard-text text-[11px]">{label}</span></div>
      <strong className="mt-1 block font-mono text-[30px] leading-none text-ink">{value}</strong>
    </div>
  );
}

export const RosterShareFrame: React.FC<RosterShareFrameProps> = ({
  roster,
  leagueProfile,
  projections,
  timeWindow,
}) => {
  const sortedRoster = sortRoster(roster);
  const active = sortedRoster.filter((player) => !['BN', 'IR', 'IR+'].includes(parseSlot(player.current_slot).type));
  const reserve = sortedRoster.filter((player) => ['BN', 'IR', 'IR+'].includes(parseSlot(player.current_slot).type));
  const projectionValues = roster
    .map((player) => getPlayerProjection(projections, player.id))
    .filter((projection): projection is PlayerProjection => Boolean(projection));
  const games = projectionValues.reduce((total, projection) => total + projection.gamesAvailable, 0);
  const starts = projectionValues.reduce((total, projection) => total + projection.starts, 0);
  const offNights = projectionValues.reduce(
    (total, projection) => total + Math.round(projection.gamesAvailable * projection.offNightRate),
    0,
  );
  const projectedPoints = projectionValues.reduce((total, projection) => total + projection.projectedPoints, 0);
  const hasSchedule = projectionValues.length > 0;
  const roomyCards = roster.length <= 10;

  return (
    <div className="relative flex h-[1350px] w-[1080px] flex-col overflow-hidden bg-surface-0 text-ink">
      <img src="/hockey-rink-bg.png" alt="" className="absolute inset-0 size-full object-cover opacity-[0.15]" />
      <div className="absolute inset-0 bg-surface-0/80" />
      <div className="absolute -right-32 top-20 size-[420px] rounded-full bg-accent-muted blur-3xl" />

      <header className="relative flex items-center justify-between border-b border-line px-12 py-8">
        <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-14 w-auto" />
        <div className="text-right">
          <p className="scoreboard-text text-sm text-accent">MY FANTASY ROSTER</p>
          <p className="mt-1 font-mono text-sm text-ink-dim">{SEASON_LABEL} · {windowLabel(timeWindow)}</p>
        </div>
      </header>

      <section className="relative px-12 pb-7 pt-8">
        <p className="scoreboard-text text-accent">ROSTER SNAPSHOT</p>
        <div className="mt-2 flex items-end justify-between gap-8">
          <div className="min-w-0">
            <h1 className="brand-title truncate text-[42px] leading-tight">{leagueProfile.league_name}</h1>
            <p className="mt-2 text-lg text-ink-dim">{scoringLabel(leagueProfile)} · {roster.length} rostered {roster.length === 1 ? 'player' : 'players'}</p>
          </div>
          <div className="shrink-0 rounded-full border border-accent bg-accent-muted px-4 py-2 text-sm font-semibold text-accent">
            Schedule-aware
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-3">
          <SummaryMetric icon={<CalendarDays size={15} />} value={hasSchedule ? String(games) : '—'} label="PLAYER GAMES" />
          <SummaryMetric icon={<Rocket size={15} />} value={hasSchedule ? String(starts) : '—'} label="USABLE STARTS" />
          <SummaryMetric icon={<Moon size={15} />} value={hasSchedule ? String(offNights) : '—'} label="OFF-NIGHTS" />
          <SummaryMetric icon={<Sparkles size={15} />} value={hasSchedule ? projectedPoints.toFixed(1) : '—'} label="PROJECTED PTS" />
        </div>
      </section>

      <main className="relative min-h-0 flex-1 px-12">
        {roster.length === 0 ? (
          <div className="grid h-full place-items-center rounded-2xl border border-line bg-surface-1/70 text-center">
            <div>
              <p className="brand-title text-3xl">Your roster starts here</p>
              <p className="mt-3 text-lg text-ink-dim">Build a schedule-aware fantasy team at crackedicehockey.com</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {active.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="scoreboard-text text-sm text-accent">ACTIVE ROSTER</h2>
                  <span className="font-mono text-xs text-ink-mute">{active.length} players</span>
                </div>
                <div className={`grid gap-3 ${roomyCards ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {active.map((player) => (
                    <PlayerCard key={player.id} player={player} projection={getPlayerProjection(projections, player.id)} roomy={roomyCards} />
                  ))}
                </div>
              </section>
            )}

            {reserve.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="scoreboard-text text-sm text-accent">BENCH & RESERVE</h2>
                  <span className="font-mono text-xs text-ink-mute">{reserve.length} players</span>
                </div>
                <div className={`grid gap-3 ${roomyCards ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {reserve.map((player) => (
                    <PlayerCard key={player.id} player={player} projection={getPlayerProjection(projections, player.id)} roomy={roomyCards} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="relative mx-12 mt-6 flex items-center justify-between border-t border-line py-7">
        <div>
          <p className="scoreboard-text text-lg text-ink">CAN YOUR ROSTER USE EVERY GAME?</p>
          <p className="mt-1 text-sm text-ink-dim">Production + schedule + lineup fit, in your league’s scoring.</p>
        </div>
        <div className="rounded-full border border-accent bg-accent-muted px-5 py-3 font-mono text-base font-bold text-accent">
          crackedicehockey.com
        </div>
      </footer>
    </div>
  );
};
