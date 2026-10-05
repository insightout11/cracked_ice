import { CheckCircle2, Circle } from 'lucide-react';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { usePublicDirectory } from '../../hooks/usePublicDirectory';
import { ScreenshotRefresh } from './ScreenshotRefresh';
import { SignInForm } from '../account/SignInForm';

/**
 * A new visitor's first screen on My Team: two Yahoo pastes and they have their league,
 * their roster and this week's pickups, no account needed. Signing in is offered for
 * keeping it across devices, not required to start.
 */
export function QuickStart() {
  const { activeLeague } = useLeagueWorkspace();
  const players = usePublicDirectory(activeLeague);
  const settingsDone = activeLeague.scoring.presetId === 'custom' && Boolean(activeLeague.providerLeagueId);
  const rostersDone = Boolean(activeLeague.leagueRosters?.teams.length);
  const steps = [
    { done: settingsDone, title: "Paste your league's Settings page", detail: 'Scoring, lineup spots, add limits and playoffs, set for you. Once per league.' },
    { done: rostersDone, title: 'Paste your Starting Rosters page', detail: 'Every team in your league, so pickups only show players nobody has. Pick your team and you’re done.' },
  ];
  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:py-10">
      <header>
        <p className="scoreboard-text text-accent">MY TEAM</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink [text-wrap:balance]">This week's pickups for your Yahoo league, in about a minute</h1>
        <p className="mt-2 text-sm text-ink-dim">Copy two pages from Yahoo and paste them here. No account needed to start; nothing is sent to Yahoo.</p>
      </header>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.title} className="flex gap-3 rounded-lg border border-line bg-surface-1 p-3">
            {step.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-positive" aria-label="Done" /> : <Circle size={18} className="mt-0.5 shrink-0 text-ink-mute" aria-hidden="true" />}
            <span>
              <span className="block text-sm font-semibold text-ink">{step.title}</span>
              <span className="block text-xs text-ink-dim">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-mute">On Yahoo Fantasy (in a browser, not the app), open your league, then the page. Select everything (Ctrl+A, or Cmd+A on a Mac), copy, and paste below. Either page first is fine.</p>
      <ScreenshotRefresh workspace={activeLeague} players={players ?? []} defaultOpen />
      <section className="rounded-lg border border-line bg-surface-1 p-4" aria-labelledby="quickstart-signin">
        <h2 id="quickstart-signin" className="text-sm font-semibold text-ink">Already have an account, or want it on your phone and laptop?</h2>
        <p className="mt-1 text-xs text-ink-dim">Sign in with your email to keep your league in sync across devices.</p>
        <div className="mt-3"><SignInForm inputId="quickstart-email" /></div>
      </section>
    </main>
  );
}
