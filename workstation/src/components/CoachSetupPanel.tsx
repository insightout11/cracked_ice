import { useCallback, useEffect, useMemo, useState, ChangeEvent } from 'react';
import axios from 'axios';
import { apiService } from '../services/api';
import { LeagueSettingsForm } from './LeagueSettingsForm';
import type {
  CoachConflictResponse,
  CoachUserStatus,
  CoachWindow,
  LeagueProfile
} from '../types';

interface CoachSetupPanelProps {
  onStatusChange?: (status: CoachUserStatus | null) => void;
}

function computeWindow(preset: '7d' | '14d'): CoachWindow {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (preset === '7d' ? 6 : 13));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function formatTimestamp(value?: string): string {
  if (!value) return '...';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export function CoachSetupPanel({ onStatusChange }: CoachSetupPanelProps) {
  const [status, setStatus] = useState<CoachUserStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [settingsJson, setSettingsJson] = useState('');
  const [rosterJson, setRosterJson] = useState('');
  const [freeAgentsJson, setFreeAgentsJson] = useState('');
  const [combinedJson, setCombinedJson] = useState('');

  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [editingSettings, setEditingSettings] = useState<LeagueProfile | undefined>(undefined);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [conflictWindow, setConflictWindow] = useState<CoachWindow>(() => computeWindow('7d'));
  const [conflict, setConflict] = useState<CoachConflictResponse | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await apiService.getCoachUserStatus();
      setStatus(data);
      setStatusError(null);
      onStatusChange?.(data);
    } catch (err) {
      const message = extractErrorMessage(err);
      setStatusError(message);
      setStatus(null);
      onStatusChange?.(null);
    } finally {
      setStatusLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleFileSelect = async (
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setter(text);
      event.target.value = '';
    } catch (err) {
      setError(`Failed to read file: ${extractErrorMessage(err)}`);
    }
  };

  const parseJson = (value: string, label: string) => {
    if (!value.trim()) {
      throw new Error(`${label} JSON is empty`);
    }
    try {
      return JSON.parse(value);
    } catch (err) {
      throw new Error(`${label} JSON invalid: ${(err as Error).message}`);
    }
  };

  const runUpload = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      await action();
      setFeedback(successMessage);
      await refreshStatus();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSettingsUpload = async () => {
    await runUpload(async () => {
      const payload = parseJson(settingsJson, 'Settings');
      await apiService.uploadCoachSettings(payload);
      setSettingsJson('');
    }, 'League settings saved');
  };

  const handleSettingsFormSave = async (settings: LeagueProfile) => {
    await runUpload(async () => {
      await apiService.uploadCoachSettings(settings);
      setShowSettingsForm(false);
      setEditingSettings(undefined);
    }, 'League settings saved');
  };

  const handleOpenSettingsForm = async () => {
    // Try to load existing settings from API
    try {
      const response = await apiService.getCoachSettings();
      // API returns { league_profile: {...} }, but form expects unwrapped LeagueProfile
      setEditingSettings(response.league_profile || response);
    } catch (err) {
      // If no settings exist yet, start with empty form
      setEditingSettings(undefined);
    }
    setShowSettingsForm(true);
  };

  const handleRosterUpload = async () => {
    await runUpload(async () => {
      const payload = parseJson(rosterJson, 'Roster');
      if (Array.isArray(payload.roster)) {
        await apiService.uploadCoachRoster(payload);
      } else if (Array.isArray(payload.players) && payload.league_profile) {
        await apiService.uploadCoachContext(payload);
      } else {
        throw new Error('Roster JSON must include a "roster" array or a full coach context');
      }
      setRosterJson('');
    }, 'Roster saved');
  };

  const handleFreeAgentsUpload = async () => {
    await runUpload(async () => {
      const payload = parseJson(freeAgentsJson, 'Free agents');
      if (Array.isArray(payload.free_agents)) {
        await apiService.uploadCoachFreeAgents(payload);
      } else if (Array.isArray(payload.candidates)) {
        await apiService.uploadCoachFreeAgents({ free_agents: payload.candidates });
      } else if (Array.isArray(payload.roster) && payload.league_profile) {
        await apiService.uploadCoachContext(payload);
      } else {
        throw new Error('Free-agent JSON must include a "free_agents" array or a full coach context');
      }
      setFreeAgentsJson('');
    }, 'Free-agent pool saved');
  };

  const handleCombinedUpload = async () => {
    await runUpload(async () => {
      const payload = parseJson(combinedJson, 'Combined context');
      await apiService.uploadCoachContext(payload);
      setCombinedJson('');
    }, 'Coach context saved');
  };

  const handleFetchConflict = async () => {
    if (!conflictWindow.start || !conflictWindow.end) {
      setError('Select a start and end date to view schedule conflicts.');
      return;
    }
    setConflictLoading(true);
    setError(null);
    try {
      const response = await apiService.getCoachConflicts(conflictWindow);
      setConflict(response);
      if (response.summary.totalBenchGp === 0) {
        setFeedback('No bench conflicts in the selected window.');
      } else {
        setFeedback(null);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
      setConflict(null);
    } finally {
      setConflictLoading(false);
    }
  };

  const benchLeaders = useMemo(() => {
    if (!conflict) return [];
    return Object.entries(conflict.benchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [conflict]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ci-white)]">Coach Data Setup</h3>
          <p className="text-xs text-[var(--ci-muted)]">Upload your league settings, roster, and free-agent pool before running the coach.</p>
        </div>
        {status && (
          <span className={`text-xs ${status.contextReady ? 'text-[var(--laser-cyan)]' : 'text-amber-200'}`}>
            {status.contextReady ? 'Ready' : 'Incomplete'}
          </span>
        )}
      </header>

      {statusLoading && (
        <div className="mb-4 text-sm text-[var(--ci-muted)]">Loading coach status...</div>
      )}
      {statusError && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{statusError}</div>
      )}

      {status && (
        <div className="mb-6 grid gap-3 text-xs text-[var(--ci-muted)]">
          {(['settings', 'roster', 'free_agents'] as const).map((key) => {
            const info = status.components[key];
            return (
              <div key={key} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <div className="flex flex-col">
                  <span className="font-semibold text-[var(--ci-white)]">{key.replace('_', ' ')}</span>
                  <span>Updated: {formatTimestamp(info.updatedAt)}</span>
                </div>
                <div className="text-right">
                  <span className={`font-semibold ${info.present ? 'text-[var(--laser-cyan)]' : 'text-amber-200'}`}>
                    {info.present ? 'Present' : 'Missing'}
                  </span>
                  {typeof info.count === 'number' && (
                    <div>Count: {info.count}</div>
                  )}
                  {info.source === 'legacy' && (
                    <div className="text-amber-200">Legacy file</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold text-[var(--ci-white)]">Combined Upload</h4>
          <p className="text-xs text-[var(--ci-muted)]">Paste an entire coach context (settings + roster + free agents) from a JSON file.</p>
          <textarea
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-[var(--ci-white)]"
            rows={4}
            value={combinedJson}
            onChange={(event) => setCombinedJson(event.target.value)}
            placeholder={'{ "league_profile": { ... }, "roster": [], "free_agents": [] }'}
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="file"
              accept="application/json"
              onChange={(event) => handleFileSelect(event, setCombinedJson)}
              className="text-xs text-[var(--ci-muted)]"
            />
            <button
              type="button"
              onClick={handleCombinedUpload}
              disabled={busy}
              className="rounded-md bg-[var(--laser-cyan)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)]"
            >
              Upload Combined JSON
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-[var(--ci-white)]">League Settings</h4>
            <button
              type="button"
              onClick={handleOpenSettingsForm}
              disabled={busy}
              className="rounded-md bg-[var(--laser-cyan)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)]"
            >
              {status?.components.settings.present ? 'Edit Settings' : 'Configure Settings'}
            </button>
          </div>

          {showSettingsForm ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <LeagueSettingsForm
                initialSettings={editingSettings}
                onSave={handleSettingsFormSave}
                onCancel={() => {
                  setShowSettingsForm(false);
                  setEditingSettings(undefined);
                }}
              />
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--ci-muted)] mb-2">Or upload settings as JSON:</p>
              <textarea
                className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-[var(--ci-white)]"
                rows={4}
                value={settingsJson}
                onChange={(event) => setSettingsJson(event.target.value)}
                placeholder={'{ "league_name": "My League", ... }'}
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="file"
                  accept="application/json"
                  onChange={(event) => handleFileSelect(event, setSettingsJson)}
                  className="text-xs text-[var(--ci-muted)]"
                />
                <button
                  type="button"
                  onClick={handleSettingsUpload}
                  disabled={busy}
                  className="rounded-md bg-[var(--laser-cyan)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)]"
                >
                  Upload JSON
                </button>
              </div>
            </>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[var(--ci-white)]">Roster (16 players)</h4>
          <textarea
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-[var(--ci-white)]"
            rows={6}
            value={rosterJson}
            onChange={(event) => setRosterJson(event.target.value)}
            placeholder={'{ "roster": [ ... ] }'}
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="file"
              accept="application/json"
              onChange={(event) => handleFileSelect(event, setRosterJson)}
              className="text-xs text-[var(--ci-muted)]"
            />
            <button
              type="button"
              onClick={handleRosterUpload}
              disabled={busy}
              className="rounded-md bg-[var(--laser-cyan)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)]"
            >
              Upload Roster
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[var(--ci-white)]">Free-Agent Candidates</h4>
          <textarea
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-[var(--ci-white)]"
            rows={6}
            value={freeAgentsJson}
            onChange={(event) => setFreeAgentsJson(event.target.value)}
            placeholder={'{ "free_agents": [ ... ] }'}
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="file"
              accept="application/json"
              onChange={(event) => handleFileSelect(event, setFreeAgentsJson)}
              className="text-xs text-[var(--ci-muted)]"
            />
            <button
              type="button"
              onClick={handleFreeAgentsUpload}
              disabled={busy}
              className="rounded-md bg-[var(--laser-cyan)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)]"
            >
              Upload Free Agents
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ci-muted)]">
          <div>
            <label className="mr-2">Start</label>
            <input
              type="date"
              className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[var(--ci-white)]"
              value={conflictWindow.start}
              onChange={(event) => setConflictWindow((prev) => ({ ...prev, start: event.target.value }))}
            />
          </div>
          <div>
            <label className="mr-2">End</label>
            <input
              type="date"
              className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[var(--ci-white)]"
              value={conflictWindow.end}
              onChange={(event) => setConflictWindow((prev) => ({ ...prev, end: event.target.value }))}
            />
          </div>
          <button
            type="button"
            onClick={handleFetchConflict}
            disabled={conflictLoading}
            className="rounded-md bg-[var(--laser-cyan)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)]"
          >
            {conflictLoading ? 'Checking...' : 'Check Conflicts'}
          </button>
        </div>

        {conflict && (
          <div className="mt-4 space-y-3 text-xs text-[var(--ci-muted)]">
            <div>
              <span className="font-semibold text-[var(--ci-white)]">Bench GP:</span> {conflict.summary.totalBenchGp}
              {' - '}
              <span className="font-semibold text-[var(--ci-white)]">Total starts:</span> {conflict.summary.totalStarts}
            </div>
            {benchLeaders.length > 0 && (
              <div>
                <p className="font-semibold text-[var(--ci-white)]">Most benched players</p>
                <ul className="list-disc pl-5">
                  {benchLeaders.map(([playerId, count]) => (
                    <li key={playerId}>{playerId}: {count} nights</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {feedback && (
        <div className="mt-4 rounded-lg border border-[var(--laser-cyan)]/40 bg-[var(--laser-cyan)]/10 px-3 py-2 text-xs text-[var(--laser-cyan)]">{feedback}</div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
      )}
    </section>
  );
}
