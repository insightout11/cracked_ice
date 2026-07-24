import { describe, expect, it } from 'vitest';
import {
  createLeagueCandidateObservation,
  activeLeagueFromStore,
  applyScoringPreset,
  createDefaultLeagueStore,
  createDefaultLeagueWorkspace,
  mergeLegacyLeagueProfile,
  isLeagueCandidateCurrent,
  LeagueWorkspaceSchema,
  LeagueWorkspaceStoreSchema,
  toLeagueProfile,
  upsertLeagueCandidates,
} from './leagueWorkspace';
import { LEAGUE_WORKSPACE_STORAGE_KEY, LocalLeagueWorkspaceRepository, migrateLegacyLocalSettings } from './leagueWorkspaceRepository';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

const NOW = '2026-07-22T12:00:00.000Z';

describe('League Workspace', () => {
  it('expires manually observed availability after its evidence window', () => {
    const candidate = createLeagueCandidateObservation('8478402', 'user-confirmed', NOW, 24);
    expect(isLeagueCandidateCurrent(candidate, new Date('2026-07-23T11:59:59.000Z').getTime())).toBe(true);
    expect(isLeagueCandidateCurrent(candidate, new Date('2026-07-23T12:00:00.000Z').getTime())).toBe(false);
  });

  it('migrates legacy window and optimizer preferences without deleting them', () => {
    const storage = memoryStorage({
      'off-night-time-window-mode': 'regular',
      'off-night-daily-slots': 'custom',
      'off-night-custom-slots': '3',
      'off-night-league-weeks': JSON.stringify({ weekStartDay: 'sunday', selectedWeeks: [24, 25] }),
    });

    const store = migrateLegacyLocalSettings(storage, NOW);
    const league = activeLeagueFromStore(store);

    expect(league.analysis.defaultDailySlots).toBe(3);
    expect(league.schedule.matchupWeekStart).toBe('sunday');
    expect(league.source.kind).toBe('legacy-coach');
    expect(storage.getItem('off-night-custom-slots')).toBe('3');
  });

  it('stores and switches multiple league records', () => {
    const storage = memoryStorage();
    const repository = new LocalLeagueWorkspaceRepository(storage);
    const first = createDefaultLeagueWorkspace({ id: 'league-a', name: 'League A', now: NOW, timezone: 'America/Toronto' });
    const second = createDefaultLeagueWorkspace({ id: 'league-b', name: 'League B', now: NOW, timezone: 'America/New_York' });
    const store = { version: 1 as const, activeLeagueId: second.id, leagues: [first, second] };

    repository.save(store);
    const loaded = repository.load();

    expect(activeLeagueFromStore(loaded).name).toBe('League B');
    expect(JSON.parse(storage.getItem(LEAGUE_WORKSPACE_STORAGE_KEY) ?? '{}').leagues).toHaveLength(2);
  });

  it('rejects duplicate league IDs and a missing active league', () => {
    const first = createDefaultLeagueWorkspace({ id: 'duplicate', name: 'First', now: NOW, timezone: 'UTC' });
    const second = createDefaultLeagueWorkspace({ id: 'duplicate', name: 'Second', now: NOW, timezone: 'UTC' });

    expect(() => LeagueWorkspaceStoreSchema.parse({ version: 1, activeLeagueId: 'missing', leagues: [first, second] })).toThrow();
  });

  it('round-trips a validated JSON backup', () => {
    const repository = new LocalLeagueWorkspaceRepository(memoryStorage());
    const store = createDefaultLeagueStore({ id: 'backup-league', now: NOW, timezone: 'UTC' });

    expect(repository.import(repository.export(store))).toEqual(store);
    expect(() => repository.import('{"version":1,"leagues":[]}')).toThrow();
  });

  it('leaves an invalid stored backup intact when recovery is required', () => {
    const invalid = '{"version":1,"activeLeagueId":"missing","leagues":[]}';
    const storage = memoryStorage({ [LEAGUE_WORKSPACE_STORAGE_KEY]: invalid });
    const repository = new LocalLeagueWorkspaceRepository(storage);

    expect(() => repository.load()).toThrow();
    expect(storage.getItem(LEAGUE_WORKSPACE_STORAGE_KEY)).toBe(invalid);
  });

  it('deduplicates candidate evidence and keeps the newest observation', () => {
    const older = createLeagueCandidateObservation('nhl:8478402', 'imported-snapshot', NOW, 24);
    const newer = createLeagueCandidateObservation('8478402', 'user-confirmed', '2026-07-22T13:00:00.000Z', 24);

    const candidates = upsertLeagueCandidates([older], [newer]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ playerId: '8478402', availability: 'user-confirmed' });
  });

  it('adds league size when reading an early version-one workspace', () => {
    const repository = new LocalLeagueWorkspaceRepository(memoryStorage());
    const serialized = JSON.parse(repository.export(createDefaultLeagueStore({ id: 'early-v1', now: NOW, timezone: 'UTC' })));
    delete serialized.leagues[0].numberOfTeams;
    delete serialized.leagues[0].draftStrategy;
    delete serialized.leagues[0].keeperRules;
    delete serialized.leagues[0].draftSession;

    const imported = repository.import(JSON.stringify(serialized)).leagues[0];
    expect(imported.numberOfTeams).toBe(12);
    expect(imported.draftStrategy).toMatchObject({ presetId: 'balanced', weights: { production: 55, playoffs: 15 } });
    expect(imported.keeperRules).toEqual({ maximumKeepers: null, horizon: 'next-season', costSystem: 'none' });
    expect(imported.draftSession).toMatchObject({ status: 'setup', picks: [], targets: [], sync: { mode: 'manual' } });
  });

  it('stores keeper horizon, league limit, and optional player cost', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'keeper-league', now: NOW, timezone: 'UTC' });
    const parsed = LeagueWorkspaceSchema.parse({
      ...workspace,
      keeperRules: { maximumKeepers: 5, horizon: 'two-to-three-years', costSystem: 'draft-round' },
      roster: [{
        playerId: '8478402', fullName: 'Connor McDavid', team: 'EDM', positions: ['C'], keeper: true,
        keeperCost: { type: 'draft-round', round: 1 }, protected: true, undroppable: true,
      }],
    });

    expect(parsed.keeperRules).toEqual({ maximumKeepers: 5, horizon: 'two-to-three-years', costSystem: 'draft-round' });
    expect(parsed.roster[0].keeperCost).toEqual({ type: 'draft-round', round: 1 });
  });

  it('migrates the current coach profile and preserves roster members', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'legacy', now: NOW, timezone: 'UTC' });
    const migrated = mergeLegacyLeagueProfile(workspace, {
      league_name: 'Matt League',
      scoring_type: 'points',
      num_teams: 14,
      lineup_slots: { C: 3, D: 5 },
      skater_scoring: { goals: 4, assists: 3 },
      goalie_scoring: { wins: 3 },
      playoff_start_date: '2025-03-16',
      playoff_end_date: '2025-04-05',
    }, [{
      id: '8478402',
      full_name: 'Connor McDavid',
      team: 'EDM',
      positions: ['C'],
      current_slot: 'C',
      games_played: 0,
      stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
    }], NOW);

    expect(migrated.name).toBe('Matt League');
    expect(migrated.numberOfTeams).toBe(14);
    expect(migrated.rosterRules.slots.C).toBe(3);
    expect(migrated.roster[0]).toMatchObject({ playerId: '8478402', slot: 'C', keeper: false });
    expect(migrated.schedule.playoffs.start).toBe('2027-03-01');
    expect(toLeagueProfile(migrated).skater_scoring?.goals).toBe(4);
    expect(toLeagueProfile(migrated).num_teams).toBe(14);
  });

  it('resolves scoring presets through the shared contract', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'scoring', now: NOW, timezone: 'UTC' });
    const yahoo = applyScoringPreset(workspace, 'yahoo', NOW);

    expect(yahoo.scoring.label).toBe('Yahoo Standard');
    expect(toLeagueProfile(yahoo).scoring_type).toBe('points');
    expect(toLeagueProfile(yahoo).skater_scoring?.goals).toBe(6);
  });

  it('applies the full preset library including roster structure', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'preset-library', now: NOW, timezone: 'UTC' });
    const chesterfield = applyScoringPreset(workspace, 'chesterfield', NOW);

    expect(chesterfield.numberOfTeams).toBe(10);
    expect(chesterfield.rosterRules.slots['IR+']).toBe(1);
    expect(chesterfield.scoring.skater.shorthanded_goals).toBe(3);
    expect(chesterfield.scoring.skater.game_winning_goals).toBe(1);
  });
});
