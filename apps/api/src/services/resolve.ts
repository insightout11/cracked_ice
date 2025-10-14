import { resolveAlias, getCanonicalPlayer } from './alias_resolver';
import { Player } from '../models/types';

export function resolveName(input: string, team?: string): Player | null {
  const result = resolveAlias({ name: input, team });
  if (!result) {
    return null;
  }
  return result.player;
}

export { getCanonicalPlayer };