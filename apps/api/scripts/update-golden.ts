import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { rankStreamers } from '../src/services/rank';
import { readJsonFixture } from '../src/services/logger';

interface CoachApiResponse {
  baseline_points?: number;
  recommendations?: Array<{
    deltaPoints: number;
    bestDrop: { lostPoints: number };
  }>;
}

const SNAPSHOT_PATH = join(process.cwd(), 'tests', 'golden.streamers.snap.json');

function normaliseRecommendation(rec: any) {
  if (!rec) return rec;
  return {
    ...rec,
    deltaPoints: typeof rec.deltaPoints === 'number' ? Number(rec.deltaPoints.toFixed(2)) : rec.deltaPoints,
    deltaGp: rec.deltaGp,
    bestDrop: rec.bestDrop
      ? {
          ...rec.bestDrop,
          lostPoints: typeof rec.bestDrop.lostPoints === 'number'
            ? Number(rec.bestDrop.lostPoints.toFixed(2))
            : rec.bestDrop.lostPoints
        }
      : rec.bestDrop
  };
}

function normaliseSnapshot(payload: CoachApiResponse) {
  const baseline = Number((payload.baseline_points ?? 0).toFixed(2));
  const recommendations = (payload.recommendations ?? []).map(normaliseRecommendation);
  return { baseline_points: baseline, recommendations };
}

function runUpdate(): void {
  const input = readJsonFixture(['tests', 'golden.streamers.input.json']);
  const result = rankStreamers(input.userId, input.window, 'golden-seed');
  const snapshot = {
    baseline_points: Number(result.baselinePoints.toFixed(2)),
    recommendations: result.recommendations.map(normaliseRecommendation)
  };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log('[golden] snapshot updated');
}

function runCheck(responsePath: string): void {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
  const response = JSON.parse(readFileSync(responsePath, 'utf8')) as CoachApiResponse;
  const normalisedResponse = normaliseSnapshot(response);
  const expected = normaliseSnapshot(snapshot);

  if (JSON.stringify(normalisedResponse) !== JSON.stringify(expected)) {
    console.error('[golden] snapshot mismatch');
    console.error('Expected:', JSON.stringify(expected, null, 2));
    console.error('Received:', JSON.stringify(normalisedResponse, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log('[golden] snapshot check passed');
}

function main(): void {
  const args = process.argv.slice(2);
  if (args[0] === '--check') {
    const responsePath = args[1];
    if (!responsePath) {
      console.error('[golden] usage: --check <response.json>');
      process.exitCode = 1;
      return;
    }
    runCheck(responsePath);
    return;
  }

  runUpdate();
}

main();