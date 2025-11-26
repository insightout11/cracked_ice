import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cacheDir = join(root, 'data-cache');

if (!existsSync(cacheDir)) {
  console.warn('[manifest] cache directory missing, skipping manifest generation');
  process.exit(0);
}

const files = readdirSync(cacheDir)
  .filter((name) => name !== 'manifest.json')
  .filter((name) => statSync(join(cacheDir, name)).isFile())
  .map((name) => {
    const full = join(cacheDir, name);
    const stats = statSync(full);
    return {
      name,
      bytes: stats.size,
      mtime: stats.mtime.toISOString()
    };
  });

const manifest = {
  version: Date.now().toString(),
  generatedAt: new Date().toISOString(),
  files
};

writeFileSync(join(cacheDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Wrote manifest with', files.length, 'files');
