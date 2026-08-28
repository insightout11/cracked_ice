import { describe, expect, it } from 'vitest';
import { decideLinkedCacheStartup } from './workspaceSyncStartup';

describe('decideLinkedCacheStartup', () => {
  it('pulls the cloud copy for a previously linked cache without a saved baseline', () => {
    expect(decideLinkedCacheStartup('device', 'remote', null)).toBe('pull-remote');
  });

  it('pulls a change made on another device without asking for review', () => {
    expect(decideLinkedCacheStartup('baseline', 'remote change', 'baseline')).toBe('pull-remote');
  });

  it('pushes an offline change when the cloud copy has not changed', () => {
    expect(decideLinkedCacheStartup('device change', 'baseline', 'baseline')).toBe('push-device');
  });

  it('requires review only when both copies changed independently', () => {
    expect(decideLinkedCacheStartup('device change', 'remote change', 'baseline')).toBe('review');
  });
});
