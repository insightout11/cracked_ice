import { existsSync, readFileSync, rmSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const tmpDir = join(projectRoot, 'data-cache_tmp');
const finalDir = join(projectRoot, 'data-cache');
const backupDir = join(projectRoot, 'data-cache_previous');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

function removeDir(target) {
  rmSync(target, { recursive: true, force: true });
}

function validateStagedSnapshot() {
  const outcome = JSON.parse(readFileSync(join(tmpDir, 'hydration-outcome.json'), 'utf8'));
  const schedule = JSON.parse(readFileSync(join(tmpDir, 'schedule.json'), 'utf8'));
  const stats = JSON.parse(readFileSync(join(tmpDir, 'stats.json'), 'utf8'));
  const teamCount = Object.keys(schedule.teams ?? {}).length;
  const players = Object.values(stats.players ?? {});
  const careerCoverage = players.length
    ? players.filter((player) => player && typeof player === 'object' && 'careerHistory' in player).length / players.length
    : 0;
  if (teamCount !== 32) throw new Error(`Schedule completeness failed: expected 32 teams, found ${teamCount}`);
  if (players.length === 0) throw new Error('Stats completeness failed: no players');
  if (outcome.outcome === 'fresh') {
    const minimumCareerCoverage = Number(process.env.MIN_CAREER_COVERAGE ?? '0.5');
    if (careerCoverage < minimumCareerCoverage) {
      throw new Error(`Career coverage failed: ${(careerCoverage * 100).toFixed(1)}% < ${(minimumCareerCoverage * 100).toFixed(1)}%`);
    }
  }
  if ((process.env.REQUIRE_FRESH_HYDRATION ?? 'false').toLowerCase() === 'true' && outcome.outcome !== 'fresh') {
    throw new Error(`Production hydration requires fresh data; received ${outcome.outcome}`);
  }
  console.log(`[hydrate] validated ${outcome.outcome} snapshot: ${teamCount} teams, ${players.length} players, ${(careerCoverage * 100).toFixed(1)}% career coverage`);
}

try {
  // Data sanity gate: refuse to hydrate against an implausible schedule
  // (see DATA_WARNING.md). Non-zero exit here fails the pipeline before any
  // bad data is written or committed.
  run(process.execPath, ['scripts/validate-schedule.mjs'], { cwd: projectRoot });

  removeDir(tmpDir);
  mkdirSync(tmpDir, { recursive: true });

  run(process.execPath, ['--import', 'tsx/esm', 'scripts/hydrate.ts'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CACHE_OUTPUT_DIR: tmpDir
    }
  });

  validateStagedSnapshot();
  removeDir(backupDir);
  if (existsSync(finalDir)) renameSync(finalDir, backupDir);
  renameSync(tmpDir, finalDir);
  try {
    run(process.execPath, ['scripts/manifest.mjs'], { cwd: projectRoot });
    removeDir(backupDir);
  } catch (error) {
    removeDir(finalDir);
    if (existsSync(backupDir)) renameSync(backupDir, finalDir);
    throw error;
  }
  console.log('[hydrate] data-cache refreshed successfully');
} catch (error) {
  removeDir(tmpDir);
  if (!existsSync(finalDir) && existsSync(backupDir)) renameSync(backupDir, finalDir);
  console.error('[hydrate-outcome]', JSON.stringify({ outcome: 'failed', generatedAt: new Date().toISOString() }));
  console.error('[hydrate] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}


