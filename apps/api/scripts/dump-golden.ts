import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { rankStreamers } from '../src/services/rank';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixture = join(__dirname, '..', 'tests', 'golden.streamers.input.json');
const snapshotPath = join(__dirname, '..', 'tests', 'golden.streamers.snap.json');

const input = JSON.parse(readFileSync(fixture, 'utf8')) as {
  userId: string;
  window: { start: string; end: string };
};

const result = rankStreamers(input.userId, input.window, 'snapshot-update');

const payload = {
  baseline_points: Number(result.baselinePoints.toFixed(2)),
  recommendations: result.recommendations,
};

writeFileSync(snapshotPath, JSON.stringify(payload, null, 2));
console.log(Updated );
