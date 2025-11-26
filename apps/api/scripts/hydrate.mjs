import { rmSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const tmpDir = join(projectRoot, 'data-cache_tmp');
const finalDir = join(projectRoot, 'data-cache');
const fixtureMarker = join(finalDir, '.fixture');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

function removeDir(target) {
  rmSync(target, { recursive: true, force: true });
}

function clearStaleMarker() {
  rmSync(fixtureMarker, { force: true });
}

try {
  clearStaleMarker();
  removeDir(tmpDir);
  mkdirSync(tmpDir, { recursive: true });

  run(process.execPath, ['--import', 'tsx/esm', 'scripts/hydrate.ts'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CACHE_OUTPUT_DIR: tmpDir
    }
  });

  removeDir(finalDir);
  renameSync(tmpDir, finalDir);

  run(process.execPath, ['scripts/manifest.mjs'], { cwd: projectRoot });
  console.log('[hydrate] data-cache refreshed successfully');
} catch (error) {
  removeDir(tmpDir);
  console.error('[hydrate] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}


