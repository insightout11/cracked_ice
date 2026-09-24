import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ArrowDownWideNarrow, CalendarDays, Moon, Repeat2, Users } from 'lucide-react';
import type { RosterPlayer } from '../lib/coachSchemas';
import { mugshotSeason } from '../lib/season';
import { isOut } from '../lib/weekPlanner';
import { headshotUrl } from './home/homeMotion';
import './home/home.css';
import { computeB2B, type DayId, type TeamWeek, type TeamWeekWithScore, type WeeklySchedule } from '../lib/schedule';
import type { ScheduleTeamOrder, ScheduleTeamScope } from '../lib/scheduleOpportunity';
import type { ScheduleOverlaySettings } from '../hooks/useScheduleOverlaySettings';
import { Button } from './ui/button';
import { TooltipLabel } from './ui/tooltip';
import { formatGameStartTime } from '../lib/schedulePlanning';

interface DayConflict {
  rosteredPlayersPlaying: number;
  activeSlots: number;
  conflictLevel: 'free' | 'tight' | 'conflict';
  color: string;
}

interface StreamingValue {
  team: string;
  extraUsableStarts: number;
  gapDatesCovered: string[];
}

interface WeeklyScheduleGridProps {
  data: WeeklySchedule;
  overlaySettings?: ScheduleOverlaySettings;
  offNightDays?: Partial<Record<DayId, boolean>>;
  gamesPerDay?: Partial<Record<DayId, number>>;
  userTeamCodes?: Set<string>;
  playerCountsByTeam?: Record<string, number>;
  /** Your players by NHL team, shown as headshots on highlighted rows. */
  rosterByTeam?: Record<string, RosterPlayer[]>;
  /** Unused active lineup spots per ISO date, after your roster is set. */
  openSlotsByDate?: Record<string, number>;
  onDayClick?: (dayId: DayId) => void;
  selectedDay?: DayId | null;
  dayConflicts?: Partial<Record<DayId, DayConflict>>;
  streamingValues?: Record<string, StreamingValue>;
  teamScope?: ScheduleTeamScope;
  teamOrder?: ScheduleTeamOrder;
  canPersonalize?: boolean;
  selectedTeam?: string | null;
  onTeamScopeChange?: (scope: ScheduleTeamScope) => void;
  onTeamOrderChange?: (order: ScheduleTeamOrder) => void;
  onTeamSelect?: (teamCode: string) => void;
}

interface TeamTotals {
  games: number;
  offNights: number;
  backToBacks: number;
}

function totalsFor(team: TeamWeek): TeamTotals {
  const backToBackDays = computeB2B(team);
  return (Object.keys(team.gamesByDay) as DayId[]).reduce<TeamTotals>((totals, day) => {
    const games = team.gamesByDay[day] ?? [];
    totals.games += games.length;
    totals.offNights += games.filter((game) => game.isOffNight).length;
    if (games.length > 0 && backToBackDays.has(day)) totals.backToBacks += 1;
    return totals;
  }, { games: 0, offNights: 0, backToBacks: 0 });
}

/** Night heat, as on Home: light nights leave lineup room (ice), packed nights block starts (red, cracked). */
function nightHeat(games: number): { tone: string; label: string; packed: boolean } {
  if (games === 0) return { tone: 'bg-surface-0', label: 'No games', packed: false };
  if (games <= 8) return { tone: 'bg-accent-muted', label: 'Light night', packed: false };
  if (games <= 12) return { tone: 'bg-surface-0', label: 'Busy night', packed: false };
  return { tone: 'bg-negative-muted', label: 'Packed night', packed: true };
}

function conflictTone(conflict?: DayConflict): string {
  if (conflict?.conflictLevel === 'conflict') return 'text-negative';
  if (conflict?.conflictLevel === 'tight') return 'text-warning';
  return 'text-positive';
}

function RosterFaces({ players, size }: { players: RosterPlayer[]; size: 'sm' | 'xs' }) {
  if (!players.length) return null;
  const shown = players.slice(0, 3);
  const box = size === 'sm' ? 'size-6' : 'size-4';
  return (
    <span className="flex shrink-0 items-center -space-x-1.5" aria-label={`Your players: ${players.map((player) => `${player.full_name}${isOut(player) ? ' (out)' : ''}`).join(', ')}`}>
      {shown.map((player) => (
        <span key={player.id} className={`relative ${box} overflow-hidden rounded-full border border-accent/60 bg-surface-2 ${isOut(player) ? 'opacity-50 grayscale' : ''}`} title={`${player.full_name}${player.injuryStatus ? ` · ${player.injuryStatus}` : ''}`}>
          <img src={headshotUrl(mugshotSeason, player.team, player.id)} alt="" loading="lazy" className="size-full object-cover" onError={(event) => { event.currentTarget.hidden = true; }} />
          {isOut(player) && <span className="absolute right-0 top-0 size-1.5 rounded-full bg-negative" aria-hidden="true" />}
        </span>
      ))}
      {players.length > shown.length && <span className={`${box} grid place-items-center rounded-full border border-line bg-surface-0 text-[9px] text-ink-dim`}>+{players.length - shown.length}</span>}
    </span>
  );
}

function TeamIdentity({ team, playerCount, players, highlighted, selected, onSelect }: { team: TeamWeek; playerCount: number; players: RosterPlayer[]; highlighted: boolean; selected: boolean; onSelect?: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`flex w-full min-w-0 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${onSelect ? 'hover:text-accent' : ''}`} aria-label={`Open ${team.teamName} players`} aria-pressed={selected}>
      <img src={team.logo} alt="" className="size-7 shrink-0 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} />
      <span className="min-w-0">
        <strong className={`block text-sm ${highlighted ? 'text-accent' : 'text-ink'}`}>{team.team}</strong>
        <span className={`${players.length ? 'hidden' : 'hidden xl:block'} truncate text-[11px] text-ink-mute`}>{team.teamName}</span>
      </span>
      <span className="ml-auto flex items-center gap-1">
        <RosterFaces players={players} size="sm" />
        {playerCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-0 px-1.5 py-0.5 text-[10px] text-ink-dim" title={`${playerCount} of your players can play`}><Users size={10} aria-hidden="true" />{playerCount}</span>}
      </span>
    </button>
  );
}

function MatchupChip({ team, day, compact }: { team: TeamWeek; day: DayId; compact?: boolean }) {
  const games = team.gamesByDay[day] ?? [];
  const backToBack = games.length > 0 && computeB2B(team).has(day);
  if (games.length === 0) return <span className="text-ink-faint" aria-label={`${team.team} does not play ${day}`}>—</span>;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {games.map((game) => (
        <TooltipLabel key={`${game.start}-${game.opponent}`} label={`${team.team} ${game.home ? 'hosts' : 'at'} ${game.opponent}${formatGameStartTime(game.start) ? ` · ${formatGameStartTime(game.start)}` : ''}${game.isOffNight ? ' · off-night' : ''}${backToBack ? ' · back-to-back' : ''}`}>
          <span className={`inline-flex items-center justify-center rounded-md border py-1 font-semibold ${compact ? `w-[1.95rem] gap-0 px-0.5 text-[9px] ${backToBack ? 'ring-1 ring-warning' : ''}` : 'min-w-[4.4rem] gap-1 px-1.5 text-xs'} ${game.isOffNight ? 'border-positive/70 bg-positive-muted text-positive' : 'border-line-strong bg-surface-2 text-ink'}`}>
            <span className="text-ink-mute">{game.home ? (compact ? 'v' : 'vs') : '@'}</span>
            <span>{game.opponent}</span>
            {backToBack && !compact && <Repeat2 size={11} className="text-warning" aria-label="Back-to-back" />}
          </span>
        </TooltipLabel>
      ))}
    </div>
  );
}

function Summary({ totals, score, opportunity, compact }: { totals: TeamTotals; score?: number; opportunity?: number; compact?: boolean }) {
  if (compact) return (
    <div className="flex flex-col items-center justify-center text-[8px] leading-tight">
      <strong className="scoreboard-number text-[10px] text-ink">{totals.games}G</strong>
      <span><span className="text-positive">O{totals.offNights}</span> <span className="text-warning">B{totals.backToBacks}</span></span>
      {opportunity !== undefined && opportunity > 0 && <span className="text-accent">+{opportunity}</span>}
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-2 text-xs">
      <strong className="scoreboard-number text-ink">{totals.games}G</strong>
      <span className="inline-flex items-center gap-0.5 text-positive"><Moon size={11} aria-hidden="true" />{totals.offNights}</span>
      <span className="inline-flex items-center gap-0.5 text-warning"><Repeat2 size={11} aria-hidden="true" />{totals.backToBacks}</span>
      {opportunity !== undefined && opportunity > 0 && <span className="rounded-full bg-accent-muted px-1.5 py-0.5 text-accent">+{opportunity}</span>}
      {score !== undefined && <span className="text-ink-mute">{score.toFixed(0)}</span>}
    </div>
  );
}

export function WeeklyScheduleGrid({
  data,
  overlaySettings = {
    showOffNightIndicators: true,
    highlightUserTeams: false,
    showPlayerCounts: false,
    filterUserTeamsOnly: false,
    showConflictOverlay: false,
    showStreamingValue: false,
  },
  offNightDays = {},
  gamesPerDay = {},
  userTeamCodes = new Set(),
  playerCountsByTeam = {},
  rosterByTeam = {},
  openSlotsByDate,
  onDayClick,
  selectedDay = null,
  dayConflicts = {},
  streamingValues = {},
  teamScope = 'league',
  teamOrder = 'schedule',
  canPersonalize = false,
  selectedTeam = null,
  onTeamScopeChange,
  onTeamOrderChange,
  onTeamSelect,
}: WeeklyScheduleGridProps) {
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');
  const summaries = useMemo(() => new Map(data.teams.map((team) => [team.team, totalsFor(team)])), [data.teams]);
  const dayDates = useMemo(() => data.days.map((_, index) => format(addDays(parseISO(data.weekOf), index), 'yyyy-MM-dd')), [data.days, data.weekOf]);
  const showOpenSlots = openSlotsByDate !== undefined;
  // No NHL games that night means nothing to stream, so an open spot there isn't worth showing.
  const openFor = (date: string, index: number) => ((gamesPerDay[data.days[index].id] ?? 0) > 0 ? openSlotsByDate?.[date] : undefined);
  const facesFor = (team: string, highlighted: boolean) => (highlighted ? rosterByTeam[team] ?? [] : []);

  if (!data.teams.length) return <p className="rounded-md border border-line bg-surface-1 p-6 text-center text-ink-dim">No schedule data is available for this week.</p>;

  return (
    <section className="weekly-schedule-container overflow-hidden rounded-xl border border-line-strong bg-surface-1" aria-label="Weekly NHL schedule">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-line bg-surface-0 p-1" aria-label="Schedule teams">
            <Button size="sm" className="min-h-11" variant={teamScope === 'league' ? 'primary' : 'ghost'} aria-pressed={teamScope === 'league'} onClick={() => onTeamScopeChange?.('league')}>League</Button>
            <Button size="sm" className="min-h-11" variant={teamScope === 'roster' ? 'primary' : 'ghost'} aria-pressed={teamScope === 'roster'} disabled={!canPersonalize} onClick={() => onTeamScopeChange?.('roster')}><Users size={13} aria-hidden="true" />My roster</Button>
          </div>
          <div className="flex gap-1 rounded-lg border border-line bg-surface-0 p-1" aria-label="Schedule order">
            <Button size="sm" className="min-h-11" variant={teamOrder === 'schedule' ? 'primary' : 'ghost'} aria-pressed={teamOrder === 'schedule'} onClick={() => onTeamOrderChange?.('schedule')}>Current sort</Button>
            <Button size="sm" className="min-h-11" variant={teamOrder === 'opportunity' ? 'primary' : 'ghost'} aria-pressed={teamOrder === 'opportunity'} disabled={!canPersonalize} onClick={() => onTeamOrderChange?.('opportunity')}><ArrowDownWideNarrow size={13} aria-hidden="true" />Opportunity</Button>
          </div>
          {!canPersonalize && <span className="text-[11px] text-ink-mute">Add a roster to unlock personalized ordering.</span>}
        </div>
        <div className="hidden gap-1 lg:flex" aria-label="Schedule density">
          <Button size="sm" variant={density === 'compact' ? 'primary' : 'ghost'} aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>Compact</Button>
          <Button size="sm" variant={density === 'comfortable' ? 'primary' : 'ghost'} aria-pressed={density === 'comfortable'} onClick={() => setDensity('comfortable')}>Comfortable</Button>
        </div>
      </header>
      <aside className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2 text-[11px] text-ink-dim" aria-label="Schedule legend">
          <span className="inline-flex items-center gap-1"><span className="size-3 rounded-sm border border-accent/40 bg-accent-muted" aria-hidden="true" />Light night (8 or fewer games)</span>
          <span className="inline-flex items-center gap-1"><span className="ice-cracks size-3 rounded-sm border border-negative/50 bg-negative-muted" aria-hidden="true" />Packed night (13+)</span>
          <span className="inline-flex items-center gap-1"><Moon size={12} className="text-positive" aria-hidden="true" />Off-night game</span>
          <span className="inline-flex items-center gap-1"><Repeat2 size={12} className="text-warning" aria-hidden="true" />Back-to-back</span>
          {showOpenSlots && <span className="inline-flex items-center gap-1"><span className="led-numeral led-amber text-sm" aria-hidden="true">2</span>Your open lineup spots</span>}
          {overlaySettings.showStreamingValue && <span className="inline-flex items-center gap-1"><CalendarDays size={12} className="text-accent" aria-hidden="true" />Usable roster starts</span>}
          <span className="ml-auto text-ink-mute">Select a team to inspect its players.</span>
      </aside>

      <div className="weekly-schedule-scroll hidden max-h-[760px] overflow-auto lg:block">
        <table className="w-full min-w-[64rem] table-fixed border-collapse text-left">
          <caption className="sr-only">All 32 NHL teams and their games for the selected week</caption>
          <colgroup><col className="w-40" />{data.days.map((day) => <col key={day.id} />)}<col className="w-40" /></colgroup>
          <thead className="sticky top-0 z-30 bg-surface-0 shadow-card">
            <tr>
              <th className="sticky left-0 z-40 border-b border-r border-line bg-surface-0 px-3 py-2 text-xs uppercase tracking-wide text-accent">Team</th>
              {data.days.map((day) => {
                const conflict = dayConflicts[day.id];
                const games = gamesPerDay[day.id] ?? 0;
                const heat = nightHeat(games);
                return (
                  <th key={day.id} className={`border-b border-line px-1 py-2 text-center ${heat.tone} ${heat.packed ? 'ice-cracks' : ''} ${selectedDay === day.id ? 'shadow-[inset_0_-3px_0_var(--accent)]' : ''}`}>
                    <button type="button" onClick={() => onDayClick?.(day.id)} className="w-full rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-pressed={selectedDay === day.id} aria-label={`${day.id} ${day.date}: ${games} games, ${heat.label.toLowerCase()}. Sort teams by this day.`}>
                      <span className="block text-xs font-semibold text-ink">{day.id} <span className="text-ink-mute">{day.date}</span></span>
                      <span className={`mt-0.5 flex items-center justify-center gap-1 text-[10px] ${heat.packed ? 'text-negative' : games > 0 && games <= 8 ? 'text-accent' : 'text-ink-mute'}`}><strong className="scoreboard-number">{games}</strong> games{offNightDays[day.id] && <Moon size={10} className="text-positive" aria-label="Off-night" />}{overlaySettings.showConflictOverlay && conflict && <span className={conflictTone(conflict)}>{conflict.rosteredPlayersPlaying}/{conflict.activeSlots}</span>}</span>
                    </button>
                  </th>
                );
              })}
              <th className="border-b border-l border-line px-2 py-2 text-center text-xs uppercase tracking-wide text-accent">Week</th>
            </tr>
            {showOpenSlots && (
              <tr className="jumbotron">
                <th scope="row" className="sticky left-0 z-40 border-b border-r border-line bg-surface-0 px-3 py-1.5 text-left text-xs font-semibold text-warning">Your open slots</th>
                {dayDates.map((date, index) => {
                  const open = openFor(date, index);
                  return (
                    <td key={date} className="border-b border-line py-1.5 text-center" aria-label={open === undefined ? `${data.days[index].id}: no games or outside the planning window` : `${data.days[index].id}: ${open} open lineup ${open === 1 ? 'spot' : 'spots'}`}>
                      {open === undefined ? <span className="text-[10px] text-ink-faint">·</span> : open > 0 ? <span className="led-numeral led-amber text-xl">{open}</span> : <span className="text-[10px] text-ink-mute">Full</span>}
                    </td>
                  );
                })}
                <td className="border-b border-l border-line py-1.5 text-center text-[10px] text-ink-mute">{dayDates.reduce((sum, date, index) => sum + (openFor(date, index) ?? 0), 0)} open</td>
              </tr>
            )}
          </thead>
          <tbody>
            {data.teams.map((team, index) => {
              const highlighted = overlaySettings.highlightUserTeams && userTeamCodes.has(team.team);
              const metrics = (team as TeamWeekWithScore).metrics;
              return (
                <tr key={team.team} className={`${highlighted ? 'bg-accent-muted' : index % 2 ? 'bg-surface-2/50' : 'bg-surface-1'} border-b border-line last:border-0`}>
                  <th scope="row" className={`sticky left-0 z-10 border-r border-line px-3 ${density === 'compact' ? 'h-12 py-1' : 'h-16 py-2'} ${selectedTeam === team.team ? 'bg-accent-muted' : highlighted ? 'bg-surface-raised' : index % 2 ? 'bg-surface-2' : 'bg-surface-1'}`}><TeamIdentity team={team} playerCount={overlaySettings.showPlayerCounts ? playerCountsByTeam[team.team] ?? 0 : 0} players={facesFor(team.team, highlighted)} highlighted={highlighted} selected={selectedTeam === team.team} onSelect={onTeamSelect ? () => onTeamSelect(team.team) : undefined} /></th>
                  {data.days.map((day) => <td key={day.id} className={`border-r border-line px-1 text-center ${selectedDay === day.id ? 'bg-accent-muted' : ''}`}><MatchupChip team={team} day={day.id} /></td>)}
                  <td className="border-l border-line px-2"><Summary totals={summaries.get(team.team) ?? { games: 0, offNights: 0, backToBacks: 0 }} score={metrics?.scheduleScore} opportunity={overlaySettings.showStreamingValue ? streamingValues[team.team]?.extraUsableStarts : undefined} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-schedule-grid divide-y divide-line lg:hidden">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))_3.25rem] items-center bg-surface-0 px-1 py-2 text-center text-[9px] uppercase tracking-wide text-accent">
          <span>Team</span>{data.days.map((day) => {
            const heat = nightHeat(gamesPerDay[day.id] ?? 0);
            return <button key={day.id} type="button" onClick={() => onDayClick?.(day.id)} className={`rounded py-1 ${heat.tone} ${heat.packed ? 'ice-cracks' : ''} ${selectedDay === day.id ? 'ring-1 ring-accent' : ''}`} aria-pressed={selectedDay === day.id} aria-label={`${day.id} ${day.date}: ${gamesPerDay[day.id] ?? 0} games, ${heat.label.toLowerCase()}`}><span className="block">{day.id.slice(0, 2)}</span><span className="text-ink-mute">{day.date}</span><span className={`block normal-case ${heat.packed ? 'text-negative' : 'text-ink-dim'}`}>{gamesPerDay[day.id] ?? 0}g</span></button>;
          })}<span>Total</span>
        </div>
        {showOpenSlots && (
          <div className="jumbotron grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))_3.25rem] items-center px-1 py-1.5 text-center">
            <span className="text-left text-[9px] font-semibold leading-tight text-warning">Open slots</span>
            {dayDates.map((date, index) => {
              const open = openFor(date, index);
              return <span key={date}>{open === undefined ? <span className="text-[9px] text-ink-faint">·</span> : open > 0 ? <span className="led-numeral led-amber text-base">{open}</span> : <span className="text-[9px] text-ink-mute">Full</span>}</span>;
            })}
            <span className="text-[9px] text-ink-mute">{dayDates.reduce((sum, date, index) => sum + (openFor(date, index) ?? 0), 0)}</span>
          </div>
        )}
        {data.teams.map((team, index) => {
          const highlighted = overlaySettings.highlightUserTeams && userTeamCodes.has(team.team);
          return (
            <div key={team.team} className={`grid min-h-11 grid-cols-[3.5rem_repeat(7,minmax(0,1fr))_3.25rem] items-center px-1 ${highlighted ? 'bg-accent-muted' : index % 2 ? 'bg-surface-2/50' : 'bg-surface-1'}`}>
              <button type="button" onClick={() => onTeamSelect?.(team.team)} className={`flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selectedTeam === team.team ? 'bg-accent-muted' : ''}`} aria-label={`Open ${team.teamName} players`} aria-pressed={selectedTeam === team.team}><img src={team.logo} alt="" className="size-5 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} /><strong className={highlighted ? 'text-[10px] text-accent' : 'text-[10px] text-ink'}>{team.team}</strong></button>
              {data.days.map((day) => <div key={day.id} className={`flex justify-center ${selectedDay === day.id ? 'bg-accent-muted' : ''}`}><MatchupChip team={team} day={day.id} compact /></div>)}
              <Summary totals={summaries.get(team.team) ?? { games: 0, offNights: 0, backToBacks: 0 }} opportunity={overlaySettings.showStreamingValue ? streamingValues[team.team]?.extraUsableStarts : undefined} compact />
            </div>
          );
        })}
      </div>
    </section>
  );
}
