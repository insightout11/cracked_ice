import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardPaste, Search, Trash2, XCircle } from 'lucide-react';
import type { PlayerSearchResult } from '../../types';
import {
  buildRosterImportRows,
  findRosterImportCandidates,
  normalizeRosterPlayerId,
  type RosterImportRow,
} from '../../lib/rosterImport';
import { Button } from '../ui/button';

interface BulkImportPanelProps {
  allPlayers: PlayerSearchResult[];
  onImport: (playerIds: string[]) => void | Promise<void>;
  onOcrUpload?: (file: File) => Promise<string[]>;
  mode?: 'free-agents' | 'roster';
  existingPlayerIds?: string[];
  defaultExpanded?: boolean;
  embedded?: boolean;
}

export function BulkImportPanel({
  allPlayers,
  onImport,
  onOcrUpload,
  mode = 'free-agents',
  existingPlayerIds = [],
  defaultExpanded = false,
  embedded = false,
}: BulkImportPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || embedded);
  const [inputText, setInputText] = useState('');
  const [rows, setRows] = useState<RosterImportRow[] | null>(null);
  const [correctionQueries, setCorrectionQueries] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputId = useId();
  const existingIds = useMemo(() => new Set(existingPlayerIds.map(normalizeRosterPlayerId)), [existingPlayerIds]);
  const selectedIds = useMemo(() => rows
    ? [...new Set(rows
      .filter((row) => row.status === 'matched' && row.selectedPlayerId && !existingIds.has(normalizeRosterPlayerId(row.selectedPlayerId)))
      .map((row) => row.selectedPlayerId as string))]
    : [], [existingIds, rows]);

  const previewMatches = () => {
    if (!inputText.trim()) return;
    setRows(buildRosterImportRows(allPlayers, inputText, existingPlayerIds));
    setCorrectionQueries({});
    setFeedback(null);
  };

  const choosePlayer = (rowKey: string, playerId: string) => {
    setRows((current) => {
      if (!current) return null;
      const canonicalPlayerId = normalizeRosterPlayerId(playerId);
      const alreadySelected = current.some((row) =>
        row.key !== rowKey &&
        row.status === 'matched' &&
        row.selectedPlayerId &&
        normalizeRosterPlayerId(row.selectedPlayerId) === canonicalPlayerId
      );
      return current.map((row) => row.key === rowKey
        ? { ...row, selectedPlayerId: playerId, status: existingIds.has(canonicalPlayerId) || alreadySelected ? 'duplicate' : 'matched' }
        : row);
    });
  };

  const updateCorrection = (rowKey: string, query: string) => {
    setCorrectionQueries((current) => ({ ...current, [rowKey]: query }));
    setRows((current) => current?.map((row) => row.key === rowKey
      ? {
          ...row,
          candidates: findRosterImportCandidates(allPlayers, query),
          selectedPlayerId: null,
          status: 'unmatched',
        }
      : row) ?? null);
  };

  const confirmImport = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    setFeedback(null);
    try {
      await onImport(selectedIds);
      setFeedback(`${selectedIds.length} player${selectedIds.length === 1 ? '' : 's'} imported.`);
      setInputText('');
      setRows(null);
      setCorrectionQueries({});
    } catch {
      setFeedback('The roster could not be imported. Your review is still here so you can retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOcrUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onOcrUpload) return;
    setIsProcessing(true);
    setFeedback(null);
    try {
      const names = await onOcrUpload(file);
      const text = names.join('\n');
      setInputText(text);
      setRows(buildRosterImportRows(allPlayers, text, existingPlayerIds));
    } catch {
      setFeedback('The screenshot could not be read. Paste the player names instead.');
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  const content = (
    <div className={embedded ? 'space-y-4' : 'space-y-4 border-t border-line bg-surface-1/30 p-4'}>
      <div>
        <label htmlFor={`${inputId}-paste`} className="scoreboard-text mb-2 block text-accent">
          Player names
        </label>
        <textarea
          id={`${inputId}-paste`}
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder={'Connor McDavid\nCale Makar\nIgor Shesterkin'}
          rows={6}
          className="w-full rounded-lg border border-line bg-surface-0 px-3 py-3 font-mono text-sm text-ink outline-none placeholder:text-ink-mute focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <p className="mt-2 text-xs text-ink-mute">One player per line. Team and position columns from copied league tables are okay.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={previewMatches} disabled={!inputText.trim() || isProcessing}>
          <Search size={16} /> Review matches
        </Button>
        {onOcrUpload && (
          <Button asChild variant="ghost">
            <label>
              {isProcessing ? 'Reading screenshot…' : 'Upload screenshot'}
              <input type="file" accept="image/*" onChange={handleOcrUpload} disabled={isProcessing} className="sr-only" />
            </label>
          </Button>
        )}
        {(inputText || rows) && (
          <Button type="button" variant="ghost" onClick={() => { setInputText(''); setRows(null); setFeedback(null); }}>
            <Trash2 size={16} /> Clear
          </Button>
        )}
      </div>

      {rows && (
        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap gap-3 text-xs" aria-live="polite">
            <span className="inline-flex items-center gap-1.5 text-positive"><CheckCircle2 size={15} />{selectedIds.length} ready</span>
            <span className="inline-flex items-center gap-1.5 text-warning"><AlertTriangle size={15} />{rows.filter((row) => row.status === 'ambiguous' || row.status === 'unmatched').length} need review</span>
            <span className="inline-flex items-center gap-1.5 text-ink-mute"><XCircle size={15} />{rows.filter((row) => row.status === 'duplicate').length} duplicates</span>
          </div>

          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => (
              <div key={row.key} className="rounded-lg border border-line bg-surface-0/70 p-3">
                <div className="flex items-start gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{row.source}</span>
                    {row.status === 'matched' && row.selectedPlayerId && (
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-positive">
                        <CheckCircle2 size={14} />
                        {allPlayers.find((player) => player.id === row.selectedPlayerId)?.name}
                      </span>
                    )}
                    {row.status === 'duplicate' && <span className="mt-1 block text-xs text-ink-mute">Already on this roster or repeated in the paste.</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current?.filter((item) => item.key !== row.key) ?? null)}
                    aria-label={`Remove ${row.source} from import`}
                    className="rounded p-1 text-ink-mute hover:bg-surface-2 hover:text-ink"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {(row.status === 'ambiguous' || row.status === 'unmatched') && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <label className="sr-only" htmlFor={`${inputId}-correct-${row.key}`}>Correct player name for {row.source}</label>
                    <input
                      id={`${inputId}-correct-${row.key}`}
                      value={correctionQueries[row.key] ?? row.source}
                      onChange={(event) => updateCorrection(row.key, event.target.value)}
                      className="min-w-0 rounded border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                    <label className="sr-only" htmlFor={`${inputId}-match-${row.key}`}>Choose matching player for {row.source}</label>
                    <select
                      id={`${inputId}-match-${row.key}`}
                      value=""
                      onChange={(event) => choosePlayer(row.key, event.target.value)}
                      className="min-w-0 rounded border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    >
                      <option value="">{row.candidates.length ? 'Choose the correct player…' : 'No matches yet'}</option>
                      {row.candidates.map((player) => (
                        <option key={player.id} value={player.id} disabled={existingIds.has(normalizeRosterPlayerId(player.id))}>
                          {player.name} · {player.team} · {player.pos.join('/')}{existingIds.has(normalizeRosterPlayerId(player.id)) ? ' · already rostered' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button type="button" className="w-full" onClick={confirmImport} disabled={selectedIds.length === 0 || isProcessing}>
            <ClipboardPaste size={16} />
            {isProcessing ? 'Importing…' : `Import ${selectedIds.length} player${selectedIds.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}

      {feedback && <p className="text-sm text-ink-dim" aria-live="polite">{feedback}</p>}
    </div>
  );

  if (embedded) return content;

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface-glass">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"
      >
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-ink"><ClipboardPaste size={16} />Paste {mode === 'roster' ? 'roster' : 'free agents'}</span>
          <span className="mt-0.5 block text-xs text-ink-mute">Match names locally, review uncertain rows, then import.</span>
        </span>
        <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-ink-mute transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && content}
    </section>
  );
}
