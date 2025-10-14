import { describe, expect, it, beforeEach } from 'vitest';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { resolveAlias } from '../src/services/alias_resolver';

const LOG_PATH = join(__dirname, '..', 'logs', 'aliases_pending.csv');

function readLog(): string {
  return existsSync(LOG_PATH) ? readFileSync(LOG_PATH, 'utf8') : '';
}

describe('alias resolver', () => {
  beforeEach(() => {
    if (existsSync(LOG_PATH)) {
      unlinkSync(LOG_PATH);
    }
  });

  it('resolves initialed name with confidence >= 0.8', () => {
    const result = resolveAlias({ name: 'J. Eriksson Ek', team: 'MIN' });

    expect(result).not.toBeNull();
    expect(result?.player.id).toBe('nhl:8478028');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('logs unknown entries below threshold', () => {
    const result = resolveAlias({ name: 'Some Random Player', team: 'FAK' });
    expect(result).toBeNull();

    const log = readLog();
    expect(log).toContain('Some Random Player');
    expect(log).toContain('FAK');
  });
});