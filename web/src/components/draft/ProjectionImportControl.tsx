import { useState } from 'react';
import { AlertTriangle, FileUp, Trash2 } from 'lucide-react';
import type { DraftPlayer } from '../../lib/playerSearch';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { importProjectionCsv, importProjectionWorkbook, type ProjectionImportResult } from '../../lib/projectionImport';
import { Button } from '../ui/button';

export function ProjectionImportControl({ workspace, directory, onChange }: { workspace: LeagueWorkspace; directory: DraftPlayer[]; onChange: (workspace: LeagueWorkspace) => void }) {
  const [label, setLabel] = useState(''); const [preview, setPreview] = useState<ProjectionImportResult | null>(null); const [error, setError] = useState<string | null>(null);
  const active = workspace.projections.sources.find((source) => source.id === workspace.projections.activeSourceId) ?? null;
  const read = async (file?: File) => {
    if (!file) return; setError(null);
    try {
      const sourceLabel = label || file.name.replace(/\.(csv|xlsx)$/i, '');
      const result = file.name.toLocaleLowerCase().endsWith('.xlsx')
        ? await importProjectionWorkbook(file, sourceLabel, workspace.season.label, directory, workspace)
        : importProjectionCsv(await file.text(), sourceLabel, workspace.season.label, directory, workspace);
      setPreview(result);
    } catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : 'Projection file could not be read.'); }
  };
  const apply = () => { if (!preview) return; onChange({ ...workspace, projections: { activeSourceId: preview.source.id, sources: [...workspace.projections.sources.slice(-7), preview.source] }, updatedAt: new Date().toISOString() }); setPreview(null); setLabel(''); };
  const select = (id: string) => onChange({ ...workspace, projections: { ...workspace.projections, activeSourceId: id || null }, updatedAt: new Date().toISOString() });
  const remove = () => { if (!active) return; onChange({ ...workspace, projections: { activeSourceId: null, sources: workspace.projections.sources.filter((source) => source.id !== active.id) }, updatedAt: new Date().toISOString() }); };
  return <details className="mt-3 rounded-xl border border-line bg-surface-1 p-3"><summary className="cursor-pointer text-sm font-semibold text-ink">Projection source <span className="ml-2 text-xs font-normal text-accent">{active?.label ?? 'Cracked Ice'}</span></summary><div className="mt-3 grid gap-3"><p className="text-xs text-ink-dim">Import a CSV or Excel workbook you are licensed to use. Cracked Ice checks every player sheet, matches players, applies league scoring to stat lines, then adds schedule and roster context.</p><div className="flex flex-col gap-2 sm:flex-row"><select aria-label="Active projection source" value={workspace.projections.activeSourceId ?? ''} onChange={(event) => select(event.target.value)} className="min-h-10 flex-1 rounded-md border border-line bg-surface-0 px-3 text-sm text-ink"><option value="">Cracked Ice early projection</option>{workspace.projections.sources.map((source) => <option key={source.id} value={source.id}>{source.label} · {source.matchedCount} players</option>)}</select>{active && <Button type="button" variant="ghost" onClick={remove}><Trash2 size={14} />Remove</Button>}</div><div className="grid gap-2 sm:grid-cols-[1fr_auto]"><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Source name" className="min-h-10 rounded-md border border-line bg-surface-0 px-3 text-sm text-ink" /><label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-accent px-3 text-sm font-semibold text-accent"><FileUp size={15} />Choose CSV or XLSX<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => { void read(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></div><p className="text-[11px] text-ink-mute">Use Player, Goalie, or Player ID; Team; GP or GS; and either FPPG or projected stat columns such as G, A, PPP, SOG, HIT, BLK, W, SV, GA and SHO.</p>{error && <p className="flex gap-2 text-sm text-negative" role="alert"><AlertTriangle size={15} />{error}</p>}{preview && <div className="rounded-lg border border-line bg-surface-0 p-3"><p className="text-sm font-semibold text-ink">Matched {preview.source.matchedCount} of {preview.totalRows} rows</p><p className="mt-1 text-xs text-ink-dim">{preview.issues.length ? `${preview.issues.length} rows need attention. First: ${preview.issues[0].name} — ${preview.issues[0].reason}.` : 'Every row matched.'} Nothing changes until you apply it.</p><Button type="button" className="mt-3" size="sm" disabled={!preview.source.matchedCount} onClick={apply}>Use {preview.source.label}</Button></div>}</div></details>;
}
