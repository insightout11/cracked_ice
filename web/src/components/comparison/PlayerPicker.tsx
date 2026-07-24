import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { DraftPlayer } from '../../lib/playerSearch';
import { rankPlayerMatches } from '../../lib/playerSearch';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface PlayerPickerProps {
  label: string;
  players: DraftPlayer[];
  selected: DraftPlayer | null;
  excludeId?: string;
  onSelect: (player: DraftPlayer | null) => void;
}

export function PlayerPicker({ label, players, selected, excludeId, onSelect }: PlayerPickerProps) {
  const [query, setQuery] = useState(selected?.name ?? '');
  const matches = useMemo(() => query.trim().length >= 2 && !selected
    ? rankPlayerMatches(players.filter((player) => player.id !== excludeId), query, 8)
    : [], [excludeId, players, query, selected]);

  useEffect(() => {
    setQuery(selected?.name ?? '');
  }, [selected?.id, selected?.name]);

  return (
    <div className="relative">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-mute">{label}</label>
      <div className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface-0 px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
        {selected ? <img src={getTeamLogoUrl(selected.team)} alt="" className="size-8 object-contain" /> : <Search size={18} className="shrink-0 text-ink-mute" aria-hidden="true" />}
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); if (selected) onSelect(null); }}
          placeholder="Search a player…"
          className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-mute"
          aria-label={label}
          autoComplete="off"
        />
        {selected && <button type="button" onClick={() => { setQuery(''); onSelect(null); }} className="rounded-md p-2 text-ink-mute hover:bg-surface-2 hover:text-ink" aria-label={`Clear ${label}`}><X size={16} /></button>}
      </div>
      {matches.length > 0 && <div className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-line-strong bg-surface-raised p-1 shadow-card">
        {matches.map((player) => <button key={player.id} type="button" onClick={() => onSelect(player)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <img src={getTeamLogoUrl(player.team)} alt="" className="size-7 object-contain" />
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{player.name}</strong><span className="text-xs text-ink-mute">{player.team} · {player.pos.join('/')}</span></span>
          <span className="font-mono text-xs text-accent">{player.blendedFppg?.toFixed(2) ?? '—'} FPPG</span>
        </button>)}
      </div>}
    </div>
  );
}
