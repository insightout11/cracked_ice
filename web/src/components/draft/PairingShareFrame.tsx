import { forwardRef } from 'react';
import type { PairingResult } from '../../types';
import { getTeamLogoUrl } from '../../utils/teamLogos';
import { ScheduleInterleaveStrip } from './ScheduleInterleaveStrip';

interface PairingShareFrameProps {
  anchorTeams: string[];
  anchorsGamesByDate: Record<string, string[]>;
  result: PairingResult;
  projectedPoints: number;
  mode: 'pair-building' | 'added-starts';
  isTopResult: boolean;
  slots: number;
  scoringLabel: string;
  start: string;
  end: string;
}

export const PairingShareFrame = forwardRef<HTMLDivElement, PairingShareFrameProps>(function PairingShareFrame({
  anchorTeams,
  anchorsGamesByDate,
  result,
  projectedPoints,
  mode,
  isTopResult,
  slots,
  scoringLabel,
  start,
  end,
}, ref) {
  return (
    <div ref={ref} className="h-[675px] w-[1200px] overflow-hidden bg-surface-0 px-14 py-10 text-ink">
      <header className="flex items-center justify-between border-b border-line pb-7">
        <div>
          <p className="scoreboard-text text-lg text-accent">CRACKED ICE</p>
          <p className="mt-1 text-sm text-ink-mute">OFF-NIGHT DRAFT TOOL</p>
        </div>
        <p className="font-mono text-sm text-ink-dim">{start} — {end}</p>
      </header>
      <main className="pt-8">
        <div className="flex items-center gap-5">
          <img src={getTeamLogoUrl(result.team)} alt="" className="h-24 w-24 object-contain" />
          <div>
            <p className="text-base text-ink-dim">{isTopResult ? (mode === 'pair-building' ? 'Best schedule partner' : 'Best next add') : 'Selected schedule option'} for {anchorTeams.join(' + ')}</p>
            <h2 className="brand-title mt-1 text-5xl">{result.teamName}</h2>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <div className="rounded-xl border border-accent/40 bg-accent/10 p-5"><strong className="block font-mono text-5xl text-accent">{mode === 'pair-building' ? result.separateNights : `+${result.addedStarts}`}</strong><span className="text-sm text-ink-dim">{mode === 'pair-building' ? 'separate game nights' : 'usable starts'}</span></div>
          <div className="rounded-xl border border-line bg-surface-1 p-5"><strong className="block font-mono text-5xl">{mode === 'pair-building' ? result.sharedNights : `~+${projectedPoints}`}</strong><span className="text-sm text-ink-dim">{mode === 'pair-building' ? 'shared / full nights' : `fantasy points · ${scoringLabel}`}</span></div>
          <div className="rounded-xl border border-line bg-surface-1 p-5"><strong className="block font-mono text-5xl text-positive">{mode === 'pair-building' ? `${Math.round(result.offNightShare * 100)}%` : result.blockedGames}</strong><span className="text-sm text-ink-dim">{mode === 'pair-building' ? 'off-nights' : 'blocked games'}</span></div>
        </div>
        <div className="mt-6 rounded-xl border border-line bg-surface-1 p-4">
          <ScheduleInterleaveStrip anchorTeams={anchorTeams} anchorsGamesByDate={anchorsGamesByDate} candidateTeam={result.team} candidateGamesByDate={result.gamesByDate} slots={slots} start={start} end={end} />
        </div>
      </main>
      <footer className="mt-5 flex items-center justify-between text-sm text-ink-mute">
        <span>Schedule math for fantasy hockey</span><span className="text-accent">crackedicehockey.com</span>
      </footer>
    </div>
  );
});
