import { useMemo, useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { previewManualDraftImport, type ManualDraftImportRow } from '../../lib/draftManualTracking';
import type { DraftPlayer } from '../../lib/playerSearch';

interface KeeperIntakePanelProps {
  players: DraftPlayer[];
  unavailableIds: Set<string>;
  myKeeperIds: Set<string>;
  hasDraftPosition: boolean;
  onApplyMyKeepers: (players: DraftPlayer[], reserveFinalPicks: boolean) => void;
  onApplyOpponentKeepers: (players: DraftPlayer[]) => void;
  onClearOpponentKeepers: () => void;
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

export function KeeperIntakePanel({ players, unavailableIds, myKeeperIds, hasDraftPosition, onApplyMyKeepers, onApplyOpponentKeepers, onClearOpponentKeepers }: KeeperIntakePanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'mine' | 'opponents'>('opponents');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ManualDraftImportRow[] | null>(null);
  const [reserveFinalPicks, setReserveFinalPicks] = useState(true);
  const alreadyUnavailable = useMemo(() => new Set([...unavailableIds, ...myKeeperIds]), [myKeeperIds, unavailableIds]);
  const matched = preview?.filter((row) => row.state === 'matched' && row.player).map((row) => row.player!) ?? [];

  const review = () => setPreview(previewManualDraftImport(text, players, alreadyUnavailable));
  const apply = () => {
    if (mode === 'mine') onApplyMyKeepers(matched, reserveFinalPicks && hasDraftPosition);
    else onApplyOpponentKeepers(matched);
    const unresolved = preview?.filter((row) => row.state === 'unresolved').map((row) => row.raw) ?? [];
    setText(unresolved.join('\n'));
    setPreview(null);
    if (!unresolved.length) setOpen(false);
  };

  return <section className="overflow-hidden rounded-xl border border-line bg-surface-1" aria-label="Keeper draft setup">
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"><span><strong className="flex items-center gap-2 text-sm text-ink"><ShieldCheck size={15} className="text-accent" />Keeper setup</strong><span className="mt-0.5 block text-[10px] text-ink-mute">{myKeeperIds.size} mine · {unavailableIds.size} league-mate keepers removed from the pool</span></span><span className="text-xs font-semibold text-accent">{open ? 'Close' : 'Bulk add'}</span></button>
    {open && <div className="border-t border-line p-4">
      <div className="inline-flex rounded-lg border border-line bg-surface-0 p-1" aria-label="Keeper owner"><button type="button" aria-pressed={mode === 'opponents'} onClick={() => { setMode('opponents'); setPreview(null); }} className={`rounded-md px-3 py-2 text-xs font-semibold ${mode === 'opponents' ? 'bg-accent text-accent-ink' : 'text-ink-dim'}`}>League-mate keepers</button><button type="button" aria-pressed={mode === 'mine'} onClick={() => { setMode('mine'); setPreview(null); }} className={`rounded-md px-3 py-2 text-xs font-semibold ${mode === 'mine' ? 'bg-accent text-accent-ink' : 'text-ink-dim'}`}>My keepers</button></div>
      <p className="mt-3 text-xs text-ink-dim">{mode === 'opponents' ? 'Paste every protected player from the other teams. They will be removed from availability simulations without pretending they were normal sequential picks.' : 'Paste your keepers to add them to My Team and the planner roster.'}</p>
      <textarea value={text} onChange={(event) => { setText(event.target.value); setPreview(null); }} rows={4} placeholder={'One player per line\nConnor McDavid\nNathan MacKinnon'} className="mt-3 w-full rounded-lg border border-line bg-surface-0 p-3 text-sm text-ink outline-none focus:border-accent" />
      {mode === 'mine' && <label className={`mt-2 flex items-start gap-2 rounded-md border border-line p-2 text-xs ${hasDraftPosition ? 'text-ink-dim' : 'text-ink-mute'}`}><input type="checkbox" checked={reserveFinalPicks && hasDraftPosition} disabled={!hasDraftPosition} onChange={(event) => setReserveFinalPicks(event.target.checked)} className="mt-0.5 accent-accent" /><span><strong className="block text-ink">Reserve my final draft picks</strong>{hasDraftPosition ? 'Places these keepers into the final rounds of your draft column.' : 'Set your draft slot first to reserve exact picks.'}</span></label>}
      {!preview ? <button type="button" disabled={!text.trim()} onClick={review} className="mt-2 min-h-9 rounded-md bg-accent px-4 text-xs font-bold text-accent-ink disabled:opacity-40">Review keeper matches</button> : <div className="mt-3 space-y-2"><div className="flex gap-3 text-xs"><span className="text-positive">{matched.length} ready</span><span className="text-warning">{preview.filter((row) => row.state === 'unresolved').length} unresolved</span></div><div className="max-h-56 space-y-1 overflow-y-auto">{preview.map((row, index) => <div key={`${row.raw}-${index}`} className="flex items-center gap-2 rounded-md border border-line bg-surface-0 px-3 py-2"><span className={`grid size-6 place-items-center rounded-full ${row.state === 'matched' ? 'bg-positive-muted text-positive' : 'bg-warning-muted text-warning'}`}>{row.state === 'matched' ? <Check size={13} /> : <X size={13} />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-ink">{row.player?.name ?? row.raw}</strong><span className="text-[9px] text-ink-mute">{row.player ? `${row.player.team} · ${row.player.pos.join('/')}` : 'Needs an exact player name'}</span></span></div>)}</div><button type="button" disabled={!matched.length} onClick={apply} className="min-h-9 rounded-md bg-accent px-4 text-xs font-bold text-accent-ink disabled:opacity-40">{mode === 'mine' ? `Add ${matched.length} to my keepers` : `Remove ${matched.length} from draft pool`}</button></div>}
      {mode === 'opponents' && unavailableIds.size > 0 && <button type="button" onClick={onClearOpponentKeepers} className="mt-3 text-[10px] font-semibold text-negative hover:underline">Clear {unavailableIds.size} league-mate keepers</button>}
    </div>}
  </section>;
}
