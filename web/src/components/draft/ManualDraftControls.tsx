import { useMemo, useRef, useState } from 'react';
import { Check, ListPlus, Search, UserCheck, X } from 'lucide-react';
import { findQuickDraftPlayers, previewManualDraftImport, type ManualDraftImportRow } from '../../lib/draftManualTracking';
import type { DraftPlayer } from '../../lib/playerSearch';

interface ManualDraftSelection {
  player: DraftPlayer;
  status: 'mine' | 'taken';
}

interface ManualDraftControlsProps {
  players: DraftPlayer[];
  draftedIds: Set<string>;
  onRecord: (selections: ManualDraftSelection[]) => void;
}

function normalizeId(id: string) {
  return id.replace(/^nhl:/, '');
}

export function ManualDraftControls({ players, draftedIds, onRecord }: ManualDraftControlsProps) {
  const [quickQuery, setQuickQuery] = useState('');
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [catchUpText, setCatchUpText] = useState('');
  const [preview, setPreview] = useState<ManualDraftImportRow[] | null>(null);
  const [mineIds, setMineIds] = useState<Set<string>>(new Set());
  const quickInputRef = useRef<HTMLInputElement>(null);
  const quickResults = useMemo(() => findQuickDraftPlayers(quickQuery, players, draftedIds), [draftedIds, players, quickQuery]);
  const matched = preview?.filter((row) => row.state === 'matched' && row.player) ?? [];

  const recordQuick = (player: DraftPlayer, status: 'mine' | 'taken') => {
    onRecord([{ player, status }]);
    setQuickQuery('');
    quickInputRef.current?.focus();
  };

  const review = () => {
    setPreview(previewManualDraftImport(catchUpText, players, draftedIds));
    setMineIds(new Set());
  };

  const apply = () => {
    onRecord(matched.map(({ player }) => ({ player: player!, status: mineIds.has(normalizeId(player!.id)) ? 'mine' : 'taken' })));
    const unresolved = preview?.filter((row) => row.state === 'unresolved').map((row) => row.raw) ?? [];
    setCatchUpText(unresolved.join('\n'));
    setPreview(unresolved.length ? previewManualDraftImport(unresolved.join('\n'), players, draftedIds) : null);
    setMineIds(new Set());
    if (!unresolved.length) setCatchUpOpen(false);
  };

  return <div className="w-full space-y-3">
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 text-ink-mute" size={15} />
        <label htmlFor="quick-draft-player" className="sr-only">Quick mark drafted player</label>
        <input ref={quickInputRef} id="quick-draft-player" value={quickQuery} onChange={(event) => setQuickQuery(event.target.value)} placeholder="Quick mark a pick…" autoComplete="off" className="min-h-9 w-full rounded-lg border border-line bg-surface-1 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent" />
        {quickResults.length > 0 && <div className="mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface-1 shadow-xl">
          {quickResults.map((player) => <div key={player.id} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0">
            <button type="button" onClick={() => recordQuick(player, 'taken')} className="min-w-0 flex-1 text-left"><strong className="block truncate text-sm text-ink">{player.name}</strong><span className="text-[10px] text-ink-mute">{player.pos.join('/')} · {player.team}</span></button>
            <button type="button" onClick={() => recordQuick(player, 'taken')} className="min-h-8 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-dim hover:text-ink">Taken</button>
            <button type="button" onClick={() => recordQuick(player, 'mine')} className="min-h-8 rounded-md bg-accent px-2.5 text-xs font-bold text-accent-ink">Mine</button>
          </div>)}
        </div>}
      </div>
      <button type="button" aria-expanded={catchUpOpen} onClick={() => setCatchUpOpen((open) => !open)} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"><ListPlus size={14} />Catch up multiple picks</button>
    </div>
    {catchUpOpen && <div className="rounded-lg border border-line bg-surface-1 p-3">
      <div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-ink">Paste a draft log or player list</strong><p className="mt-0.5 text-xs text-ink-mute">Nothing changes until you review and apply the matched players.</p></div><button type="button" aria-label="Close catch-up" onClick={() => setCatchUpOpen(false)} className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-ink-mute"><X size={14} /></button></div>
      <textarea value={catchUpText} onChange={(event) => { setCatchUpText(event.target.value); setPreview(null); }} rows={4} placeholder={'Paste copied rows or one player per line\n1. Connor McDavid  EDM\n2. Nathan MacKinnon  COL'} className="mt-3 w-full rounded-lg border border-line bg-surface-0 p-3 text-sm text-ink outline-none focus:border-accent" />
      {!preview && <button type="button" disabled={!catchUpText.trim()} onClick={review} className="mt-2 min-h-9 rounded-md bg-accent px-4 text-xs font-bold text-accent-ink disabled:opacity-40">Review matches</button>}
      {preview && <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-3 text-xs"><span className="text-positive">{matched.length} ready</span><span className="text-ink-mute">{preview.filter((row) => row.state === 'already-drafted').length} already marked</span><span className="text-warning">{preview.filter((row) => row.state === 'unresolved').length} unresolved</span></div>
        <div className="max-h-60 space-y-1 overflow-y-auto pr-1">{preview.map((row, index) => <ImportPreviewRow key={`${row.raw}-${index}`} row={row} mine={Boolean(row.player && mineIds.has(normalizeId(row.player.id)))} onMineChange={(mine) => { if (!row.player) return; const id = normalizeId(row.player.id); setMineIds((current) => { const next = new Set(current); if (mine) next.add(id); else next.delete(id); return next; }); }} />)}</div>
        <div className="flex flex-wrap items-center gap-2 pt-1"><button type="button" disabled={!matched.length} onClick={apply} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-xs font-bold text-accent-ink disabled:opacity-40"><Check size={14} />Apply {matched.length} pick{matched.length === 1 ? '' : 's'}</button><button type="button" onClick={review} className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim">Review again</button></div>
      </div>}
    </div>}
  </div>;
}

function ImportPreviewRow({ row, mine, onMineChange }: { row: ManualDraftImportRow; mine: boolean; onMineChange: (mine: boolean) => void }) {
  const stateLabel = row.state === 'matched' ? 'Ready' : row.state === 'already-drafted' ? 'Already marked' : row.state === 'duplicate' ? 'Duplicate' : 'Needs exact name';
  return <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-0 px-2.5 py-2">
    <span className={`grid size-6 shrink-0 place-items-center rounded-full ${row.state === 'matched' ? 'bg-positive-muted text-positive' : row.state === 'unresolved' ? 'bg-warning-muted text-warning' : 'bg-surface-2 text-ink-mute'}`}>{row.state === 'matched' ? <Check size={13} /> : <X size={13} />}</span>
    <div className="min-w-40 flex-1"><strong className="block truncate text-xs text-ink">{row.player?.name ?? row.raw}</strong><span className="text-[10px] text-ink-mute">{row.player ? `${row.player.pos.join('/')} · ${row.player.team}` : stateLabel}</span></div>
    {row.state === 'matched' && <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 text-[10px] font-semibold text-ink-dim"><input type="checkbox" checked={mine} onChange={(event) => onMineChange(event.target.checked)} className="accent-accent" /><UserCheck size={12} />My pick</label>}
    <span className={`text-[10px] font-semibold ${row.state === 'matched' ? 'text-positive' : row.state === 'unresolved' ? 'text-warning' : 'text-ink-mute'}`}>{stateLabel}</span>
  </div>;
}
