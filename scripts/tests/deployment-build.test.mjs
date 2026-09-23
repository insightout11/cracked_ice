import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('Vercel uses the cross-platform build and rebuilds server and web output', async () => {
  const [pkg, vercel] = await Promise.all([
    readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('vercel.json', root), 'utf8').then(JSON.parse),
  ]);

  assert.equal(vercel.buildCommand, 'npm run build:vercel');
  assert.equal(pkg.scripts.build, 'npm run build:vercel');
  assert.match(pkg.scripts['build:vercel'], /npm ci --prefix api --include=dev --workspaces=false/);
  assert.match(pkg.scripts['build:vercel'], /npm ci --prefix server --include=dev --workspaces=false/);
  assert.match(pkg.scripts['build:vercel'], /npm ci --prefix web --include=dev --workspaces=false/);
  assert.match(pkg.scripts['build:vercel'], /npm run build --prefix server/);
  assert.match(pkg.scripts['build:vercel'], /npm run build --prefix web/);
  assert.doesNotMatch(vercel.buildCommand, /bash|build\.sh/);

  const requiredPlayerData = '{data/players.json,data/stats.json,data/yahoo-player-eligibility.json}';
  assert.equal(vercel.functions['api/draft-players.ts']?.includeFiles, requiredPlayerData);
  assert.equal(vercel.functions['api/player-details.ts']?.includeFiles, requiredPlayerData);
});
