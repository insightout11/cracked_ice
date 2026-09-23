import { useEffect, useState } from 'react';
import type { RosterPlayer } from './coachSchemas';

/**
 * Yahoo injury statuses, written nightly by scripts/build-injury-snapshot.mjs and
 * served statically (/injuries.json). Used to badge roster players, whose own data
 * only knows whether the NHL lists them as active.
 */
export interface InjurySnapshot {
  updatedAt: string | null;
  players: Record<string, { status: string; statusFull: string | null; note: string | null; updatedAt: string | null }>;
}

let snapshotRequest: Promise<InjurySnapshot | null> | null = null;

export function loadInjuries(): Promise<InjurySnapshot | null> {
  snapshotRequest ??= fetch('/injuries.json')
    .then((response) => (response.ok ? response.json() as Promise<InjurySnapshot> : null))
    .catch(() => null)
    .then((snapshot) => {
      if (!snapshot) snapshotRequest = null;
      return snapshot;
    });
  return snapshotRequest;
}

export function useInjuries(): InjurySnapshot | null {
  const [snapshot, setSnapshot] = useState<InjurySnapshot | null>(null);
  useEffect(() => {
    let alive = true;
    void loadInjuries().then((result) => {
      if (alive) setSnapshot(result);
    });
    return () => {
      alive = false;
    };
  }, []);
  return snapshot;
}

/** The player with Yahoo's injury status applied; unchanged when Yahoo has none. */
export function withInjury<T extends RosterPlayer>(player: T, snapshot: InjurySnapshot | null): T {
  const injury = snapshot?.players[`nhl:${player.id.replace(/^nhl:/, '')}`];
  if (!injury) return player;
  return {
    ...player,
    injuryStatus: injury.status,
    injuryStatusFull: injury.statusFull ?? undefined,
    injuryNote: injury.note ?? undefined,
    injuryUpdatedAt: injury.updatedAt ?? undefined,
  };
}

export function withInjuries<T extends RosterPlayer>(players: T[], snapshot: InjurySnapshot | null): T[] {
  if (!snapshot) return players;
  return players.map((player) => withInjury(player, snapshot));
}
