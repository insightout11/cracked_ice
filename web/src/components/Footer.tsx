import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CoffeeLink } from './CoffeeLink';
import { formatDateTime } from '../lib/dataFreshness';
import { SEASON_LABEL } from '../lib/season';

const FAQ_ITEMS = [
  {
    question: 'What is an off-night?',
    answer: 'A night with a lighter NHL schedule. Players on those dates are easier to fit into an active fantasy lineup instead of being stranded on your bench.',
  },
  {
    question: 'Why do schedule pairings matter?',
    answer: 'Two equally productive players can create different usable totals when their teams play on different nights. Cracked Ice measures that lineup-room advantage before you add one.',
  },
  {
    question: 'Does the Optimizer use my league settings?',
    answer: 'Schedule fit always uses NHL game dates and your selected lineup slots. Signed-in points leagues can use their scoring profile; otherwise production estimates are clearly labeled with the default model.',
  },
] as const;

export function Footer() {
  const [lastHydrated, setLastHydrated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.lastHydrated) setLastHydrated(data.lastHydrated);
      })
      .catch(() => {
        /* Freshness is best-effort. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="mt-14 border-t border-line bg-surface-0/70 px-4 py-10 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-5xl">
        <section aria-labelledby="faq-heading">
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-accent">Quick answers</p>
          <h2 id="faq-heading" className="mt-2 font-display text-2xl font-bold text-ink">Fantasy schedule math, explained</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group rounded-lg border border-line bg-surface-glass p-4 open:border-line-strong open:bg-surface-raised">
                <summary className="cursor-pointer font-semibold text-ink marker:text-accent">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-dim">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 border-t border-line pt-8 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <img src="/logo-horizontal.svg" alt="Cracked Ice" className="h-8 w-auto" />
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-dim">
              Free tools that turn the NHL schedule into practical fantasy-hockey roster and lineup decisions.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold" role="navigation" aria-label="Footer navigation">
              <Link to="/" className="text-ink hover:text-accent">Optimizer</Link>
              <Link to="/season" className="text-ink hover:text-accent">Weekly schedule</Link>
              <Link to="/game-analysis" className="text-ink hover:text-accent">Off-nights & back-to-backs</Link>
              <Link to="/team" className="text-ink hover:text-accent">My Team</Link>
              <Link to="/blog" className="text-ink hover:text-accent">Strategy blog</Link>
            </div>
          </div>
          <CoffeeLink variant="footer" />
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-5 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cracked Ice Hockey</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
            <Link to="/privacy" className="hover:text-accent">Privacy</Link>
            <Link to="/terms" className="hover:text-accent">Terms</Link>
            <Link to="/contact" className="hover:text-accent">Contact</Link>
            <span>{SEASON_LABEL} season · Data updated nightly{lastHydrated ? ` · Last refresh: ${formatDateTime(lastHydrated)}` : ''}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
