export type LinkedCacheStartupAction = 'pull-remote' | 'push-device' | 'review';

/**
 * Reconciles an account-linked browser cache against the cloud document and
 * their last common baseline. A review is only required when both devices
 * changed the same account workspace independently.
 */
export function decideLinkedCacheStartup(
  deviceJson: string,
  remoteJson: string,
  baselineJson: string | null,
): LinkedCacheStartupAction {
  if (!baselineJson || deviceJson === remoteJson || deviceJson === baselineJson) return 'pull-remote';
  if (remoteJson === baselineJson) return 'push-device';
  return 'review';
}
