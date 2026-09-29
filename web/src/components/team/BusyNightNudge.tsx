import { useEffect, useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { planningWeek, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { loadSeasonSchedule } from '../../lib/schedulePlanning';
import { useInjuries, withInjuries } from '../../lib/injuries';
import { busyNights, startSitDecision, type StartSitGame } from '../../lib/startSit';

/** How far ahead a busy night is worth asking about. */
const LOOKAHEAD_DAYS = 4;
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * One quiet line when a night in the next few days has more players than lineup spots:
 * where the "who sits?" question comes up, a tap opens that night's start / sit card.
 */
export function BusyNightNudge({ workspace, roster, onAsk }: { workspace: LeagueWorkspace; roster: RosterPlayer[]; onAsk: (date: string) => void }) {
  const injuries = useInjuries();
  const [games, setGames] = useState<Record<string, StartSitGame[]> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSeasonSchedule()
      .then((schedule) => { if (!cancelled) setGames(schedule.games as unknown as Record<string, StartSitGame[]>); })
      .catch(() => { /* No schedule, no prompt. */ });
    return () => { cancelled = true; };
  }, []);

  const night = useMemo(() => {
    if (!games) return null;
    const healthy = withInjuries(roster, injuries);
    const fppg = (player: RosterPlayer) => player.blendedFppg ?? player.seasonFppg ?? 0;
    const first = busyNights(workspace, healthy, games, planningWeek(workspace).today, LOOKAHEAD_DAYS, fppg)[0];
    if (!first) return null;
    const decision = startSitDecision(workspace, healthy, games, first.date, fppg);
    const players = decision?.groups.reduce((sum, group) => sum + group.contenders.length, 0) ?? 0;
    return { date: first.date, sits: first.sits, players };
  }, [games, injuries, roster, workspace]);

  if (!night) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-dim">
      <Scale size={14} className="text-accent" aria-hidden="true" />
      <span><strong className="text-ink">Busy night {shortDate(night.date)}:</strong> {night.players} players for {night.players - night.sits} spot{night.players - night.sits === 1 ? '' : 's'}, {night.sits} {night.sits === 1 ? 'sits' : 'sit'}.</span>
      <button type="button" onClick={() => onAsk(night.date)} className="inline-link font-semibold text-accent hover:underline">Ask who sits</button>
    </p>
  );
}
