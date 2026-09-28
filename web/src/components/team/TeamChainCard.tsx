import { useState } from 'react';
import { CalendarRange, ChevronDown, Sun, X } from 'lucide-react';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import { canFillSlot } from '../../lib/acquisitionAnalysis';
import { canPlaySoon, likelyOwnedPlayerIds } from '../../lib/pickupCandidateDiscovery';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { getTeamLogoUrl, TEAM_NICKNAMES } from '../../lib/teamLogos';
import type { TeamChain, TeamChainLeg, TeamChainResult } from '../../lib/weekPlanner';
import { toRosterPlayer } from '../../hooks/useAcquisitionRecommendations';
import { PlayerNameLink } from './PlayerNameLink';

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const nickname = (team: string) => TEAM_NICKNAMES[team] ?? team;

function weekday(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function dayList(dates: string[]): string {
  return dates.map(weekday).join(', ');
}

/** The first move of the chain also frees the roster place. */
function firstMoveNote(chains: TeamChainResult): string {
  const { spot } = chains;
  if (spot.kind === 'stream' && spot.holder) return ` · drop ${spot.holder.full_name}`;
  if (spot.kind === 'ir' && spot.holder) return ` · move ${spot.holder.full_name} to IR first`;
  return '';
}

/** Players from one team who can fill the position: likely available first, then by FPPG. */
function TeamPlayers({ team, position, players, roster, workspace, onOpenPlayer }: { team: string; position: string; players: PlayerSearchResult[]; roster: RosterPlayer[]; workspace: LeagueWorkspace; onOpenPlayer?: (player: RosterPlayer) => void }) {
  const rostered = new Set(roster.map((player) => normalizeId(player.id)));
  const owned = new Set(likelyOwnedPlayerIds(workspace, players).map(normalizeId));
  const hidden = new Set(workspace.candidates.filter((candidate) => candidate.status === 'taken' || candidate.preference?.dismissed).map((candidate) => normalizeId(candidate.playerId)));
  const options = players
    .filter((player) => player.team === team && !rostered.has(normalizeId(player.id)) && !hidden.has(normalizeId(player.id)))
    .map((player) => ({ player, rosterPlayer: toRosterPlayer(player), likelyOwned: owned.has(normalizeId(player.id)) }))
    .filter(({ rosterPlayer }) => canFillSlot(rosterPlayer, position))
    .sort((a, b) => Number(a.likelyOwned) - Number(b.likelyOwned) || (b.player.blendedFppg ?? 0) - (a.player.blendedFppg ?? 0))
    .slice(0, 6);
  if (!options.length) return <p className="text-[11px] text-ink-mute">No {nickname(team)} {position} found in the player list.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {options.map(({ player, rosterPlayer, likelyOwned }) => (
        <li key={player.id} className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-ink"><PlayerNameLink player={rosterPlayer} onOpen={onOpenPlayer} /> <span className="text-ink-mute">{player.pos.join('/')}</span></span>
          <span className="shrink-0 text-[11px] text-ink-mute">{(player.blendedFppg ?? 0).toFixed(2)} FPPG{likelyOwned ? ' · likely taken' : ''}</span>
        </li>
      ))}
    </ul>
  );
}

const fullWeekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

/**
 * Sunday heroes: likely-free players who play the week's last day at a position your
 * lineup has room for, ranked by that game plus next week's. Add one with a spare add:
 * he starts that night and is already on your roster when next week's adds reset.
 */
function LastDayHeroes({ chains, workspace, roster, players, onOpenPlayer }: { chains: TeamChainResult; workspace: LeagueWorkspace; roster: RosterPlayer[]; players: PlayerSearchResult[]; onOpenPlayer?: (player: RosterPlayer) => void }) {
  const lastDay = chains.lastDay;
  if (!lastDay || !lastDay.teams.length) return null;
  const open = chains.positions.filter((item) => item.room[lastDay.date]).map((item) => item.position);
  if (!open.length) return null;
  const nextWeek = new Map(lastDay.teams.map((entry) => [entry.team, entry.nextWeekGames]));
  const rostered = new Set(roster.map((player) => normalizeId(player.id)));
  const owned = new Set(likelyOwnedPlayerIds(workspace, players).map(normalizeId));
  const hidden = new Set(workspace.candidates.filter((candidate) => candidate.status === 'taken' || candidate.preference?.dismissed).map((candidate) => normalizeId(candidate.playerId)));
  const heroes = players
    .filter((player) => nextWeek.has(player.team) && canPlaySoon(player) && !rostered.has(normalizeId(player.id)) && !owned.has(normalizeId(player.id)) && !hidden.has(normalizeId(player.id)))
    .map((player) => ({ player, rosterPlayer: toRosterPlayer(player), games: 1 + (nextWeek.get(player.team)?.length ?? 0) }))
    .filter(({ rosterPlayer }) => open.some((position) => canFillSlot(rosterPlayer, position)))
    .map((entry) => ({ ...entry, points: (entry.player.blendedFppg ?? 0) * entry.games }))
    .sort((a, b) => b.points - a.points || a.player.name.localeCompare(b.player.name))
    .slice(0, 6);
  const day = fullWeekday(lastDay.date);
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Sun size={15} className="text-accent" aria-hidden="true" />{day} heroes</p>
      <p className="mt-0.5 text-xs text-ink-dim">Your lineup has room {day} at {open.join(', ')}. A spare add on one of these starts that night and keeps counting next week, when your adds reset.</p>
      {heroes.length ? (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {heroes.map(({ player, rosterPlayer, games, points }) => (
            <li key={player.id} className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-0 px-2.5 py-1.5 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <img src={getTeamLogoUrl(player.team)} alt="" className="size-4 shrink-0 object-contain" />
                <span className="truncate text-ink"><PlayerNameLink player={rosterPlayer} onOpen={onOpenPlayer} /></span>
                <span className="shrink-0 text-ink-mute">{player.pos.join('/')}</span>
              </span>
              <span className="shrink-0 text-right text-[11px] text-ink-dim">{weekday(lastDay.date)} + {games - 1} next week · <strong className="text-positive">~{points.toFixed(1)}</strong> pts</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-ink-mute">No likely-free players found for those spots.</p>}
    </div>
  );
}

function LegRow({ leg, dates, room, open, onToggle }: { leg: TeamChainLeg; dates: string[]; room: Record<string, boolean>; open: boolean; onToggle: () => void }) {
  return (
    <div role="row" className="contents">
      <div role="rowheader" className="py-1 pr-2">
        <button type="button" onClick={onToggle} aria-expanded={open} className={`keep-flex flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs font-semibold text-ink hover:border-accent ${open ? 'border-accent bg-accent-muted' : 'border-line bg-surface-0'}`} title={`Show ${nickname(leg.team)} players`}>
          <img src={getTeamLogoUrl(leg.team)} alt="" className="size-5 shrink-0 object-contain" />
          <span>{leg.team}</span>
          <ChevronDown size={12} className={`ml-auto shrink-0 text-ink-mute transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {dates.map((date) => {
        const inLeg = date >= leg.from && date <= leg.to;
        const plays = leg.gameDates.includes(date);
        const starts = leg.startDates.includes(date);
        return (
          <div role="cell" key={date} className={`flex items-center justify-center py-1 ${inLeg ? 'bg-accent-muted' : ''} ${date === leg.from ? 'rounded-l-md' : ''} ${date === leg.to ? 'rounded-r-md' : ''}`}>
            {plays && inLeg && (
              <span
                className={`block size-3 rounded-full ${starts ? 'bg-accent' : 'border-2 border-ink-mute'}`}
                aria-label={starts ? 'starts' : room[date] ? 'plays' : 'plays, lineup full'}
                title={starts ? 'Starts for you' : 'Plays, but your lineup is full that night'}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TeamChainCard({ chains, workspace, roster, players, onOpenPlayer, skipTeams = [], onSkipTeam, onUnskipTeam }: {
  chains: TeamChainResult;
  workspace: LeagueWorkspace;
  roster: RosterPlayer[];
  /** The player directory, for the names behind each team. */
  players: PlayerSearchResult[];
  onOpenPlayer?: (player: RosterPlayer) => void;
  /** Teams left out because their players are all taken ("picked dry"). */
  skipTeams?: string[];
  onSkipTeam?: (team: string) => void;
  onUnskipTeam?: (team: string) => void;
}) {
  // Default: the position with the most starts from its longest chain.
  const bestPosition = [...chains.positions].sort((a, b) => b.chains[b.chains.length - 1].starts - a.chains[a.chains.length - 1].starts)[0];
  const [positionChoice, setPositionChoice] = useState<string | null>(null);
  const [addsChoice, setAddsChoice] = useState<number | null>(null);
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const [optionChoice, setOptionChoice] = useState(0);
  const current = chains.positions.find((item) => item.position === positionChoice) ?? bestPosition;
  const best: TeamChain = current.chains.find((item) => item.adds === addsChoice) ?? current.chains[current.chains.length - 1];
  // Runner-up chains with other teams, for when one team's players are all taken.
  const options = current.options?.[current.chains.indexOf(best)] ?? [best];
  const chain: TeamChain = options[optionChoice] ?? options[0];
  const bridge = chains.bridgeTeams.filter((team) => !chain.legs.some((leg) => leg.team === team)).slice(0, 3);
  const lastLegPlaysNextWeek = chains.bridgeTeams.includes(chain.legs[chain.legs.length - 1].team);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><CalendarRange size={15} className="text-accent" aria-hidden="true" />Stream by team</p>
          <p className="mt-0.5 text-xs text-ink-dim">Grab any healthy {current.position} from each team on these days. No player list needed; tap a team to see names.</p>
        </div>
        <p className="shrink-0 text-sm text-ink"><strong className="scoreboard-number text-xl text-positive">+{chain.starts}</strong> lineup starts</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {chains.positions.length > 1 && (
          <div className="flex gap-1" role="group" aria-label="Position to stream">
            {chains.positions.map((item) => (
              <button key={item.position} type="button" aria-pressed={item === current} onClick={() => { setPositionChoice(item.position); setOptionChoice(0); setOpenTeam(null); }} className={`rounded-md border px-2 py-1 text-xs font-semibold ${item === current ? 'border-accent bg-accent-muted text-ink' : 'border-line bg-surface-0 text-ink-dim hover:border-accent/60'}`}>
                {item.position} <span className="font-normal text-ink-mute">+{item.chains[item.chains.length - 1].starts}</span>
              </button>
            ))}
          </div>
        )}
        {current.chains.length > 1 && (
          <div className="flex gap-1" role="group" aria-label="Number of adds">
            {current.chains.map((item) => (
              <button key={item.adds} type="button" aria-pressed={item === best} onClick={() => { setAddsChoice(item.adds); setOptionChoice(0); setOpenTeam(null); }} className={`rounded-md border px-2 py-1 text-xs font-semibold ${item === best ? 'border-accent bg-accent-muted text-ink' : 'border-line bg-surface-0 text-ink-dim hover:border-accent/60'}`}>
                {item.adds} add{item.adds === 1 ? '' : 's'} <span className="font-normal text-ink-mute">+{item.starts}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {options.length > 1 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-label="Stream options">
          {options.map((option, index) => (
            <button
              key={option.legs.map((leg) => leg.team).join('-')}
              type="button"
              aria-pressed={option === chain}
              onClick={() => { setOptionChoice(index); setOpenTeam(null); }}
              className={`keep-flex flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left ${option === chain ? 'border-accent bg-accent-muted' : 'border-line bg-surface-0 hover:border-accent/60'}`}
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold text-ink-mute">{index === 0 ? 'Best' : `Option ${index + 1}`}</span>
                <span className="mt-1 flex items-center gap-1">
                  {option.legs.map((leg) => (
                    <span key={leg.team} className="flex items-center gap-0.5 text-[11px] font-semibold text-ink"><img src={getTeamLogoUrl(leg.team)} alt="" className="size-4 object-contain" />{leg.team}</span>
                  ))}
                </span>
              </span>
              <span className="scoreboard-number shrink-0 text-sm text-positive">+{option.starts}</span>
            </button>
          ))}
        </div>
      )}

      {skipTeams.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute">
          <span>Skipping, picked dry:</span>
          {skipTeams.map((team) => (
            <button key={team} type="button" onClick={() => onUnskipTeam?.(team)} className="keep-flex flex items-center gap-1 rounded-full border border-line bg-surface-0 px-2 py-0.5 text-ink-dim hover:border-accent hover:text-ink" aria-label={`Use ${nickname(team)} again`} title="Use them again">
              {team}<X size={11} aria-hidden="true" />
            </button>
          ))}
        </p>
      )}

      <div role="table" aria-label={`${current.position} stream by team`} className="mt-3 grid items-stretch" style={{ gridTemplateColumns: `minmax(4.5rem, 6rem) repeat(${chains.dates.length}, minmax(0, 1fr))` }}>
        <div role="row" className="contents">
          <div role="columnheader" className="text-[10px] text-ink-mute">Room for a {current.position}</div>
          {chains.dates.map((date) => (
            <div role="columnheader" key={date} className="flex flex-col items-center pb-1 text-[11px] font-semibold text-ink-dim">
              <span>{weekday(date)}</span>
              <span className={`mt-0.5 h-1 w-5 rounded-full ${current.room[date] ? 'bg-positive' : 'bg-line'}`} title={current.room[date] ? 'Your lineup has room' : 'Your lineup is full'} aria-label={current.room[date] ? 'room' : 'full'} />
            </div>
          ))}
        </div>
        {chain.legs.map((leg) => (
          <LegRow key={leg.team} leg={leg} dates={chains.dates} room={current.room} open={openTeam === leg.team} onToggle={() => setOpenTeam((team) => (team === leg.team ? null : leg.team))} />
        ))}
      </div>

      {openTeam && (
        <div className="mt-2 rounded-md border border-line bg-surface-0 p-2.5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-ink-dim">{nickname(openTeam)} who can play {current.position}: check who's free in your league</p>
            {onSkipTeam && <button type="button" onClick={() => { onSkipTeam(openTeam); setOpenTeam(null); setOptionChoice(0); }} className="rounded-md border border-line px-2 py-0.5 text-[11px] font-semibold text-ink-dim hover:border-warning hover:text-warning">Picked dry: skip {nickname(openTeam)}</button>}
          </div>
          <TeamPlayers team={openTeam} position={current.position} players={players} roster={roster} workspace={workspace} onOpenPlayer={onOpenPlayer} />
        </div>
      )}

      <ol className="mt-3 space-y-1 text-xs text-ink">
        {chain.legs.map((leg, index) => (
          <li key={leg.team} className="flex flex-wrap gap-x-1.5">
            <strong>{weekday(leg.actionDate)}:</strong>
            <span>{index === 0 ? 'add' : 'swap to'} any {nickname(leg.team)} {current.position}{index === 0 ? firstMoveNote(chains) : ''}</span>
            <span className="text-ink-mute">· starts {leg.startDates.length ? dayList(leg.startDates) : 'no nights'}{leg.alternatives.length ? ` · same value: ${leg.alternatives.join(', ')}` : ''}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-ink-mute">
        Dots: filled, he starts for you; hollow, his team plays but your lineup is full.
        {lastLegPlaysNextWeek ? ` Keep the last one: ${nickname(chain.legs[chain.legs.length - 1].team)} also play next Monday.` : bridge.length ? ` Spare add at the end of the week? ${bridge.map(nickname).join(', ')} play Sunday and next Monday.` : ''}
      </p>

      <LastDayHeroes chains={chains} workspace={workspace} roster={roster} players={players} onOpenPlayer={onOpenPlayer} />
    </div>
  );
}
