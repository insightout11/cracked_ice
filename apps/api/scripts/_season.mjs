// Shared season accessor for the pipeline/diagnostic scripts.
// Single source of truth: config/season.json (repo root).
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const SEASON = JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'season.json'), 'utf8'));
export const SEASON_ID = SEASON.seasonId;
