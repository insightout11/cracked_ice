import { useState } from 'react';
import { CalendarRange, ChevronDown } from 'lucide-react';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import { canFillSlot } from '../../lib/acquisitionAnalysis';
import { likelyOwnedPlayerIds } from '../../lib/pickupCandidateDiscovery';
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

function LegRow({ leg, dates, room, open, onToggle }: { leg: TeamChainLeg; dates: string[]; room: Record<string, boolean>; open: boolean; onToggle: () => void }) {
  return (
    <div role="row" className="contents">
      <div role="rowheader" className="py-1 pr-2">
        <button type="button" onClick={onToggle} aria-expanded={open} className={`flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs font-semibold text-ink hover:border-accent ${open ? 'border-accent bg-accent-muted' : 'border-line bg-surface-0'}`} title={`Show ${nickname(leg.team)} players`}>
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

export function TeamChainCard({ chains, workspace, roster, players, onOpenPlayer }: {
  chains: TeamChainResult;
  workspace: LeagueWorkspace;
  roster: RosterPlayer[];
  /** The player directory, for the names behind each team. */
  players: PlayerSearchResult[];
  onOpenPlayer?: (player: RosterPlayer) => void;
}) {
  // Default: the position with the most starts from its longest chain.
  const bestPosition = [...chains.positions].sort((a, b) => b.chains[b.chains.length - 1].starts - a.chains[a.chains.length - 1].starts)[0];
  const [positionChoice, setPositionChoice] = useState<string | null>(null);
  const [addsChoice, setAddsChoice] = useState<number | null>(null);
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const current = chains.positions.find((item) => item.position === positionChoice) ?? bestPosition;
  const chain: TeamChain = current.chains.find((item) => item.adds === addsChoice) ?? current.chains[current.chains.length - 1];
  const bridge = chains.bridgeTeams.filter((team) => !chain.legs.some((leg) => leg.team === team)).slice(0, 3);
  const lastLegPlaysNextWeek = chains.bridgeTeams.includes(chain.legs[chain.legs.length - 1].team);

  return (
    <div className="rounded-md border border-accent/50 bg-surface-2 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><CalendarRange size={15} className="text-accent" aria-hidden="true" />Your best stream, by team</p>
          <p className="mt-0.5 text-xs text-ink-dim">Grab any healthy {current.position} from each team on these days. No player list needed; tap a team to see names.</p>
        </div>
        <p className="shrink-0 text-sm text-ink"><strong className="scoreboard-number text-xl text-positive">+{chain.starts}</strong> lineup starts</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {chains.positions.length > 1 && (
          <div className="flex gap-1" role="group" aria-label="Position to stream">
            {chains.positions.map((item) => (
              <button key={item.position} type="button" aria-pressed={item === current} onClick={() => { setPositionChoice(item.position); setOpenTeam(null); }} className={`rounded-md border px-2 py-1 text-xs font-semibold ${item === current ? 'border-accent bg-accent-muted text-ink' : 'border-line bg-surface-0 text-ink-dim hover:border-accent/60'}`}>
                {item.position} <span className="font-normal text-ink-mute">+{item.chains[item.chains.length - 1].starts}</span>
              </button>
            ))}
          </div>
        )}
        {current.chains.length > 1 && (
          <div className="flex gap-1" role="group" aria-label="Number of adds">
            {current.chains.map((item) => (
              <button key={item.adds} type="button" aria-pressed={item === chain} onClick={() => { setAddsChoice(item.adds); setOpenTeam(null); }} className={`rounded-md border px-2 py-1 text-xs font-semibold ${item === chain ? 'border-accent bg-accent-muted text-ink' : 'border-line bg-surface-0 text-ink-dim hover:border-accent/60'}`}>
                {item.adds} add{item.adds === 1 ? '' : 's'} <span className="font-normal text-ink-mute">+{item.starts}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
          <p className="mb-1.5 text-[11px] font-semibold text-ink-dim">{nickname(openTeam)} who can play {current.position}: check who's free in your league</p>
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
    </div>
  );
}
