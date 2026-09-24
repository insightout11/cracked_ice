import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { track } from '../../lib/analytics';
import '../rosterCard/rosterCard.css';

/**
 * Home spot for the Roster Card. The small card is a static illustration (no player
 * data loads on Home); a saved roster of 5+ opens straight onto its own card.
 */
export function RosterCardPromo({ savedRosterSize }: { savedRosterSize: number }) {
  const hasTeam = savedRosterSize >= 5;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line-strong bg-surface-1 p-5 sm:p-7" aria-labelledby="roster-card-promo-heading">
      <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning"><Sparkles size={15} aria-hidden="true" />New: Roster Card</p>
          <h2 id="roster-card-promo-heading" className="mt-2 font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">What does your draft say about you?</h2>
          <p className="mt-2 max-w-xl text-base text-ink-dim">Paste your roster and get a team name, a verdict on your draft, and facts nobody asked for. Then send it to your league chat and see what theirs says.</p>
          <Link
            to={hasTeam ? '/card?use=saved' : '/card'}
            onClick={() => track('roster_card_promo_click', { placement: 'home' })}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-accent-ink"
          >
            {hasTeam ? 'Make a card for my team' : 'Make my roster card'}
          </Link>
        </div>
        <div className="hidden justify-self-center sm:block" aria-hidden="true">
          <div className="roster-card-foil w-44 rotate-[4deg] rounded-[18px] p-[3px]">
            <div className="roster-card-face rounded-[15px] px-4 pb-4 pt-3.5">
              <p className="font-display text-[9px] font-extrabold tracking-wide text-[#f2fbff]">CRACKED ICE</p>
              <p className="roster-card-name mt-3 text-[22px] leading-none">Mack the Knife</p>
              <span className="roster-card-stamp mt-3 inline-block -rotate-2 rounded px-1.5 py-0.5 text-[10px]">The Youth Movement</span>
              <p className="mt-2 text-[9px] leading-snug text-[#dcecf5]">Half your roster needs a signed permission slip for road trips.</p>
              <div className="mt-3 space-y-1 border-t border-[#63e6ff]/20 pt-2">
                <span className="block h-1.5 w-full rounded bg-[#b9cfdc]/25" />
                <span className="block h-1.5 w-4/5 rounded bg-[#b9cfdc]/25" />
                <span className="block h-1.5 w-3/5 rounded bg-[#b9cfdc]/25" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
