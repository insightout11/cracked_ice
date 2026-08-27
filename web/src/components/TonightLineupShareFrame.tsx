import React from 'react';
import { CalendarDays, Clock3, Moon, Sparkles } from 'lucide-react';
import type { LeagueProfile, PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import { getPlayerProjection } from '../lib/playerProjection';
import { mugshotSeason } from '../lib/season';
import { getTeamColor } from '../lib/teamLogos';
import type { LeagueWorkspace } from '../lib/leagueWorkspace';
import { ShareIceRating } from './ShareIceRating';

export interface LineupShareGame {
  date: string;
  opponent: string;
  isHome: boolean;
  startTime?: string;
  isOffNight?: boolean;
}

export interface TonightLineupPlayer {
  player: RosterPlayer;
  game: LineupShareGame;
}

interface TonightLineupShareFrameProps {
  leagueProfile: LeagueProfile;
  lineupDate: string;
  players: TonightLineupPlayer[];
  projections: Record<string, PlayerProjection>;
  startedPlayerIds: Set<string>;
  fantasyTeam: LeagueWorkspace['fantasyTeam'];
}

const POSITION_ORDER = ['C', 'LW', 'RW', 'D', 'G'];

function positionRank(player: RosterPlayer): number {
  const ranks = player.positions.map((position) => POSITION_ORDER.indexOf(position)).filter((rank) => rank >= 0);
  return ranks.length ? Math.min(...ranks) : POSITION_ORDER.length;
}

function formatLineupDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatGameTime(startTime?: string): string {
  if (!startTime || !startTime.includes('T')) return 'Time TBD';
  return new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function lineupGroup(player: RosterPlayer): 'FORWARDS' | 'DEFENSE' | 'GOALIES' {
  if (player.positions.includes('G')) return 'GOALIES';
  if (player.positions.includes('D') && !player.positions.some((position) => ['C', 'LW', 'RW'].includes(position))) return 'DEFENSE';
  return 'FORWARDS';
}

function FittedPlayerName({ name, compact }: { name: string; compact: boolean }) {
  const width = compact ? 205 : 250;
  const fontSize = compact ? 16 : 19;
  const estimatedWidth = name.length * fontSize * 0.57;
  const fittedWidth = estimatedWidth > width ? width : undefined;
  return (
    <svg viewBox={`0 0 ${width} 28`} preserveAspectRatio="xMinYMid meet" className="block h-7 w-full text-ink" aria-label={name}>
      <text
        x="0"
        y="20"
        fill="currentColor"
        fontFamily="Arial, sans-serif"
        fontSize={fontSize}
        fontWeight="800"
        textLength={fittedWidth}
        lengthAdjust={fittedWidth ? 'spacingAndGlyphs' : undefined}
      >
        {name}
      </text>
    </svg>
  );
}

function CenteredDecisionPill({ label }: { label: string }) {
  return (
    <div className="h-10 w-[190px] shrink-0 overflow-hidden rounded-full border border-accent bg-accent-muted">
      <svg viewBox="0 0 190 40" className="block size-full text-accent" aria-hidden="true">
        <text x="95" y="20" fill="currentColor" dominantBaseline="middle" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="800">
          {label}
        </text>
      </svg>
    </div>
  );
}

function MatchupTile({
  item,
  projection,
  compact = false,
}: {
  item: TonightLineupPlayer;
  projection?: PlayerProjection;
  compact?: boolean;
}) {
  const { player, game } = item;
  const fppg = projection?.fppg ?? player.seasonFppg ?? 0;
  const iceScore = projection?.iceScore ?? fppg;
  const playerId = player.id.replace(/^nhl:/, '');
  const headshotUrl = `/api/coach/share-assets/headshot/${mugshotSeason}/${player.team}/${playerId}`;
  const teamLogoUrl = `/api/coach/share-assets/logo/${player.team}`;
  const opponentLogoUrl = `/api/coach/share-assets/logo/${game.opponent}`;

  return (
    <article className={`relative flex overflow-hidden rounded-xl border border-line bg-surface-1 ${compact ? 'h-[88px] px-3 py-2' : 'h-[126px] px-4 py-3'}`}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: getTeamColor(player.team) }} />
      <div className={`relative shrink-0 ${compact ? 'size-14' : 'size-[72px]'}`}>
        <img src={headshotUrl} alt="" crossOrigin="anonymous" className="size-full rounded-full border border-line bg-surface-0 object-cover" />
        <img src={teamLogoUrl} alt="" crossOrigin="anonymous" className="absolute -bottom-0.5 -right-0.5 size-5 object-contain" />
      </div>

      <div className="ml-3 min-w-0 flex-1">
        <FittedPlayerName name={player.full_name} compact={compact} />
        <div className="mt-1 flex items-center gap-2 font-mono text-xs font-bold text-accent">
          <span>{game.isHome ? 'vs' : '@'}</span>
          <span className="relative grid size-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-0">
            <span className="font-mono text-[9px] text-ink-mute">{game.opponent}</span>
            <img src={opponentLogoUrl} alt={`${game.opponent} logo`} crossOrigin="anonymous" className="absolute inset-1 size-7 object-contain" />
          </span>
          <span className="text-sm text-ink">{game.opponent}</span>
          <span className="text-ink-mute">·</span>
          <span className="text-ink-dim">{formatGameTime(game.startTime)}</span>
        </div>
        {!compact && (
          <div className="mt-2 flex items-center gap-3 text-xs text-ink-dim">
            <span>{player.positions.join('/')} · {player.team}</span>
            <strong className="text-ink">{fppg.toFixed(2)} FPPG</strong>
            {game.isOffNight && <strong className="text-positive">OFF-NIGHT</strong>}
          </div>
        )}
      </div>

      <ShareIceRating value={iceScore} compact={compact} size={compact ? 40 : 50} />
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

export const TonightLineupShareFrame: React.FC<TonightLineupShareFrameProps> = ({
  leagueProfile,
  lineupDate,
  players,
  projections,
  startedPlayerIds,
  fantasyTeam,
}) => {
  const starters = players
    .filter(({ player }) => startedPlayerIds.has(player.id))
    .sort((a, b) => positionRank(a.player) - positionRank(b.player));
  const sits = players
    .filter(({ player }) => !startedPlayerIds.has(player.id))
    .sort((a, b) => positionRank(a.player) - positionRank(b.player));
  const projectedPoints = starters.reduce((total, { player }) => total + (getPlayerProjection(projections, player.id)?.fppg ?? player.seasonFppg ?? 0), 0);
  const offNights = starters.filter(({ game }) => game.isOffNight).length;
  const groups = (['FORWARDS', 'DEFENSE', 'GOALIES'] as const)
    .map((label) => ({ label, players: starters.filter(({ player }) => lineupGroup(player) === label) }))
    .filter((group) => group.players.length > 0);
  const useCompactTiles = players.length > 8;
  const fantasyTeamName = fantasyTeam.name.trim() || leagueProfile.league_name;

  return (
    <div className="relative flex h-[1080px] w-[1080px] flex-col overflow-hidden bg-surface-0 font-sans text-ink">
      <div className="absolute inset-0 bg-gradient-to-br from-surface-0 via-surface-1 to-surface-0" />
      <img src="/hockey-rink-bg.png" alt="" className="absolute inset-0 size-full object-cover opacity-[0.08]" />
      <div className="absolute -right-44 top-28 size-[500px] rounded-full border-2 border-line-strong opacity-25" />
      <div className="absolute right-[-30px] top-[348px] h-px w-[520px] bg-accent opacity-20" />
      <div className="absolute right-[190px] top-[122px] h-[455px] w-px bg-line-strong opacity-25" />
      <div className="absolute -bottom-40 -left-36 size-[430px] rounded-full border-2 border-line opacity-20" />

      <header className="relative flex items-center justify-between border-b border-line px-12 py-6">
        <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-10 w-auto" />
        <div className="text-right">
          <p className="scoreboard-text text-sm text-accent">TONIGHT&apos;S LINEUP</p>
          <p className="mt-1 font-mono text-sm text-ink-dim">{formatLineupDate(lineupDate)}</p>
        </div>
      </header>

      <section className="relative px-12 pb-5 pt-7">
        <p className="scoreboard-text text-accent">START / SIT CHECK</p>
        <div className="mt-2 flex items-end justify-between gap-8">
          <div className="flex min-w-0 items-center gap-4">
            {fantasyTeam.logoDataUrl && <div className="grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-line-strong bg-surface-1 p-2 shadow-card"><img src={fantasyTeam.logoDataUrl} alt="" className="size-full object-contain" /></div>}
            <div className="min-w-0">
            <h1 className="text-[40px] font-black uppercase leading-tight text-ink">WHO WOULD YOU START?</h1>
            <p className="mt-1 text-base text-ink-dim">{fantasyTeamName}{fantasyTeamName === leagueProfile.league_name ? '' : ` · ${leagueProfile.league_name}`} · {leagueProfile.preset_name ?? 'League scoring'}</p>
            </div>
          </div>
          <CenteredDecisionPill label="GAME-DAY DECISION" />
        </div>
        <div className="mt-5 grid grid-cols-4 gap-3">
          <SummaryMetric icon={<CalendarDays size={15} />} value={String(players.length)} label="PLAYING" />
          <SummaryMetric icon={<Clock3 size={15} />} value={String(starters.length)} label="STARTING" />
          <SummaryMetric icon={<Moon size={15} />} value={String(offNights)} label="OFF-NIGHTS" />
          <SummaryMetric icon={<Sparkles size={15} />} value={projectedPoints.toFixed(1)} label="PROJECTED PTS" />
        </div>
      </section>

      <main className="relative min-h-0 flex-1 px-12">
        {players.length === 0 ? (
          <div className="grid h-[500px] place-items-center rounded-2xl border border-line bg-surface-1/70 text-center">
            <div><p className="text-3xl font-black text-ink">No roster games on this slate</p><p className="mt-3 text-lg text-ink-dim">Choose another date to build a game-day card.</p></div>
          </div>
        ) : (
          <div className={`space-y-4 ${players.length <= 4 ? 'flex h-full flex-col justify-center pb-8' : ''}`}>
            {groups.map((group) => (
              <section key={group.label}>
                <div className="mb-2 flex items-center gap-3"><h2 className="scoreboard-text text-[12px] text-accent">{group.label}</h2><span className="h-px flex-1 bg-line" /></div>
                <div className={`grid gap-3 ${players.length === 1 ? 'mx-auto w-full max-w-[760px] grid-cols-1' : 'grid-cols-2'}`}>
                  {group.players.map((item) => (
                    <MatchupTile
                      key={item.player.id}
                      item={item}
                      projection={getPlayerProjection(projections, item.player.id)}
                      compact={useCompactTiles}
                    />
                  ))}
                </div>
              </section>
            ))}

            {sits.length > 0 && (
              <section className="rounded-2xl border border-warning/50 bg-warning-muted/30 p-4">
                <div className="mb-2 flex items-center justify-between"><h2 className="scoreboard-text text-[12px] text-warning">SIT / BENCH OPTIONS</h2><span className="text-xs font-bold text-warning">{sits.length} decision{sits.length === 1 ? '' : 's'}</span></div>
                <div className="grid grid-cols-2 gap-2">
                  {sits.map((item) => <MatchupTile key={item.player.id} item={item} projection={getPlayerProjection(projections, item.player.id)} compact />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="relative mx-12 mt-4 flex items-center justify-between border-t border-line py-6">
        <div>
          <p className="text-base font-black uppercase tracking-wide text-ink">WHO GETS THE START?</p>
          <p className="mt-1 text-sm text-ink-dim">Share your lineup and ask the community.</p>
        </div>
        <div className="rounded-full border border-accent bg-surface-1/90 px-5 py-2 text-sm font-bold text-accent">crackedicehockey.com</div>
      </footer>
    </div>
  );
};
