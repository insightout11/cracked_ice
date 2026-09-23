import { Link } from 'react-router-dom';
import { SignInForm } from '../account/SignInForm';
import { Card } from '../Card';
import { Button } from '../ui/button';

interface MyTeamSignInGateProps {
  /** Players already saved in this device's League Workspace (e.g. from the Draft Room). */
  savedPlayerCount: number;
  /** The account session was rejected by the server rather than never started. */
  sessionExpired?: boolean;
}

/**
 * My Team's projections, lineup simulation and pickups are served by account-scoped
 * coach endpoints. Signed-out visitors get this explanation and a sign-in form instead
 * of the raw 401 those endpoints return.
 */
export function MyTeamSignInGate({ savedPlayerCount, sessionExpired = false }: MyTeamSignInGateProps) {
  return (
    <main className="min-h-screen ice-rink-bg px-4 py-10 sm:py-16">
      <Card className="mx-auto max-w-lg overflow-hidden">
        <div className="p-6">
          <p className="scoreboard-text text-accent">MY TEAM</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            {sessionExpired ? 'Sign in again to load your team' : 'Sign in to analyze your roster'}
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            {sessionExpired
              ? 'Your session has ended. Sign in with the same email to pick up where you left off.'
              : 'My Team runs lineup projections, gap nights and pickup suggestions on your account, so your roster follows you to any device. Enter your email and we’ll send a sign-in link. No password needed.'}
          </p>
          {savedPlayerCount > 0 && (
            <p className="mt-3 rounded-md border border-line bg-surface-0 p-3 text-sm text-ink-dim">
              The {savedPlayerCount}-player roster saved on this device carries over when you sign in. If your account already has a different version, you choose which to keep.
            </p>
          )}
          <SignInForm inputId="my-team-email" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
          <span className="text-xs text-ink-mute">No account needed for:</span>
          <Button asChild variant="ghost" size="sm"><Link to="/draft">Draft Board</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/season">Schedule</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/compare">Compare players</Link></Button>
        </div>
      </Card>
    </main>
  );
}
