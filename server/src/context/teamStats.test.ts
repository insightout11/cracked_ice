import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { loadTeamStatsContext } from '../context/teamStats';

describe('teamStatsContext', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads stats and marks context as loaded', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'team-stats-test-'));
    const cacheDir = join(tmpDir, 'apps', 'api', 'data-cache');
    mkdirSync(cacheDir, { recursive: true });
    const sample = {
      generatedAt: '2025-01-01T00:00:00Z',
      source: 'test-fixture',
      teams: {
        ANA: { teamId: 'ANA', goalsAgainstPerGame: 2.4, goalsForPerGame: 3.1 }
      }
    };
    writeFileSync(join(cacheDir, 'team_stats.json'), JSON.stringify(sample, null, 2));

    const context = await loadTeamStatsContext(join(cacheDir, 'team_stats.json'));

    expect(context.loaded).toBe(true);
    expect(context.byTeam.get('ANA')).toMatchObject({
      teamCode: 'ANA',
      goalsAgainstPerGame: 2.4,
      goalsForPerGame: 3.1
    });
  });
});
