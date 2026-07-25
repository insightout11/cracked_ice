import { useEffect, useState } from 'react';
import { AlertTriangle, Database, Plus, Settings2 } from 'lucide-react';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { applyScoringPreset, SCORING_PRESETS, type LeagueWorkspace, type ScoringPresetId } from '../../lib/leagueWorkspace';
import { Button } from '../ui/button';
import { Modal, ModalContent, ModalDescription, ModalTitle } from '../ui/dialog';
import { YahooConnectionControl } from './YahooConnectionControl';

const SKATER_FIELD_GROUPS = [
  { label: 'Core scoring', fields: [['goals', 'Goals'], ['assists', 'Assists'], ['points', 'Total points'], ['shots_on_goal', 'Shots on goal'], ['hits', 'Hits'], ['blocks', 'Blocks'], ['plus_minus', 'Plus/minus']] },
  { label: 'Power play', fields: [['powerplay_goals', 'PP goals'], ['powerplay_assists', 'PP assists'], ['power_play_points', 'PP points']] },
  { label: 'Short-handed', fields: [['shorthanded_goals', 'SH goals'], ['shorthanded_assists', 'SH assists'], ['shorthanded_points', 'SH points']] },
  { label: 'Situational', fields: [['game_winning_goals', 'Game-winning goals']] },
] as const;

const GOALIE_FIELDS = [
  ['wins', 'Wins'],
  ['losses', 'Losses'],
  ['overtime_losses', 'OT losses'],
  ['saves', 'Saves'],
  ['goals_against', 'Goals against'],
  ['shutouts', 'Shutouts'],
  ['games_started', 'Games started'],
] as const;

const SLOT_FIELDS = ['C', 'LW', 'RW', 'D', 'G', 'UTIL', 'BN', 'IR', 'IR+'] as const;
const inputClass = 'mt-1 w-full rounded-md border border-line bg-surface-0 px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

function cloneLeague(league: LeagueWorkspace): LeagueWorkspace {
  return JSON.parse(JSON.stringify(league)) as LeagueWorkspace;
}

interface LeagueWorkspaceControlProps {
  mobile?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function LeagueWorkspaceControl({ mobile = false, open: controlledOpen, onOpenChange, hideTrigger = false }: LeagueWorkspaceControlProps) {
  const {
    store,
    activeLeague,
    storageError,
    setActiveLeague,
    updateLeague,
    createLeague,
    exportWorkspaces,
    importWorkspaces,
  } = useLeagueWorkspace();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [draft, setDraft] = useState<LeagueWorkspace>(() => cloneLeague(activeLeague));
  const [backupText, setBackupText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDraft(cloneLeague(activeLeague));
  }, [activeLeague, open]);

  const updateDraft = <K extends keyof LeagueWorkspace>(key: K, value: LeagueWorkspace[K]) => {
    setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  };

  const save = () => {
    updateLeague({
      ...draft,
      name: draft.name.trim() || 'My League',
      source: { kind: 'manual', label: 'Edited in League Workspace' },
      updatedAt: new Date().toISOString(),
    });
    setOpen(false);
  };

  const selectPreset = (presetId: ScoringPresetId) => {
    if (presetId === 'custom') {
      setDraft((current) => ({
        ...current,
        scoring: { ...current.scoring, presetId: 'custom', label: 'Custom points', updatedAt: new Date().toISOString() },
      }));
      return;
    }
    setDraft((current) => applyScoringPreset(current, presetId));
  };

  const updateWeight = (group: 'skater' | 'goalie', key: string, value: number) => {
    setDraft((current) => ({
      ...current,
      scoring: {
        ...current.scoring,
        presetId: 'custom',
        label: 'Custom points',
        [group]: { ...current.scoring[group], [key]: value },
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  return (
    <>
      {!hideTrigger && <Button
        type="button"
        variant="ghost"
        size={mobile ? 'md' : 'sm'}
        className={mobile ? 'w-full justify-start border border-line bg-surface-glass px-4 py-3' : 'max-w-[15rem] gap-2 border border-line bg-surface-glass'}
        onClick={() => setOpen(true)}
        aria-label={`League settings: ${activeLeague.name}`}
      >
        <Database aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <span className="truncate">{activeLeague.name}</span>
        <span className="shrink-0 text-xs text-ink-dim">{activeLeague.season.label}</span>
      </Button>}

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="w-[min(94vw,48rem)]">
          <ModalTitle>League Workspace</ModalTitle>
          <ModalDescription>Set league rules once. Optimizer, Season, and My Team use the active workspace.</ModalDescription>

          {storageError && (
            <div className="mt-4 flex gap-2 rounded-md border border-negative/50 bg-negative-muted p-3 text-sm text-negative" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>Changes are not safely stored on this device: {storageError}</span>
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              Active league
              <select
                value={activeLeague.id}
                onChange={(event) => setActiveLeague(event.target.value)}
                className={inputClass}
              >
                {store.leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
              </select>
            </label>
            <Button type="button" variant="ghost" className="self-end" onClick={() => createLeague()}>
              <Plus aria-hidden="true" className="size-4" /> New league
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              League name
              <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className={inputClass} />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              Platform
              <select value={draft.platform} onChange={(event) => updateDraft('platform', event.target.value as LeagueWorkspace['platform'])} className={inputClass}>
                <option value="manual">Manual / no connection</option>
                <option value="yahoo">Yahoo</option>
                <option value="fantrax">Fantrax</option>
                <option value="espn">ESPN</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              Number of teams
              <input type="number" min="2" max="32" value={draft.numberOfTeams} onChange={(event) => updateDraft('numberOfTeams', Math.min(32, Math.max(2, Number(event.target.value))))} className={inputClass} />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              Season
              <input value={draft.season.label} disabled className={inputClass} />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              League format
              <input value="Points league" disabled className={inputClass} />
            </label>
          </div>

          {draft.platform === 'yahoo' && (
            <section className="mt-5">
              <YahooConnectionControl />
            </section>
          )}

          <section className="mt-6 border-t border-line pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Scoring</h3>
                <p className="text-xs text-ink-dim">Fantasy-point projections use these weights.</p>
              </div>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
                Profile
                <select value={draft.scoring.presetId} onChange={(event) => selectPreset(event.target.value as ScoringPresetId)} className={`${inputClass} min-w-48`}>
                  {Object.entries(SCORING_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
                  <option value="custom">Custom points</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <h4 className="scoreboard-text text-accent">Skaters</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {SKATER_FIELD_GROUPS.map((group) => (
                    <fieldset key={group.label} className="rounded-lg border border-line bg-surface-0/40 p-3">
                      <legend className="px-1 text-xs font-semibold text-ink">{group.label}</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {group.fields.map(([key, label]) => (
                          <label key={key} className="text-xs text-ink-dim">{label}
                            <input type="number" step="0.1" value={draft.scoring.skater[key] ?? 0} onChange={(event) => updateWeight('skater', key, Number(event.target.value))} className={inputClass} />
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-mute">If your league scores PP or SH points, leave the separate goal/assist bonuses at 0 unless it awards both.</p>
              </div>
              <div>
                <h4 className="scoreboard-text text-accent">Goalies</h4>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface-0/40 p-3">
                {GOALIE_FIELDS.map(([key, label]) => (
                  <label key={key} className="text-xs text-ink-dim">{label}
                    <input type="number" step="0.1" value={draft.scoring.goalie[key] ?? 0} onChange={(event) => updateWeight('goalie', key, Number(event.target.value))} className={inputClass} />
                  </label>
                ))}
                </div>
                <p className="mt-2 text-xs text-ink-mute">Rate and category-league settings such as GAA, save percentage, and faceoff percentage are deferred until category leagues have full data support.</p>
              </div>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h3 className="font-display text-base font-semibold text-ink">Roster and lineup</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SLOT_FIELDS.map((slot) => (
                <label key={slot} className="text-xs text-ink-dim">{slot}
                  <input type="number" min="0" max="30" value={draft.rosterRules.slots[slot] ?? 0} onChange={(event) => setDraft((current) => ({ ...current, rosterRules: { ...current.rosterRules, slots: { ...current.rosterRules.slots, [slot]: Math.max(0, Number(event.target.value)) } } }))} className={inputClass} />
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Lineup locks
                <select value={draft.rosterRules.lockingMode} onChange={(event) => setDraft((current) => ({ ...current, rosterRules: { ...current.rosterRules, lockingMode: event.target.value as 'daily' | 'weekly' } }))} className={inputClass}>
                  <option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Matchup starts
                <select value={draft.schedule.matchupWeekStart} onChange={(event) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, matchupWeekStart: event.target.value as LeagueWorkspace['schedule']['matchupWeekStart'] } }))} className={inputClass}>
                  <option value="monday">Monday</option><option value="saturday">Saturday</option><option value="sunday">Sunday</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Timezone
                <input value={draft.schedule.timezone} onChange={(event) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, timezone: event.target.value } }))} className={inputClass} />
              </label>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h3 className="font-display text-base font-semibold text-ink">Dates and acquisitions</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Default window
                <select value={draft.schedule.defaultWindow.preset} onChange={(event) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, defaultWindow: { preset: event.target.value as LeagueWorkspace['schedule']['defaultWindow']['preset'] } } }))} className={inputClass}>
                  <option value="rest-of-week">Rest of week</option><option value="7d">Next 7 days</option><option value="14d">Next 14 days</option><option value="30d">Next 30 days</option><option value="rest-of-season">Rest of season</option><option value="season">Full season</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Playoffs start
                <input type="date" required min={draft.season.start} max={draft.schedule.playoffs.end} value={draft.schedule.playoffs.start} onChange={(event) => event.target.value && setDraft((current) => ({ ...current, schedule: { ...current.schedule, playoffs: { ...current.schedule.playoffs, start: event.target.value } } }))} className={inputClass} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Playoffs end
                <input type="date" required min={draft.schedule.playoffs.start} max={draft.season.end} value={draft.schedule.playoffs.end} onChange={(event) => event.target.value && setDraft((current) => ({ ...current, schedule: { ...current.schedule, playoffs: { ...current.schedule.playoffs, end: event.target.value } } }))} className={inputClass} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Moves per week
                <input type="number" min="0" value={draft.acquisitions.limit ?? ''} placeholder="Unlimited" onChange={(event) => setDraft((current) => ({ ...current, acquisitions: { ...current.acquisitions, limit: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) } }))} className={inputClass} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Moves already used
                <input type="number" min="0" value={draft.acquisitions.movesUsed ?? ''} placeholder="Unknown" onChange={(event) => setDraft((current) => ({ ...current, acquisitions: { ...current.acquisitions, movesUsed: event.target.value === '' ? null : Math.max(0, Number(event.target.value)), observedAt: new Date().toISOString() } }))} className={inputClass} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Adds become usable
                <select value={draft.acquisitions.addTiming} onChange={(event) => setDraft((current) => ({ ...current, acquisitions: { ...current.acquisitions, addTiming: event.target.value as LeagueWorkspace['acquisitions']['addTiming'] } }))} className={inputClass}>
                  <option value="same-day">Same day</option><option value="next-day">Next day</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-dim">Waiver delay (days)
                <input type="number" min="0" max="7" value={draft.acquisitions.waiverDelayDays} onChange={(event) => setDraft((current) => ({ ...current, acquisitions: { ...current.acquisitions, waiverDelayDays: Math.min(7, Math.max(0, Number(event.target.value))) } }))} className={inputClass} />
              </label>
            </div>
          </section>

          <details className="mt-6 border-t border-line pt-5">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Backup or restore workspace JSON</summary>
            <textarea value={backupText} onChange={(event) => setBackupText(event.target.value)} className={`${inputClass} min-h-28 font-mono text-xs`} placeholder="Exported workspace JSON appears here, or paste a backup to import." />
            {importError && <p className="mt-2 text-sm text-negative" role="alert">{importError}</p>}
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setBackupText(exportWorkspaces()); setImportError(null); }}>Export JSON</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { try { importWorkspaces(backupText); setImportError(null); } catch { setImportError('That backup is not a valid League Workspace export.'); } }}>Import JSON</Button>
            </div>
          </details>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
            <p className="flex items-center gap-2 text-xs text-ink-dim"><Settings2 className="size-4" aria-hidden="true" />{draft.scoring.label} · {draft.source.label}</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" onClick={save}>Save workspace</Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
