import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { RosterPlayer } from '../lib/coachSchemas';
import type { LeagueWorkspace } from '../lib/leagueWorkspace';
import { enrichWorkspaceRosterPlayers, reconcileWorkspaceRoster } from '../lib/myTeamAnalysis';

/**
 * Keeps My Team's working roster and the saved League Workspace roster in step, both ways.
 * Edits on the page are saved to the workspace. A workspace roster changed elsewhere
 * (another device through account sync, a Yahoo paste) replaces the page's copy, rather
 * than the page's older copy being saved back over it.
 */
export function useWorkspaceRosterSync({ activeLeague, roster, setRoster, isLoadingData, updateLeague, skipReconcileRef, pageRosterJsonRef, onRosterReplaced }: {
  activeLeague: LeagueWorkspace;
  roster: RosterPlayer[];
  setRoster: Dispatch<SetStateAction<RosterPlayer[]>>;
  isLoadingData: boolean;
  updateLeague: (league: LeagueWorkspace) => void;
  skipReconcileRef: MutableRefObject<boolean>;
  /** The workspace roster as the page last saw or wrote it. */
  pageRosterJsonRef: MutableRefObject<string>;
  /** Called after an outside roster replaces the page's, so anything built from the old one (the phone lineup) is rebuilt. */
  onRosterReplaced?: () => void;
}) {
  useEffect(() => {
    const json = JSON.stringify(activeLeague.roster);
    if (json === pageRosterJsonRef.current) return;
    // Changed elsewhere: adopt it, keeping the stats already loaded for players still on it.
    pageRosterJsonRef.current = json;
    skipReconcileRef.current = true;
    setRoster((current) => enrichWorkspaceRosterPlayers(activeLeague, current));
    onRosterReplaced?.();
  }, [activeLeague, onRosterReplaced, pageRosterJsonRef, setRoster, skipReconcileRef]);

  useEffect(() => {
    if (isLoadingData) return;
    if (skipReconcileRef.current) {
      skipReconcileRef.current = false;
      return;
    }
    const nextRoster = reconcileWorkspaceRoster(activeLeague.roster, roster);
    const nextJson = JSON.stringify(nextRoster);
    if (nextJson === JSON.stringify(activeLeague.roster)) return;
    pageRosterJsonRef.current = nextJson;
    updateLeague({ ...activeLeague, roster: nextRoster, updatedAt: new Date().toISOString() });
  }, [activeLeague, isLoadingData, pageRosterJsonRef, roster, setRoster, skipReconcileRef, updateLeague]);
}
