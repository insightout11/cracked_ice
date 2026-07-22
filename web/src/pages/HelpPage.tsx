import { Calendar, Target, Moon, Repeat2, Trophy, Lightbulb } from 'lucide-react';

export function HelpPage() {
  return (
    <main className="min-h-screen ice-rink-bg">
      {/* Faint ice overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('/textures/ice-noise.png')] bg-cover" />
      <div
        className='relative z-10 container mx-auto px-4 py-6 space-y-6 max-w-4xl text-ink-dim'>
        {/* Header */}
        <div
          className='glass glow-border p-6 text-center bg-line [backdrop-filter:blur(20px)] [border:2px_solid_var(--accent)]'>
          <h1
            className='text-3xl md:text-4xl mb-4 font-bold text-accent [text-shadow:0_2px_4px_var(--surface-0),_0_0_20px_var(--accent)]'>How Cracked Ice Works</h1>
          <p className='text-lg font-medium text-ink-dim'>Your easy guide to fantasy hockey tools — no experience required.</p>
        </div>

        {/* Section 1: Schedule */}
        <section
          className='glass glow-border p-6 bg-line [backdrop-filter:blur(20px)] [border:1px_solid_var(--positive)]'>
          <h2
            className='text-2xl mb-4 flex items-center gap-3 font-bold text-positive [text-shadow:0_2px_4px_var(--surface-0)]'>
            <Calendar size={22} />
            See the Schedule
          </h2>
          <div className="space-y-4">
            <p className='text-lg font-medium text-ink-dim'>Think of this as your hockey calendar.</p>
            <div className="space-y-2">
              <p className='text-ink-dim'>• Every row = a team. Every column = a day.</p>
              <p className='text-ink-dim'>• You can instantly see who plays each day of the week.</p>
            </div>
            <div
              className='p-4 rounded-lg bg-surface-0 [border:1px_solid_var(--accent-muted)] [backdrop-filter:blur(10px)]'>
              <p className='font-medium mb-2 text-ink-dim'>Special highlights show:</p>
              <p className='text-ink-dim'>• <span className='text-warning font-bold'>OFF</span> days when there are 8 or fewer games (usually Monday, Wednesday, Friday, Sunday)</p>
              <p className='text-ink-dim'>• <span className='text-accent font-bold'>B2B</span> games when a team plays two days in a row</p>
            </div>
            <div
              className='pl-4 p-3 rounded-r-lg [border-left:4px_solid_var(--positive)] bg-accent-muted [backdrop-filter:blur(10px)]'>
              <p className='font-medium mb-1 text-positive'>Why it matters:</p>
              <p className='text-ink-dim'>If you know when teams play, you can fill your lineup on quiet nights instead of leaving empty spots.</p>
            </div>
          </div>
        </section>

        {/* Section 2: Optimizer */}
        <section
          className='glass glow-border p-6 bg-line [backdrop-filter:blur(20px)] [border:1px_solid_var(--warning)]'>
          <h2
            className='text-2xl mb-4 flex items-center gap-3 font-bold text-warning [text-shadow:0_2px_4px_var(--surface-0)]'>
            <Target size={22} />
            Find the Perfect Combo
          </h2>
          <div className="space-y-4">
            <p className='text-lg text-ink-dim'>Choose your favorite team (or the one you already have players from).</p>
            <p className='text-ink-dim'>The optimizer looks at the schedule and finds the best other teams to pair with it.</p>
            <div className="bg-[var(--surface-glass)] p-4 rounded-glass">
              <p className='font-medium mb-2 text-ink-dim'>It checks for:</p>
              <p className='text-ink-dim'>• <span className="text-bad">Fewest conflicts</span> (so your players aren't all playing on the same day)</p>
              <p className='text-ink-dim'>• <span className="text-good">Most extra games</span> (so you get more chances to score points)</p>
              <p className='text-ink-dim'>• <span className="text-ice-laser">Best off-night percentage</span> (teams that play a lot when others don't)</p>
            </div>
            <p className='text-ink-dim'>You don't need to crunch numbers — it gives you a simple ranking with colors and stars.</p>
            <div
              className='border-l-4 pl-4 p-3 rounded-r [border-color:var(--accent)] bg-line'>
              <p className='font-medium text-accent'>Why it matters:</p>
              <p className='text-ink-dim'>More games + less overlap = more fantasy points.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Off-Night Totals */}
        <section
          className='glass glow-border p-6 bg-line [backdrop-filter:blur(20px)] [border:1px_solid_var(--accent)]'>
          <h2
            className='text-2xl mb-4 flex items-center gap-3 font-bold text-accent [text-shadow:0_2px_4px_var(--surface-0)]'>
            <Moon size={22} />
            Games When Others Rest
          </h2>
          <div className="space-y-4">
            <p className='text-lg text-ink-dim'>An off-night = a day with 8 or fewer games in the NHL.</p>
            <p className='text-ink-dim'>On these days, your fantasy roster usually has empty slots.</p>
            <p className='text-ink-dim'>Teams that play a lot of off-nights = more chances to put players in.</p>
            <div className="bg-[var(--surface-glass)] p-4 rounded-glass">
              <p className='font-medium mb-2 text-ink-dim'>The page shows:</p>
              <p className='text-ink-dim'>• Each team's total off-night games</p>
              <p className='text-ink-dim'>• A simple bar or percentage so you can compare easily</p>
            </div>
            <div
              className='border-l-4 pl-4 p-3 rounded-r [border-color:var(--accent)] bg-line'>
              <p className='font-medium text-accent'>Why it matters:</p>
              <p className='text-ink-dim'>Picking players from high off-night teams gives you more usable games.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Back-to-Back Totals */}
        <section
          className='glass glow-border p-6 bg-line [backdrop-filter:blur(20px)] [border:1px_solid_var(--accent)]'>
          <h2
            className='text-2xl mb-4 flex items-center gap-3 font-bold text-accent [text-shadow:0_2px_4px_var(--surface-0)]'>
            <Repeat2 size={22} />
            Back-to-Back Games
          </h2>
          <div className="space-y-4">
            <p className='text-lg text-ink-dim'>A back-to-back = when a team plays two days in a row.</p>
            <p className='text-ink-dim'>The page shows each team's total B2Bs for the season.</p>
            <div className="bg-[var(--surface-glass)] p-4 rounded-glass">
              <p className='font-medium mb-2 text-ink-dim'>Great for:</p>
              <p className='text-ink-dim'>• <span className="text-ice-laser">Goalie streaming</span> — backup goalies often start the second night</p>
              <p className='text-ink-dim'>• <span className="text-good">Late-week pushes</span> — if you need extra games to win a matchup</p>
            </div>
            <div
              className='border-l-4 pl-4 p-3 rounded-r [border-color:var(--accent)] bg-line'>
              <p className='font-medium text-accent'>Why it matters:</p>
              <p className='text-ink-dim'>Spotting B2Bs gives you sneaky ways to get more starts.</p>
            </div>
          </div>
        </section>

        {/* Section 5: Playoffs Mode */}
        <section
          className='glass glow-border p-6 bg-line [backdrop-filter:blur(20px)] [border:1px_solid_var(--warning)]'>
          <h2
            className='text-2xl mb-4 flex items-center gap-3 font-bold text-warning [text-shadow:0_2px_4px_var(--surface-0)]'>
            <Trophy size={22} />
            Playoff Ready
          </h2>
          <div className="space-y-4">
            <p className='text-lg text-ink-dim'>Not all fantasy leagues end at the same time.</p>
            <p className='text-ink-dim'>Choose your league's playoff weeks in the app.</p>
            <div className="bg-[var(--surface-glass)] p-4 rounded-glass">
              <p className='font-medium mb-2 text-ink-dim'>The schedule updates so you can see:</p>
              <p className='text-ink-dim'>• Which teams play most during your fantasy playoffs</p>
              <p className='text-ink-dim'>• Which teams have the best off-night advantage</p>
            </div>
            <p className='text-ink-dim'>Helps you draft or pick up players who will matter most when it counts.</p>
            <div
              className='border-l-4 pl-4 p-3 rounded-r [border-color:var(--accent)] bg-line'>
              <p className='font-medium text-accent'>Why it matters:</p>
              <p className='text-ink-dim'>No point stacking players who don't play much during your playoffs.</p>
            </div>
          </div>
        </section>

        {/* Section 6: Quick Tips */}
        <section
          className='glass glow-border p-6 bg-line [backdrop-filter:blur(20px)] [border:1px_solid_var(--accent)]'>
          <h2
            className='text-2xl mb-4 flex items-center gap-3 font-bold text-accent [text-shadow:0_2px_4px_var(--surface-0)]'>
            <Lightbulb size={22} />
            Tips to Win
          </h2>
          <div className="space-y-4">
            <p className='text-lg text-ink-dim'>Short, simple advice list:</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className='p-4 rounded-glass bg-line'>
                <p className='font-medium mb-1 text-accent'>"Target off-night teams"</p>
                <p className='text-sm text-ink-dim'>→ More chances to fill empty slots</p>
              </div>
              <div className='p-4 rounded-glass bg-line'>
                <p className='font-medium mb-1 text-positive'>"Mix teams"</p>
                <p className='text-sm text-ink-dim'>→ Don't draft all from one team; spread them out so you cover more nights</p>
              </div>
              <div className='p-4 rounded-glass bg-line'>
                <p className='font-medium mb-1 text-warning'>"Look for B2Bs"</p>
                <p className='text-sm text-ink-dim'>→ Use backups or stream goalies for bonus games</p>
              </div>
              <div className='p-4 rounded-glass bg-line'>
                <p className='font-medium mb-1 text-accent'>"Plan for playoffs"</p>
                <p className='text-sm text-ink-dim'>→ Check which teams are busiest during your league's playoff weeks</p>
              </div>
            </div>
            <div
              className='border-l-4 pl-4 p-3 rounded-r [border-color:var(--accent)] bg-line'>
              <p className='font-medium text-accent'>Why it matters:</p>
              <p className='text-ink-dim'>These are the key strategies top fantasy players use, simplified.</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-text-muted py-4">
 <p>Built with for fantasy hockey players who want to win more.</p>
        </div>
      </div>
    </main>
  );
}
