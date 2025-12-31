export function HelpPage() {
  return (
    <main className="min-h-screen ice-rink-bg">
      {/* Faint ice overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('/textures/ice-noise.png')] bg-cover" />
      
      <div className="relative z-10 container mx-auto px-4 py-6 space-y-6 max-w-4xl" style={{ color: '#0E1A2B' }}>
        {/* Header */}
        <div className="glass glow-border p-6 text-center" style={{ 
          background: 'rgba(255, 255, 255, 0.12)', 
          backdropFilter: 'blur(20px)',
          border: '2px solid #5EF5FF'
        }}>
          <h1 className="text-3xl md:text-4xl mb-4 font-bold" style={{ 
            color: 'var(--laser-cyan)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 1), 0 0 20px var(--laser-cyan)'
          }}>How Cracked Ice Works</h1>
          <p className="text-lg font-medium" style={{ color: '#0E1A2B' }}>Your easy guide to fantasy hockey tools — no experience required.</p>
        </div>

        {/* Section 1: Schedule */}
        <section className="glass glow-border p-6" style={{ 
          background: 'rgba(255, 255, 255, 0.12)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--neon-mint)'
        }}>
          <h2 className="text-2xl mb-4 flex items-center gap-3 font-bold" style={{
            color: 'var(--neon-mint)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            <span>🗓️</span>
            See the Schedule
          </h2>
          <div className="space-y-4">
            <p className="text-lg font-medium" style={{ color: '#0E1A2B' }}>Think of this as your hockey calendar.</p>
            <div className="space-y-2">
              <p style={{ color: '#0E1A2B' }}>• Every row = a team. Every column = a day.</p>
              <p style={{ color: '#0E1A2B' }}>• You can instantly see who plays each day of the week.</p>
            </div>
            <div className="p-4 rounded-lg" style={{ 
              background: 'rgba(0, 0, 0, 0.4)', 
              border: '1px solid rgba(132, 247, 166, 0.3)',
              backdropFilter: 'blur(10px)'
            }}>
              <p className="font-medium mb-2" style={{ color: '#0E1A2B' }}>Special highlights show:</p>
              <p style={{ color: '#0E1A2B' }}>• <span style={{ color: '#FFD27E', fontWeight: 'bold' }}>OFF</span> days when there are 8 or fewer games (usually Monday, Wednesday, Friday, Sunday)</p>
              <p style={{ color: '#0E1A2B' }}>• <span style={{ color: '#5EF5FF', fontWeight: 'bold' }}>B2B</span> games when a team plays two days in a row</p>
            </div>
            <div className="pl-4 p-3 rounded-r-lg" style={{ 
              borderLeft: '4px solid #84F7A6', 
              background: 'rgba(132, 247, 166, 0.1)',
              backdropFilter: 'blur(10px)'
            }}>
              <p className="font-medium mb-1" style={{ color: '#84F7A6' }}>Why it matters:</p>
              <p style={{ color: '#0E1A2B' }}>If you know when teams play, you can fill your lineup on quiet nights instead of leaving empty spots.</p>
            </div>
          </div>
        </section>

        {/* Section 2: Optimizer */}
        <section className="glass glow-border p-6" style={{ 
          background: 'rgba(255, 255, 255, 0.12)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--warm-gold)'
        }}>
          <h2 className="text-2xl mb-4 flex items-center gap-3 font-bold" style={{
            color: 'var(--warm-gold)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            <span>⚡</span>
            Find the Perfect Combo
          </h2>
          <div className="space-y-4">
            <p className="text-lg" style={{ color: '#0E1A2B' }}>Choose your favorite team (or the one you already have players from).</p>
            <p style={{ color: '#0E1A2B' }}>The optimizer looks at the schedule and finds the best other teams to pair with it.</p>
            <div className="bg-[var(--glass-fill)] p-4 rounded-glass">
              <p className="font-medium mb-2" style={{ color: '#0E1A2B' }}>It checks for:</p>
              <p style={{ color: '#0E1A2B' }}>• <span className="text-bad">Fewest conflicts</span> (so your players aren't all playing on the same day)</p>
              <p style={{ color: '#0E1A2B' }}>• <span className="text-good">Most extra games</span> (so you get more chances to score points)</p>
              <p style={{ color: '#0E1A2B' }}>• <span className="text-ice-laser">Best off-night percentage</span> (teams that play a lot when others don't)</p>
            </div>
            <p style={{ color: '#0E1A2B' }}>You don't need to crunch numbers — it gives you a simple ranking with colors and stars.</p>
            <div className="border-l-4 pl-4 p-3 rounded-r" style={{ borderColor: 'var(--laser-cyan)', background: 'rgba(255, 255, 255, 0.3)' }}>
              <p className="font-medium" style={{ color: 'var(--laser-cyan)' }}>Why it matters:</p>
              <p style={{ color: '#0E1A2B' }}>More games + less overlap = more fantasy points.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Off-Night Totals */}
        <section className="glass glow-border p-6" style={{ 
          background: 'rgba(255, 255, 255, 0.12)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--electric-teal)'
        }}>
          <h2 className="text-2xl mb-4 flex items-center gap-3 font-bold" style={{
            color: 'var(--electric-teal)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            <span>🌙</span>
            Games When Others Rest
          </h2>
          <div className="space-y-4">
            <p className="text-lg" style={{ color: '#0E1A2B' }}>An off-night = a day with 8 or fewer games in the NHL.</p>
            <p style={{ color: '#0E1A2B' }}>On these days, your fantasy roster usually has empty slots.</p>
            <p style={{ color: '#0E1A2B' }}>Teams that play a lot of off-nights = more chances to put players in.</p>
            <div className="bg-[var(--glass-fill)] p-4 rounded-glass">
              <p className="font-medium mb-2" style={{ color: '#0E1A2B' }}>The page shows:</p>
              <p style={{ color: '#0E1A2B' }}>• Each team's total off-night games</p>
              <p style={{ color: '#0E1A2B' }}>• A simple bar or percentage so you can compare easily</p>
            </div>
            <div className="border-l-4 pl-4 p-3 rounded-r" style={{ borderColor: 'var(--laser-cyan)', background: 'rgba(255, 255, 255, 0.3)' }}>
              <p className="font-medium" style={{ color: 'var(--laser-cyan)' }}>Why it matters:</p>
              <p style={{ color: '#0E1A2B' }}>Picking players from high off-night teams gives you more usable games.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Back-to-Back Totals */}
        <section className="glass glow-border p-6" style={{ 
          background: 'rgba(255, 255, 255, 0.12)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--aurora-violet)'
        }}>
          <h2 className="text-2xl mb-4 flex items-center gap-3 font-bold" style={{
            color: 'var(--aurora-violet)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            <span>🔁</span>
            Back-to-Back Games
          </h2>
          <div className="space-y-4">
            <p className="text-lg" style={{ color: '#0E1A2B' }}>A back-to-back = when a team plays two days in a row.</p>
            <p style={{ color: '#0E1A2B' }}>The page shows each team's total B2Bs for the season.</p>
            <div className="bg-[var(--glass-fill)] p-4 rounded-glass">
              <p className="font-medium mb-2" style={{ color: '#0E1A2B' }}>Great for:</p>
              <p style={{ color: '#0E1A2B' }}>• <span className="text-ice-laser">Goalie streaming</span> — backup goalies often start the second night</p>
              <p style={{ color: '#0E1A2B' }}>• <span className="text-good">Late-week pushes</span> — if you need extra games to win a matchup</p>
            </div>
            <div className="border-l-4 pl-4 p-3 rounded-r" style={{ borderColor: 'var(--laser-cyan)', background: 'rgba(255, 255, 255, 0.3)' }}>
              <p className="font-medium" style={{ color: 'var(--laser-cyan)' }}>Why it matters:</p>
              <p style={{ color: '#0E1A2B' }}>Spotting B2Bs gives you sneaky ways to get more starts.</p>
            </div>
          </div>
        </section>

        {/* Section 5: Playoffs Mode */}
        <section className="glass glow-border p-6" style={{ 
          background: 'rgba(255, 255, 255, 0.12)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--warm-gold)'
        }}>
          <h2 className="text-2xl mb-4 flex items-center gap-3 font-bold" style={{
            color: 'var(--warm-gold)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            <span>🏆</span>
            Playoff Ready
          </h2>
          <div className="space-y-4">
            <p className="text-lg" style={{ color: '#0E1A2B' }}>Not all fantasy leagues end at the same time.</p>
            <p style={{ color: '#0E1A2B' }}>Choose your league's playoff weeks in the app.</p>
            <div className="bg-[var(--glass-fill)] p-4 rounded-glass">
              <p className="font-medium mb-2" style={{ color: '#0E1A2B' }}>The schedule updates so you can see:</p>
              <p style={{ color: '#0E1A2B' }}>• Which teams play most during your fantasy playoffs</p>
              <p style={{ color: '#0E1A2B' }}>• Which teams have the best off-night advantage</p>
            </div>
            <p style={{ color: '#0E1A2B' }}>Helps you draft or pick up players who will matter most when it counts.</p>
            <div className="border-l-4 pl-4 p-3 rounded-r" style={{ borderColor: 'var(--laser-cyan)', background: 'rgba(255, 255, 255, 0.3)' }}>
              <p className="font-medium" style={{ color: 'var(--laser-cyan)' }}>Why it matters:</p>
              <p style={{ color: '#0E1A2B' }}>No point stacking players who don't play much during your playoffs.</p>
            </div>
          </div>
        </section>

        {/* Section 6: Quick Tips */}
        <section className="glass glow-border p-6" style={{ 
          background: 'rgba(255, 255, 255, 0.12)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--laser-cyan)'
        }}>
          <h2 className="text-2xl mb-4 flex items-center gap-3 font-bold" style={{
            color: 'var(--laser-cyan)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            <span>💡</span>
            Tips to Win
          </h2>
          <div className="space-y-4">
            <p className="text-lg" style={{ color: '#0E1A2B' }}>Short, simple advice list:</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-glass" style={{ background: 'rgba(255, 255, 255, 0.25)' }}>
                <p className="font-medium mb-1" style={{ color: 'var(--laser-cyan)' }}>"Target off-night teams"</p>
                <p className="text-sm" style={{ color: '#0E1A2B' }}>→ More chances to fill empty slots</p>
              </div>
              <div className="p-4 rounded-glass" style={{ background: 'rgba(255, 255, 255, 0.25)' }}>
                <p className="font-medium mb-1" style={{ color: 'var(--good)' }}>"Mix teams"</p>
                <p className="text-sm" style={{ color: '#0E1A2B' }}>→ Don't draft all from one team; spread them out so you cover more nights</p>
              </div>
              <div className="p-4 rounded-glass" style={{ background: 'rgba(255, 255, 255, 0.25)' }}>
                <p className="font-medium mb-1" style={{ color: 'var(--warn)' }}>"Look for B2Bs"</p>
                <p className="text-sm" style={{ color: '#0E1A2B' }}>→ Use backups or stream goalies for bonus games</p>
              </div>
              <div className="p-4 rounded-glass" style={{ background: 'rgba(255, 255, 255, 0.25)' }}>
                <p className="font-medium mb-1" style={{ color: 'var(--laser-cyan)' }}>"Plan for playoffs"</p>
                <p className="text-sm" style={{ color: '#0E1A2B' }}>→ Check which teams are busiest during your league's playoff weeks</p>
              </div>
            </div>
            <div className="border-l-4 pl-4 p-3 rounded-r" style={{ borderColor: 'var(--laser-cyan)', background: 'rgba(255, 255, 255, 0.3)' }}>
              <p className="font-medium" style={{ color: 'var(--laser-cyan)' }}>Why it matters:</p>
              <p style={{ color: '#0E1A2B' }}>These are the key strategies top fantasy players use, simplified.</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-text-muted py-4">
          <p>Built with ❄️ for fantasy hockey players who want to win more.</p>
        </div>
      </div>
    </main>
  );
}