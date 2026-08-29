import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { AlertTriangle, FileSpreadsheet, FileUp, Trash2 } from 'lucide-react';
import type { DraftPlayer } from '../../lib/playerSearch';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import {
  CONSENSUS_PROJECTION_ID,
  activeProjectionLabel,
  importProjectionCsv,
  importProjectionWorkbook,
  type ProjectionImportResult,
} from '../../lib/projectionImport';
import { Button } from '../ui/button';
import { ProjectionComparisonPanel } from './ProjectionComparisonPanel';

const ACCEPTED_PROJECTION_FILES = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function ProjectionImportControl({
  workspace,
  directory,
  onChange,
}: {
  workspace: LeagueWorkspace;
  directory: DraftPlayer[];
  onChange: (workspace: LeagueWorkspace) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const [preview, setPreview] = useState<ProjectionImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const active = workspace.projections.sources.find((source) => source.id === workspace.projections.activeSourceId) ?? null;

  const read = async (file?: File) => {
    if (!file) return;

    const extension = file.name.toLocaleLowerCase();
    if (!extension.endsWith('.csv') && !extension.endsWith('.xlsx')) {
      setPreview(null);
      setFileName(null);
      setError('Choose a CSV or XLSX projection file.');
      return;
    }

    setError(null);
    setFileName(file.name);
    try {
      const sourceLabel = label.trim() || file.name.replace(/\.(csv|xlsx)$/i, '');
      const result = extension.endsWith('.xlsx')
        ? await importProjectionWorkbook(file, sourceLabel, workspace.season.label, directory, workspace)
        : importProjectionCsv(await file.text(), sourceLabel, workspace.season.label, directory, workspace);
      setPreview({ ...result, source: { ...result.source, fileName: file.name } });
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : 'Projection file could not be read.');
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void read(event.dataTransfer.files?.[0]);
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    inputRef.current?.click();
  };

  const apply = () => {
    if (!preview) return;
    onChange({
      ...workspace,
      projections: {
        activeSourceId: preview.source.id,
        consensusSourceIds: [...new Set([...workspace.projections.consensusSourceIds, preview.source.id])],
        sources: [...workspace.projections.sources.slice(-7), preview.source],
      },
      updatedAt: new Date().toISOString(),
    });
    setPreview(null);
    setLabel('');
    setFileName(null);
  };

  const select = (id: string) => onChange({
    ...workspace,
    projections: { ...workspace.projections, activeSourceId: id || null },
    updatedAt: new Date().toISOString(),
  });

  const remove = () => {
    if (!active) return;
    onChange({
      ...workspace,
      projections: {
        activeSourceId: null,
        consensusSourceIds: workspace.projections.consensusSourceIds.filter((id) => id !== active.id),
        sources: workspace.projections.sources.filter((source) => source.id !== active.id),
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <details className="mt-3 rounded-xl border border-line bg-surface-1 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Projection source
        <span className="ml-2 text-xs font-normal text-accent">{activeProjectionLabel(workspace)}</span>
      </summary>

      <div className="mt-3 grid gap-3">
        <p className="text-xs text-ink-dim">
          Import a CSV or Excel workbook you are licensed to use. Cracked Ice checks every player sheet, matches players,
          applies league scoring to stat lines, then adds schedule and roster context.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Active projection source"
            value={workspace.projections.activeSourceId ?? ''}
            onChange={(event) => select(event.target.value)}
            className="min-h-10 flex-1 rounded-md border border-line bg-surface-0 px-3 text-sm text-ink"
          >
            <option value="">Cracked Ice early projection</option>
            {workspace.projections.sources.length > 0 && <option value={CONSENSUS_PROJECTION_ID}>Selected-source consensus</option>}
            {workspace.projections.sources.map((source) => (
              <option key={source.id} value={source.id}>{source.label} · {source.matchedCount} players</option>
            ))}
          </select>
          {active && (
            <Button type="button" variant="ghost" onClick={remove}>
              <Trash2 size={14} />
              Remove
            </Button>
          )}
        </div>

        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Source name (optional)"
          className="min-h-10 rounded-md border border-line bg-surface-0 px-3 text-sm text-ink"
        />

        <div
          role="button"
          tabIndex={0}
          aria-label="Upload projection CSV or XLSX"
          onClick={() => inputRef.current?.click()}
          onKeyDown={handleDropzoneKeyDown}
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`group flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-accent/70 ${
            isDragging
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-line bg-surface-0 text-ink-dim hover:border-accent/70 hover:bg-accent/5'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_PROJECTION_FILES}
            className="sr-only"
            onChange={(event) => {
              void read(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
          {fileName ? <FileSpreadsheet className="mb-2 text-accent" size={25} /> : <FileUp className="mb-2 text-accent" size={25} />}
          <span className="text-sm font-semibold text-ink">
            {isDragging ? 'Drop it here' : fileName ?? 'Drag and drop projections here'}
          </span>
          <span className="mt-1 text-xs text-ink-mute">
            {fileName ? 'Choose or drop another file to replace it' : 'or click to choose a CSV or XLSX file'}
          </span>
        </div>

        <p className="text-[11px] text-ink-mute">
          Use Player, Goalie, or Player ID; Team; GP or GS; and either FPPG or projected stat columns such as G, A, PPP,
          SOG, HIT, BLK, W, SV, GA and SHO.
        </p>

        {error && (
          <p className="flex gap-2 text-sm text-negative" role="alert">
            <AlertTriangle size={15} />
            {error}
          </p>
        )}

        {preview && (
          <div className="rounded-lg border border-line bg-surface-0 p-3">
            <p className="text-sm font-semibold text-ink">Matched {preview.source.matchedCount} of {preview.totalRows} rows</p>
            <p className="mt-1 text-xs text-ink-dim">
              {preview.issues.length
                ? `${preview.issues.length} rows need attention. First: ${preview.issues[0].name} — ${preview.issues[0].reason}.`
                : 'Every row matched.'}{' '}
              Nothing changes until you apply it.
            </p>
            <Button type="button" className="mt-3" size="sm" disabled={!preview.source.matchedCount} onClick={apply}>
              Use {preview.source.label}
            </Button>
          </div>
        )}

        {workspace.projections.sources.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <div><p className="text-xs font-semibold text-ink">Want to inspect the differences?</p><p className="text-[10px] text-ink-mute">Compare every saved source, find disagreements, or rank with an equal-weight consensus.</p></div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowComparison((value) => !value)}>{showComparison ? 'Hide comparison' : 'Compare projections'}</Button>
          </div>
        )}

        {showComparison && workspace.projections.sources.length > 0 && (
          <ProjectionComparisonPanel workspace={workspace} directory={directory} onChange={onChange} />
        )}
      </div>
    </details>
  );
}
