import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { loadTeamStatsContext } from '../context/teamStats';

let cwdStack: string[] = [];

function pushCwd(next: string) {
  cwdStack.push(process.cwd());
  process.chdir(next);
}

function popCwd() {
  const prev = cwdStack.pop();
  if (prev) {
    process.chdir(prev);
  }
}

describe('teamStatsContext', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'team-stats-test-'));
    pushCwd(tmpDir);
  });

  afterEach(() => {
    popCwd();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads stats and marks context as loaded', async () => {
    const cacheDir = join('apps', 'api', 'data-cache');
    mkdirSync(cacheDir, { recursive: true });
    const sample = {
      generatedAt: '2025-01-01T00:00:00Z',
      source: 'test-fixture',
      teams: {
        ANA: { teamId: 'ANA', gaPer60: 2.4, gfPer60: 3.1 }
      }
    };
    writeFileSync(join(cacheDir, 'team_stats.json'), JSON.stringify(sample, null, 2));

    const context = await loadTeamStatsContext();

    expect(context.loaded).toBe(true);
    expect(context.byTeam.get('ANA')).toMatchObject({
      teamCode: 'ANA',
      gaPer60: 2.4,
      gfPer60: 3.1
    });
  });
});
