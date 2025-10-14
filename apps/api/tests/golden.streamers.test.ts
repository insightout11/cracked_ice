import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { rankStreamers } from '../src/services/rank';
import { ensureLogsDir } from '../src/services/logger';

const FIXTURE_INPUT = join(__dirname, 'golden.streamers.input.json');
const SNAPSHOT_PATH = join(__dirname, 'golden.streamers.snap.json');
const REQUEST_LOG = join(__dirname, '..', 'logs', 'coach_requests.log');

beforeAll(() => {
  process.env.NEXT_PUBLIC_ENV = 'staging';
  process.env.DISABLE_PROD = 'true';
  ensureLogsDir();
});

beforeEach(() => {
  if (existsSync(REQUEST_LOG)) {
    unlinkSync(REQUEST_LOG);
  }
});

describe('golden coach snapshot', () => {
  it('matches cached streamer recommendations', () => {
    const input = JSON.parse(readFileSync(FIXTURE_INPUT, 'utf8')) as {
      userId: string;
      window: { start: string; end: string };
    };

    const result = rankStreamers(input.userId, input.window, 'golden-test');

    const current = {
      baseline_points: Number(result.baselinePoints.toFixed(2)),
      recommendations: result.recommendations
    };

    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    expect(current).toEqual(snapshot);
  });
});