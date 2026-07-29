import React from 'react';
import { CalendarDays, Moon, Rocket, Sparkles } from 'lucide-react';
import type { RosterPlayer, LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { getTeamColor } from '../lib/teamLogos';
import { getIceCircleStyle, ICE_RATING_MAX, ICE_RATING_MIN } from '../lib/iceScore';
import { getPlayerProjection } from '../lib/playerProjection';
import { mugshotSeason, SEASON_LABEL } from '../lib/season';
import type { LeagueWorkspace } from '../lib/leagueWorkspace';

interface RosterShareFrameProps {
  roster: RosterPlayer[];
  leagueProfile: LeagueProfile;
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
  fantasyTeam: LeagueWorkspace['fantasyTeam'];
}

interface ShareSlot {
  id: string;
  label: string;
}

interface FormationSection {
  id: 'forwards' | 'flex' | 'defense' | 'goalies';
  label: string;
  columns: number;
  rows: ShareSlot[][];
}

const RESERVE_TYPES = new Set(['BN', 'IR', 'IR+']);

function parseSlot(slot = ''): { type: string; index: number } {
  const match = slot.toUpperCase().match(/^([A-Z+]+)(?:[- ]?(\d+))?$/);
  if (!match) return { type: slot.toUpperCase(), index: 0 };
  return { type: match[1], index: match[2] ? Number(match[2]) : 0 };
}

function canonicalSlot(slot = ''): string {
  const parsed = parseSlot(slot);
  return parsed.type ? `${parsed.type}-${parsed.index}` : '';
}

function reserveSlotLabel(slot = ''): string {
  const parsed = parseSlot(slot);
  if (!parsed.type) return 'ROSTER';
  if (parsed.type === 'BN') return `BN${parsed.index + 1}`;
  return parsed.index > 0 ? `${parsed.type}${parsed.index + 1}` : parsed.type;
}

function makeSlots(type: string, count: number): ShareSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${type}-${index}`,
    label: count === 1 ? type : `${type}${index + 1}`,
  }));
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function buildFormation(lineupSlots: Record<string, number>): FormationSection[] {
  const sections: FormationSection[] = [];
  const lw = makeSlots('LW', lineupSlots.LW ?? 0);
  const centers = makeSlots('C', lineupSlots.C ?? 0);
  const rw = makeSlots('RW', lineupSlots.RW ?? 0);
  const forwardRows = Array.from(
    { length: Math.max(lw.length, centers.length, rw.length) },
    (_, index) => [lw[index], centers[index], rw[index]].filter((slot): slot is ShareSlot => Boolean(slot)),
  );
  if (forwardRows.length) sections.push({ id: 'forwards', label: 'FORWARD LINES', columns: 3, rows: forwardRows });

  const flexSlots = [...makeSlots('F', lineupSlots.F ?? 0), ...makeSlots('UTIL', lineupSlots.UTIL ?? 0)];
  if (flexSlots.length) sections.push({ id: 'flex', label: 'FLEX', columns: 3, rows: chunk(flexSlots, 3) });

  const defense = makeSlots('D', lineupSlots.D ?? 0);
  if (defense.length) sections.push({ id: 'defense', label: 'DEFENSE PAIRS', columns: 2, rows: chunk(defense, 2) });

  const goalies = makeSlots('G', lineupSlots.G ?? 0);
  if (goalies.length) sections.push({ id: 'goalies', label: 'GOALIES', columns: Math.min(3, goalies.length), rows: chunk(goalies, 3) });
  return sections;
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
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function scoringLabel(profile: LeagueProfile): string {
  if (profile.preset_name) return profile.preset_name;
  return profile.scoring_type === 'points' ? 'Custom points' : 'League scoring';
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="grid h-[86px] place-items-center rounded-xl border border-dashed border-line bg-surface-0/50 text-center">
      <div>
        <p className="font-mono text-[12px] font-bold text-ink-mute">{label}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wider text-ink-mute">Open slot</p>
      </div>
    </div>
  );
}

function CenteredPill({ label, width }: { label: string; width: number }) {
  return (
    <div className="h-9 shrink-0 overflow-hidden rounded-full border border-accent bg-surface-1/90 shadow-card" style={{ width }}>
      <svg viewBox={`0 0 ${width} 36`} className="block size-full text-accent" aria-hidden="true">
        <text
          x={width / 2}
          y="18"
          fill="currentColor"
          dominantBaseline="middle"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="13"
          fontWeight="700"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

function PlayerTile({
  player,
  projection,
  slotLabel,
  compact = false,
}: {
  player: RosterPlayer;
  projection?: PlayerProjection;
  slotLabel: string;
  compact?: boolean;
}) {
  const fppg = projection?.fppg ?? player.seasonFppg ?? 0;
  const iceScore = projection?.iceScore ?? fppg;
  const iceStyle = getIceCircleStyle(iceScore, ICE_RATING_MIN, ICE_RATING_MAX);
  const playerId = player.id.replace(/^nhl:/, '');
  const positions = player.positions.join('/');
  const headshotUrl = `/api/coach/share-assets/headshot/${mugshotSeason}/${player.team}/${playerId}`;
  const teamLogoUrl = `/api/coach/share-assets/logo/${player.team}`;
  const nameSize = player.full_name.length > 20 ? 13 : player.full_name.length > 16 ? 14 : 16;
  const estimatedNameWidth = player.full_name.length * nameSize * 0.56;
  const fittedNameWidth = estimatedNameWidth > 190 ? 190 : undefined;

  return (
    <article className={`relative flex overflow-hidden rounded-xl border border-line bg-surface-1 px-2.5 ${compact ? 'h-[68px] py-2' : 'h-[86px] py-2'}`}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: getTeamColor(player.team) }} />
      <div className={`relative ml-1 shrink-0 ${compact ? 'size-12' : 'size-14'}`}>
        <img src={headshotUrl} alt="" crossOrigin="anonymous" className="size-full rounded-full border border-line bg-surface-0 object-cover" />
        <img src={teamLogoUrl} alt="" crossOrigin="anonymous" className="absolute -bottom-0.5 -right-0.5 size-5 object-contain" />
      </div>

      <div className="ml-2.5 min-w-0 flex-1">
        <svg viewBox="0 0 190 24" preserveAspectRatio="xMinYMid meet" className="block h-6 w-full text-ink" aria-hidden="true">
          <text
            x="0"
            y="18"
            fill="currentColor"
            fontFamily="Arial, sans-serif"
            fontSize={nameSize}
            fontWeight="700"
            textLength={fittedNameWidth}
            lengthAdjust={fittedNameWidth ? 'spacingAndGlyphs' : undefined}
          >
            {player.full_name}
          </text>
        </svg>
        <svg viewBox="0 0 190 16" preserveAspectRatio="xMinYMid meet" className="mt-0.5 block h-4 w-full text-accent" aria-hidden="true">
          <text x="0" y="12" fill="currentColor" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" letterSpacing="0.2">
            {slotLabel} · {player.team} · {positions}
          </text>
        </svg>
        {!compact && (
          <p
            className="mt-1 whitespace-nowrap text-ink-dim"
            style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', lineHeight: '14px' }}
          >
            <strong className="font-mono text-ink">{fppg.toFixed(2)}</strong> FPPG
            <span className="mx-2">·</span>
            <strong className="font-mono text-ink">{projection?.gamesAvailable ?? '—'}</strong> GP
            <span className="mx-2">·</span>
            <strong className="font-mono text-accent">{projection?.starts ?? '—'}</strong> starts
          </p>
        )}
      </div>

      <div
        className={`ml-1 shrink-0 overflow-hidden rounded-full ${compact ? 'size-8' : 'size-9'}`}
        style={{
          background: iceStyle.backgroundColor,
          border: iceStyle.border,
          boxShadow: iceStyle.boxShadow,
        }}
      >
        <svg viewBox="0 0 36 36" className="block size-full" aria-hidden="true">
          <text
            x="18"
            y="18"
            fill={iceStyle.textColor}
            dominantBaseline="middle"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontSize={compact ? 11 : 12}
            fontWeight="800"
          >
            {iceScore > 0 ? iceScore.toFixed(1) : '—'}
          </text>
        </svg>
      </div>
    </article>
  );
}

function SummaryMetric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-4 py-3">
      <div className="flex items-center gap-2 text-accent">{icon}<span className="scoreboard-text text-[11px]">{label}</span></div>
      <strong className="mt-1 block font-mono text-[28px] leading-none text-ink">{value}</strong>
    </div>
  );
}

export const RosterShareFrame: React.FC<RosterShareFrameProps> = ({ roster, leagueProfile, projections, timeWindow, fantasyTeam }) => {
  const formation = buildFormation(leagueProfile.lineup_slots);
  const playerBySlot = new Map(roster.map((player) => [canonicalSlot(player.current_slot), player]));
  const configuredSlotIds = new Set(formation.flatMap((section) => section.rows.flatMap((row) => row.map((slot) => slot.id))));
  const reserves = roster.filter((player) => RESERVE_TYPES.has(parseSlot(player.current_slot).type));
  const unplaced = roster.filter((player) => {
    const type = parseSlot(player.current_slot).type;
    return !RESERVE_TYPES.has(type) && !configuredSlotIds.has(canonicalSlot(player.current_slot));
  });
  const projectionValues = roster
    .map((player) => getPlayerProjection(projections, player.id))
    .filter((projection): projection is PlayerProjection => Boolean(projection));
  const games = projectionValues.reduce((total, projection) => total + projection.gamesAvailable, 0);
  const starts = projectionValues.reduce((total, projection) => total + projection.starts, 0);
  const offNights = projectionValues.reduce((total, projection) => total + Math.round(projection.gamesAvailable * projection.offNightRate), 0);
  const projectedPoints = projectionValues.reduce((total, projection) => total + projection.projectedPoints, 0);
  const hasSchedule = projectionValues.length > 0;
  const fantasyTeamName = fantasyTeam.name.trim() || leagueProfile.league_name;
  const leagueNameSize = fantasyTeamName.length > 28 ? 30 : fantasyTeamName.length > 20 ? 34 : 40;
  const estimatedLeagueNameWidth = fantasyTeamName.length * leagueNameSize * 0.58;
  const fittedLeagueNameWidth = estimatedLeagueNameWidth > 650 ? 650 : undefined;

  return (
    <div className="relative flex h-[1350px] w-[1080px] flex-col overflow-hidden bg-surface-0 font-sans text-ink">
      <div className="absolute inset-0 bg-gradient-to-br from-surface-0 via-surface-1 to-surface-0" />
      <img src="/hockey-rink-bg.png" alt="" className="absolute inset-0 size-full object-cover opacity-[0.08]" />

      {/* Abstract rink geometry adds movement without competing with the lineup. */}
      <div className="absolute -right-28 top-24 size-[430px] rounded-full border-2 border-line-strong opacity-30" />
      <div className="absolute right-[82px] top-[292px] size-7 rounded-full border border-accent bg-accent-muted opacity-50 shadow-glow" />
      <div className="absolute right-[-30px] top-[304px] h-px w-[470px] bg-line-strong opacity-35" />
      <div className="absolute right-[194px] top-[92px] h-[430px] w-px bg-line-strong opacity-25" />
      <div className="absolute -right-16 top-[168px] h-px w-[620px] -rotate-12 bg-accent opacity-20" />
      <div className="absolute -right-12 top-[212px] h-px w-[540px] -rotate-12 bg-accent opacity-10" />
      <div className="absolute -bottom-36 -left-36 size-[390px] rounded-full border-2 border-line opacity-20" />
      <div className="absolute bottom-[58px] left-[41px] h-px w-[330px] rotate-12 bg-line opacity-20" />

      <header className="relative flex items-center justify-between border-b border-line px-12 py-6">
        <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-10 w-auto" />
        <div className="text-right">
          <p className="scoreboard-text text-sm text-accent">MY FANTASY ROSTER</p>
          <p className="mt-1 font-mono text-sm text-ink-dim">{SEASON_LABEL} · {windowLabel(timeWindow)}</p>
        </div>
      </header>

      <section className="relative px-12 pb-5 pt-6">
        <p className="scoreboard-text text-accent">ROSTER SNAPSHOT</p>
        <div className="mt-2 flex items-center justify-between gap-8">
          <div className="flex min-w-0 items-center gap-4">
            {fantasyTeam.logoDataUrl && <div className="grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-line-strong bg-surface-1 p-2 shadow-card"><img src={fantasyTeam.logoDataUrl} alt="" className="size-full object-contain" /></div>}
            <div className="min-w-0">
            <svg viewBox="0 0 650 52" preserveAspectRatio="xMinYMid meet" className="block h-[52px] w-full max-w-[650px] text-ink" aria-hidden="true">
              <text
                x="0"
                y="39"
                fill="currentColor"
                fontFamily="Arial, sans-serif"
                fontSize={leagueNameSize}
                fontWeight="900"
                textLength={fittedLeagueNameWidth}
                lengthAdjust={fittedLeagueNameWidth ? 'spacingAndGlyphs' : undefined}
              >
                {fantasyTeamName}
              </text>
            </svg>
            <p className="mt-1 text-base text-ink-dim">{fantasyTeamName === leagueProfile.league_name ? '' : `${leagueProfile.league_name} · `}{scoringLabel(leagueProfile)} · {roster.length} rostered {roster.length === 1 ? 'player' : 'players'}</p>
            </div>
          </div>
          <CenteredPill label="Schedule-aware" width={150} />
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          <SummaryMetric icon={<CalendarDays size={15} />} value={hasSchedule ? String(games) : '—'} label="PLAYER GAMES" />
          <SummaryMetric icon={<Rocket size={15} />} value={hasSchedule ? String(starts) : '—'} label="USABLE STARTS" />
          <SummaryMetric icon={<Moon size={15} />} value={hasSchedule ? String(offNights) : '—'} label="OFF-NIGHTS" />
          <SummaryMetric icon={<Sparkles size={15} />} value={hasSchedule ? projectedPoints.toFixed(1) : '—'} label="PROJECTED PTS" />
        </div>
      </section>

      <main className="relative min-h-0 flex-1 px-12">
        {roster.length === 0 ? (
          <div className="grid h-full place-items-center rounded-2xl border border-line bg-surface-1/70 text-center">
            <div><p className="text-3xl font-black text-ink">Your roster starts here</p><p className="mt-3 text-lg text-ink-dim">Build a schedule-aware fantasy team at crackedicehockey.com</p></div>
          </div>
        ) : (
          <div className="space-y-3">
            {formation.map((section) => (
              <section key={section.id}>
                <div className="mb-1.5 flex items-center gap-3">
                  <h2 className="scoreboard-text text-[12px] text-accent">{section.label}</h2>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="space-y-2">
                  {section.rows.map((row, rowIndex) => (
                    <div key={`${section.id}-${rowIndex}`} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}>
                      {row.map((slot) => {
                        const player = playerBySlot.get(slot.id);
                        return player ? (
                          <PlayerTile key={slot.id} player={player} projection={getPlayerProjection(projections, player.id)} slotLabel={slot.label} />
                        ) : <EmptySlot key={slot.id} label={slot.label} />;
                      })}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {(reserves.length > 0 || unplaced.length > 0) && (
              <section>
                <div className="mb-1.5 flex items-center gap-3"><h2 className="scoreboard-text text-[12px] text-accent">BENCH & RESERVE</h2><span className="h-px flex-1 bg-line" /></div>
                <div className="grid grid-cols-3 gap-2">
                  {[...reserves, ...unplaced].map((player) => (
                    <PlayerTile
                      key={player.id}
                      player={player}
                      projection={getPlayerProjection(projections, player.id)}
                      slotLabel={reserveSlotLabel(player.current_slot)}
                      compact
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="relative mx-12 mt-4 flex items-center justify-between border-t border-line py-6">
        <div>
          <p className="text-base font-black uppercase tracking-wide text-ink">WHAT WOULD YOU CHANGE?</p>
          <p className="mt-1 text-sm text-ink-dim">Share your roster and ask who to add, drop, start, or sit.</p>
        </div>
        <CenteredPill label="crackedicehockey.com" width={208} />
      </footer>
    </div>
  );
};
