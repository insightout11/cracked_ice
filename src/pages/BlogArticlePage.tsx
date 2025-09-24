import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CoffeeLink } from '../components/CoffeeLink';

interface BlogArticle {
  id: string;
  title: string;
  content: string;
  publishDate: string;
  readTimeMinutes: number;
  tags: string[];
  imageUrl?: string;
  author?: string;
}

export function BlogArticlePage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Article ID not found');
      setLoading(false);
      return;
    }

    // In a real implementation, this would fetch from an API or data source
    let mockArticle: BlogArticle | null = null;

    if (id === 'zero-bench-mock-draft-2025') {
      mockArticle = {
        id: id,
        title: 'Zero Bench: A Championship-Winning Mock Draft Using ONLY Schedule Math',
        content: `
# Zero Bench: A Championship-Winning Mock Draft Using ONLY Schedule Math

**Blindsided by the Response**

The feedback from my position stacking article hit me like a Jacob Trouba blindside check. I didn't see it coming: people actually building their rosters around the math, asking for more advanced features, demanding a complete draft preparation system. Now I'm flat on my back seeing stars... and lots of pretty colors.

Not the concussion kind of colors, but the kind that represent the next evolution in championship draft preparation. **<span style="color: #5ef5ff;">Cyan teams</span>** that dominate your playoff weeks. **<span style="color: #3b82f6;">Blue squads</span>** that peak when everyone else's rosters crumble. **<span style="color: #22c55e;">Green workhorses</span>** that get you there. And those **<span style="color: #ef4444;">red disaster schedules</span>** you avoid like another Trouba hit to the head.

So while everyone else memorizes ADP rankings, I built something that maps every team's schedule against your league's specific playoff weeks. Position stacking was just the beginning.

**Welcome to Zero Bench draft preparation: championship warfare through schedule math.**

**The Championship-First Philosophy**

Zero G from Apples & Ginos changed how we think about goalie value, but there's another Zero concept that's even more important for championships: **Zero Bench**.

Stop watching your good players ride the pine while inferior options start because of schedule conflicts. Zero Bench drafting minimizes bench conflicts and maximizes games all season long, with special focus on YOUR championship weeks. This approach typically unlocks **15-20 extra games** over a season while your opponents debate who to bench.

For this mock draft demonstration, I'm using three tools from Cracked Ice Hockey (all completely free): color-coded team tiers that rank schedules for your specific playoff weeks, the complement analysis optimizer that simulates lineup conflicts, and the weekly schedule view that shows streaming opportunities.

**The Mock Draft Setup**

**12-team H2H league**, daily lineups, standard points league. Using Apples & Ginos ADP as my baseline (much more realistic than Yahoo's current rankings) but prioritizing schedule math for my league's championship weeks **(March 16 - April 5)**.

I stayed within 10 picks on the back end of A&G's ADP throughout the draft - if I'm picking at 60, I can choose from picks 60-70, letting schedule math determine the final selection within that realistic range.

**The Challenge:** Can schedule optimization alone build a championship roster, or will ignoring talent rankings completely backfire?

<img src="/coloredTeams.png" alt="Color-Coded Team Tiers for Championship Weeks" className="w-full rounded-xl my-6 shadow-lg" />

**The Zero Bench Draft: Engineering Championships**

**Rounds 1-5: Elite Talent with Championship Edge**

**<span style="color: #ffd36a;">Pick 8:</span> <span style="color: #5ef5ff;">David Pastrnak</span> (RW, BOS)** - ADP 8

Perfect ADP value here, but Boston's solid playoff schedule gives him the edge over other elite wingers at this spot. Right wing is thin enough that you need to secure it early, and Pastrnak delivers both talent and championship-friendly timing.

**<span style="color: #ffd36a;">Pick 17:</span> <span style="color: #5ef5ff;">Artemi Panarin</span> (LW, NYR)**

Rangers are a **Cyan team** - everything went wrong for them last season, but they should bounce back hard. Panarin hitting 100 points again with that playoff schedule? That's championship math right there.

**<span style="color: #ffd36a;">Pick 32:</span> <span style="color: #5ef5ff;">Adam Fox</span> (D, NYR)** - ADP 35

Same Cyan rationale as Panarin, with slight ADP value as a bonus. Get your stud defenseman early, and when that stud plays for a team optimized for your championship weeks, you've got the perfect combination of talent and schedule.

**<span style="color: #ffd36a;">Pick 41:</span> <span style="color: #5ef5ff;">Elias Pettersson</span> (C/LW, VAN)**

Another **Cyan team**, another bounceback candidate. The C/LW flexibility is bonus value, but the real appeal is Vancouver's championship schedule combined with Pettersson's inevitable return to form.

**<span style="color: #ffd36a;">Pick 56:</span> <span style="color: #5ef5ff;">Thomas Harley</span> (D, DAL)**

Here's where Zero Bench thinking starts taking over. Can Harley commandeer that Dallas power play? The upside is massive, and Dallas has elite playoff scheduling. For defensemen, I'm hunting for volume during championship weeks since I'm not rostering five blue-liners.

**Rounds 6-11: Where Championships Are Engineered**

**<span style="color: #ffd36a;">Pick 65:</span> <span style="color: #5ef5ff;">Nico Hischier</span> (C, NJD)**

**Cyan team**, solid center depth. New Jersey's championship schedule makes Hischier a better pick than his ADP suggests.

**<span style="color: #ffd36a;">Pick 80:</span> <span style="color: #5ef5ff;">Igor Shesterkin</span> (G, NYR)**

Triple down on that **Cyan Rangers** schedule. Shesterkin's due for a bounceback season, and when he's dialed in during your championship weeks, you've got elite goaltending when it matters most.

**<span style="color: #ffd36a;">Pick 89:</span> <span style="color: #5ef5ff;">Vincent Trochek</span> (C, NYR)** - ADP 95

The complement analysis lights up here. With <span style="color: #5ef5ff;">Pettersson</span> and <span style="color: #5ef5ff;">Hischier</span> from VAN and NJD, <span style="color: #5ef5ff;">Trochek</span> was a perfect choice according to the complement analysis tool and slots perfectly into the schedule, maximizing games from that third center slot. This is pure Zero Bench optimization paying dividends.

<img src="/Trochek.png" alt="Vincent Trochek - Perfect Zero Bench Pick" className="w-full rounded-xl my-6 shadow-lg" />

**<span style="color: #ffd36a;">Pick 104:</span> <span style="color: #5ef5ff;">Rickard Rakell</span> (C/LW/RW, PIT)**

**Blue playoff team** with tri-positional eligibility. When you need lineup flexibility during championship weeks, Rakell can slide into whatever slot is open. Schedule math over pure talent.

**<span style="color: #ffd36a;">Pick 113:</span> <span style="color: #5ef5ff;">Shayne Gostisbehere</span> (D, CAR)**

Power play points from a playoff team. Carolina's championship schedule plus Ghost's offensive upside makes this a classic mid-round Zero Bench selection.

**Rounds 12-16: Loading the Championship Arsenal**

**<span style="color: #ffd36a;">Pick 128:</span> <span style="color: #5ef5ff;">Troy Terry</span> (RW, ANA)**

Complement analysis strikes again. Terry fits perfectly into the schedule puzzle, giving me right wing depth when my other players are off.

**<span style="color: #ffd36a;">Pick 137:</span> <span style="color: #5ef5ff;">William Eklund</span> (LW, SJS)**

Another complement analysis special. Eklund fills schedule gaps at left wing while providing young upside on a team with favorable game distribution.

**<span style="color: #ffd36a;">Pick 152:</span> <span style="color: #5ef5ff;">Lukas Dostal</span> (G, ANA)**

Off-night specialist. Dostal plays when other goalies sit, perfect for streaming optimization and championship roster construction.

**<span style="color: #ffd36a;">Pick 161:</span> <span style="color: #5ef5ff;">Sam Rinzel</span> (D, CHI)**

**Cyan team** with massive breakout potential. If <span style="color: #5ef5ff;">Rinzel</span> clicks, you've got a championship difference-maker. If not, Chicago's schedule still provides value.

**<span style="color: #ffd36a;">Pick 176:</span> <span style="color: #5ef5ff;">Karel Vejmelka</span> (G, UTA)**

The complement analysis showed this as the perfect third goalie. Already having <span style="color: #5ef5ff;">Shesterkin</span> (NYR) and <span style="color: #5ef5ff;">Dostal</span> (ANA), <span style="color: #5ef5ff;">Vejmelka</span> slots into the exact schedule gaps my other goalies leave, maximizing starts from the position. With the Mammoth moving on from <span style="color: #5ef5ff;">Ingram</span>, Veggie looks even more likely to get volume on an up and coming team with a great off-night schedule.

<img src="/Vejmelka.png" alt="Karel Vejmelka - Schedule Math Goldmine" className="w-full rounded-xl my-6 shadow-lg" />

**<span style="color: #ffd36a;">Pick 185:</span> <span style="color: #5ef5ff;">Andrei Kuzmenko</span> (LW/RW, LA)**

Here's the streaming edge in action. LA starts with back-to-backs before many teams play their first game. Draft Kuzmenko, bank those early streams, then pivot to someone else. Championship preparation starts in week one.

<img src="/schedule.png" alt="NHL Schedule Matrix for Championship Planning" className="w-full rounded-xl my-6 shadow-lg" />

**The Final Tally**

This roster demonstrates Zero Bench philosophy in action: elite talent anchored by championship-optimized role players, position flexibility where it matters, and a goalie rotation designed for maximum starts. While opponents debate projections, this team is engineered for the games that decide leagues.

**Final Picks: The Streaming Edge**

Target teams with early back-to-backs (LA's opening week) to "bank" streaming games and stay ahead on weekly moves. Front-loading streams keeps you playing from ahead all season.

**Your Championship Blueprint**

**Different Goals, Different Colors**

If you just want to make playoffs, target **Green teams** - solid regular season production will get you there safely. But we're not here for participation trophies. We're championship-or-bust degenerates who understand that second place is first loser.

**The Championship Obsession**

1. **Set your playoff weeks** in the tool - colors update based on YOUR league's championship schedule
2. **Draft by color priority** - <span style="color: #5ef5ff;">Cyan</span> first, then <span style="color: #3b82f6;">Blue</span>/<span style="color: #22c55e;">Green</span>, avoid <span style="color: #ef4444;">Red</span> unless generational
3. **Use complement analysis** at each pick to prevent position conflicts
4. **Target early back-to-backs** for streaming advantages
5. **Think championship first** - regular season is just qualifying

This isn't about having a nice, balanced roster. This is about engineering a machine that destroys the competition when money changes hands. While your opponents are content with solid seasons, you're building for March madness in the fantasy hockey world.

**The Zero Bench Advantage**

The core tools that make championship-level schedule optimization possible are live at **crackedicehockey.com**. Position stack calculator, color-coded team tiers, and complement analysis that turns draft strategy from guesswork into mathematical precision.

Zero Bench isn't about having a better regular season. It's about engineering a roster that peaks when everyone else's crumbles under schedule conflicts.

While your league mates are googling "best week 23 streamers" in desperation during championship week, you'll be starting a full lineup of players whose schedules you optimized months ago. That's not luck - that's championship-level preparation meeting mathematical precision.

**Your opponents are drafting for September. You're drafting for March.** That's the difference between making playoffs and winning them.

**[Build Your Championship Roster](https://www.crackedicehockey.com)**
        `.trim(),
        publishDate: '2025-09-24',
        readTimeMinutes: 12,
        tags: ['draft', 'strategy', 'mock-draft', 'championship', 'schedule-math'],
        author: 'Cracked Ice Analytics',
        imageUrl: '/zeroBench.png'
      };
    } else if (id === 'position-group-stacks-2025') {
      mockArticle = {
        id: id,
        title: 'Best Position Group Stacks for Fantasy Hockey 2025-26',
        content: `
# Best Position Group Stacks for Fantasy Hockey 2025-26

## Stop Benching Good Players: The Position Stack Solution

There I was, three drinks deep into another failed fantasy draft review, watching my league mates celebrate their shiny new rosters full of household names and obvious picks, when it hit me like a Mike Tyson haymaker: **every fantasy guide talks about the same tired garbage.**

Best players! Sleeper picks! Dark horse candidates!

Meanwhile, nobody, and I mean *nobody*, is talking about the real edge that separates the wheat from the chaff: position group synergy across teams. While your opponents are busy googling "Jack Hughes injury history" for the fifteenth time, you could be quietly assembling a roster that maximizes every single lineup slot through mathematical precision.

This isn't about stacking teammates or riding the flavor-of-the-month prospect train. This is about weaponizing the NHL schedule itself, turning your depth picks into a finely-tuned machine that churns out games while your competition leaves points on the table every week.

Welcome to the underground world of position stacking, where winning beats feeling good about your draft picks.

## The Science Behind the Strategy

Here's the simple truth most fantasy players miss: **your roster construction determines how many games you actually get to use.**

Say you draft two elite centers first. Now you're looking for a third center to fill that final lineup spot. Most players will have schedule conflicts with your first two picks, leaving you with empty lineup slots on certain nights.

But if you choose the *right* third center (one whose team plays on different nights than your first two) suddenly that player can slide into your lineup 55+ times instead of just 30-40 times.

**That's what the "+55 bonus starts" means**: out of an 82-game season, your third player can actually get into your starting lineup 55 times because their schedule complements your other picks.

## How Our Tool Calculates This

Our engine works dynamically as you build your roster:

1. **Pick your first player** → We analyze their team's schedule
2. **Pick your second player** → We show how often they conflict with Player #1
3. **Choose your third player** → We calculate exactly how many games they can play in your remaining lineup slots
4. **Keep going** → Add 4th or even 5th players at the same position for deeper leagues

**The magic happens in real-time**: as you select different combinations, the "bonus starts" number updates instantly based on actual schedule conflicts and available lineup spots.

**Flexible timeframes**: Need help with just the next two weeks? Planning for a playoff push? The tool adjusts calculations for any time period: full season, monthly stretches, or weekly optimization.

This turns draft strategy from guesswork into mathematical precision: you can see exactly how many additional starts each player will contribute before you draft them.

---

## Position Stack Hall of Fame

### 🏆 Triple Crown Center Massacre (C)

<img src="/CStack.png" alt="Center Position Stack - Matthews, Scheifele, Trochek" className="w-full rounded-xl my-6" />

**Players**: A. Matthews (TOR), M. Scheifele (WPG), V. Trochek (NYR)
**Bonus Starts**: **+55**
**Why It Works**: Perfect off-night coverage, elite anchor + mid-value + late steal
**Best For**: Managers leaning into center depth dominance

Draft Matthews in the 1st round for elite production, grab Scheifele as your mid-round value play, then steal Trochek in the late rounds as your schedule-breaking third center.

**Compare to**: A. Matthews, M. Celebrini, M. Beniers (+37 starts)
**The Gap**: **18 bonus starts** just by choosing the right third center

---

### ⚔️ Port Side Domination (LW)

<img src="/LWStack.png" alt="Left Wing Position Stack - Kaprizov, Panarin, Gauthier" className="w-full rounded-xl my-6" />

**Players**: K. Kaprizov (MIN), A. Panarin (NYR), C. Gauthier (ANA)
**Bonus Starts**: **+57**
**Why It Works**: Elite talent + proven veteran + rookie in schedule paradise
**Best For**: Contrarian managers who draft with calculators, not feelings

The genius move is grabbing Gauthier in the depths of your draft when everyone else chases last year's breakouts. Anaheim's schedule turns your throwaway pick into a weekly starter.

**Compare to**: K. Kaprizov, K. Connor, W. Eklund (+37 starts)
**The Gap**: **20 more opportunities** to rack up points

---

### ⚡ Sniper's Paradise (RW)

<img src="/RWStack.png" alt="Right Wing Position Stack - Kucherov, Necas, Wilson" className="w-full rounded-xl my-6" />

**Players**: N. Kucherov (TBL), M. Necas (COL), T. Wilson (WSH)
**Bonus Starts**: **+55**
**Why It Works**: Elite ceiling + breakout narrative + reformed goon in perfect schedule
**Best For**: Managers who draft with ruthless efficiency over popular names

Welcome to the land of misfit toys where a reformed enforcer becomes your secret weapon. Kucherov brings Art Ross Trophy potential, Necas provides the breakout everyone loves in Colorado's high-octane system, but Wilson separates you from the sheep: evolved from knuckle-dragger to legitimate multi-category contributor.

**Compare to**: N. Kucherov, M. Michkov, K. Marchenko (+38 starts)
**The Gap**: **17 additional starts** while Wilson pads stats and Marchenko watches from the bench

---

### 🛡️ Blue Line Syndicate (D)

<img src="/DStack.png" alt="Defense Position Stack - Makar, Dahlin, Sergachev, Chychrun, Fowler" className="w-full rounded-xl my-6" />

**Players**: C. Makar (COL), R. Dahlin (BUF), M. Sergachev (UTA), J. Chychrun (WSH), C. Fowler (STL)
**Bonus Starts**: **+69** *(nice)*
**Why It Works**: Offensive anchor + depth spread across optimal schedules
**Best For**: Deep league specialists who understand defensive arbitrage

Makar anchors with elite talent, while the depth crew (Sergachev in Utah's schedule paradise, Chychrun's Washington revival, reliable Fowler in St. Louis) grinds out stats without lineup conflicts.

**Compare to**: C. Makar, M. Heiskanen, S. Jones, E. Karlsson, N. Dobson (+53 starts)
**The Gap**: **16 additional starts** by choosing schedule over pedigree

---

### 🥅 Crease Cartel (G)

<img src="/GStack.png" alt="Goalie Position Stack - Shesterkin, Binnington, Vejmelka" className="w-full rounded-xl my-6" />

**Players**: I. Shesterkin (NYR), J. Binnington (STL), K. Vejmelka (UTA)
**Bonus Starts**: **+63**
**Why It Works**: Elite anchor + veteran stability + volume play in schedule goldmine
**Best For**: Goalie streaming addicts who optimize daily lineups

Shesterkin provides the elite foundation, Binnington offers proven consistency, and Vejmelka (trapped in Utah's rebuild) sees massive volume on the most fantasy-friendly schedule in the league.

**Compare to**: I. Shesterkin, S. Bobrovsky, J. Saros (+43 starts)
**The Gap**: **20 additional starts** by embracing chaos over comfort

---

## When to Deploy Position Stacks

**Pre-Draft Planning**: Map out position stacks before your draft to identify target players and complementary schedules. Know which teams to target in later rounds.

**Live Draft Strategy**: Use real-time stack analysis to make smarter picks. When choosing between similar players, let schedule optimization be your tiebreaker.

**Post-Draft Surgery**: You've got your stars: now acquire role players who complement rather than compete with them for lineup spots.

**Trade Negotiations**: Look for schedule complements over pure talent upgrades. A "worse" player with 15 extra games might outscore the "better" player you bench.

**Waiver Wire Strategy**: Target missing pieces that complete your position stack rather than chasing last week's hot streak.

**Streaming Operations**: Weekly pickups that align with your existing stack turn guesswork into systematic advantage.

## The Mathematical Truth

Position stacks turn roster construction into applied mathematics. While your league mates obsess over whether Player X will score 25 or 30 goals, you're building a machine that generates value through pure volume advantage.

The uncomfortable reality: Player Y with 20 goals might outscore Player X in your fantasy lineup simply because Player Y gets 20 more opportunities to contribute.

This is your invitation to stop thinking like everyone else and start building rosters that win through mathematical superiority.

## Your Next Move

Ready to stop playing fantasy hockey like an amateur?

Our complement and team synergy engine handles the mathematical heavy lifting so you can focus on watching your perfectly balanced roster demolish the competition while they're still trying to figure out why their "obvious" picks keep underperforming.

**Find your position stack. Build your machine. Win your league.**

The calculator is waiting. The only question is whether you're ready to handle the truth.

**[Calculate Now](https://www.crackedicehockey.com)**
        `.trim(),
        publishDate: '2025-09-18',
        readTimeMinutes: 8,
        tags: ['strategy', 'draft', 'position-stacks', 'advanced'],
        author: 'Cracked Ice Analytics',
        imageUrl: '/blog1.png'
      };
    }

    // Simulate API delay
    setTimeout(() => {
      setArticle(mockArticle);
      setLoading(false);
    }, 500);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center" style={{background: 'linear-gradient(135deg, #0b1220 0%, #1a2332 100%)'}}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mb-4"></div>
          <p className="text-white">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center" style={{background: 'linear-gradient(135deg, #0b1220 0%, #1a2332 100%)'}}>
        <div className="text-center">
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-6 py-4 rounded-lg max-w-md">
            {error || 'Article not found'}
          </div>
          <Link
            to="/blog"
            className="inline-block mt-4 px-6 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-400 rounded-lg hover:bg-cyan-400 hover:text-gray-900 transition-all duration-200 font-medium"
          >
            ← Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220]" style={{background: 'linear-gradient(135deg, #0b1220 0%, #1a2332 100%)'}}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back to Blog Link */}
          <div className="mb-8">
            <Link
              to="/blog"
              className="inline-flex items-center text-gray-400 hover:text-cyan-400 transition-colors"
            >
              ← Back to Blog
            </Link>
          </div>

          {/* Article Header */}
          <header className="mb-8">
            {article.imageUrl && (
              <div className="mb-8">
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="w-full max-h-96 object-contain rounded-2xl"
                />
              </div>
            )}

            <div className="flex items-center gap-4 mb-6 text-sm text-gray-400">
              <time dateTime={article.publishDate}>
                {new Date(article.publishDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
              <span>•</span>
              <span>{article.readTimeMinutes} min read</span>
              {article.author && (
                <>
                  <span>•</span>
                  <span>By {article.author}</span>
                </>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              {article.title}
            </h1>

            <div className="flex flex-wrap gap-2 mb-8">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-gray-800/50 border border-gray-600 rounded-full text-sm text-gray-400 hover:text-cyan-400 hover:border-cyan-400 transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </header>

          {/* Article Content */}
          <article className="bg-gray-900/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8 md:p-12">
            <div
              className="prose prose-lg max-w-none text-white"
              style={{
                lineHeight: '1.7',
                fontSize: '1.1rem'
              }}
            >
              {/* Enhanced markdown-like content rendering with bold formatting */}
              {article.content.split('\n').map((line, index) => {
                const trimmedLine = line.trim();

                // Handle image placeholders
                if (trimmedLine === '[BLOG_HERO_IMAGE]') {
                  return (
                    <img key={index} src="/blog1.png" alt="Fantasy Hockey Position Stacks Strategy" className="w-full rounded-xl my-6 shadow-lg" />
                  );
                }
                if (trimmedLine === '[CENTER_STACK_IMAGE]') {
                  return (
                    <img key={index} src="/CStack.png" alt="Center Position Stack - Matthews, Scheifele, Trochek" className="w-full rounded-xl my-6 shadow-lg" />
                  );
                }
                if (trimmedLine === '[LEFT_WING_STACK_IMAGE]') {
                  return (
                    <img key={index} src="/LWStack.png" alt="Left Wing Position Stack - Kaprizov, Panarin, Gauthier" className="w-full rounded-xl my-6 shadow-lg" />
                  );
                }
                if (trimmedLine === '[RIGHT_WING_STACK_IMAGE]') {
                  return (
                    <img key={index} src="/RWStack.png" alt="Right Wing Position Stack - Kucherov, Necas, Wilson" className="w-full rounded-xl my-6 shadow-lg" />
                  );
                }
                if (trimmedLine === '[DEFENSE_STACK_IMAGE]') {
                  return (
                    <img key={index} src="/DStack.png" alt="Defense Position Stack - Makar, Dahlin, Sergachev, Chychrun, Fowler" className="w-full rounded-xl my-6 shadow-lg" />
                  );
                }
                if (trimmedLine === '[GOALIE_STACK_IMAGE]') {
                  return (
                    <img key={index} src="/GStack.png" alt="Goalie Position Stack - Shesterkin, Binnington, Vejmelka" className="w-full rounded-xl my-6 shadow-lg" />
                  );
                }

                // Headers
                if (trimmedLine.startsWith('# ')) {
                  return (
                    <h1 key={index} className="text-3xl font-bold text-white mt-8 mb-4 first:mt-0">
                      {trimmedLine.substring(2)}
                    </h1>
                  );
                }

                if (trimmedLine.startsWith('## ')) {
                  return (
                    <h2 key={index} className="text-2xl font-bold text-white mt-6 mb-3">
                      {trimmedLine.substring(3)}
                    </h2>
                  );
                }

                // Stack section headers with emoji
                if (trimmedLine.startsWith('### 🏆') || trimmedLine.startsWith('### ⚔️') || trimmedLine.startsWith('### ⚡') || trimmedLine.startsWith('### 🛡️') || trimmedLine.startsWith('### 🥅')) {
                  return (
                    <h3 key={index} className="text-xl font-bold text-cyan-400 mt-8 mb-4 border-b border-gray-600 pb-2">
                      {trimmedLine.substring(4)}
                    </h3>
                  );
                }

                // Bold field labels (Players:, Bonus Starts:, etc.)
                if (trimmedLine.startsWith('**Players**:') || trimmedLine.startsWith('**Bonus Starts**:') ||
                    trimmedLine.startsWith('**Why It Works**:') || trimmedLine.startsWith('**Best For**:') ||
                    trimmedLine.startsWith('**Compare to**:') || trimmedLine.startsWith('**The Gap**:')) {
                  const [boldPart, ...rest] = trimmedLine.split(': ');
                  let restText = rest.join(': ');

                  // Handle bonus starts numbers with gold highlighting in field values
                  restText = restText.replace(/\*\*(\+\d+)\*\*/g, '<span class="font-bold" style="color: #ffd36a;">$1</span>')
                    .replace(/\*\*(\d+)\s+(bonus starts|additional starts|more opportunities)\*\*/g, '<span class="font-bold" style="color: #ffd36a;">$1 $2</span>');

                  return (
                    <p key={index} className="mb-2 text-gray-100">
                      <strong className="text-cyan-400">{boldPart.replace(/\*\*/g, '')}:</strong> <span dangerouslySetInnerHTML={{ __html: restText }} />
                    </p>
                  );
                }

                // List items with bold labels
                if (trimmedLine.startsWith('- **') && trimmedLine.includes('**:')) {
                  const [, boldText, rest] = trimmedLine.match(/- \*\*(.*?)\*\*:(.*)/) || [];
                  return (
                    <li key={index} className="mb-2 text-gray-100 ml-4">
                      <strong className="text-cyan-400">{boldText}</strong>: <span className="text-gray-100">{rest}</span>
                    </li>
                  );
                }

                // Numbered lists
                if (trimmedLine.match(/^\d+\.\s+\*\*(.*?)\*\*/)) {
                  const processedText = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-400">$1</strong>');
                  return (
                    <p key={index} className="mb-2 text-gray-100" dangerouslySetInnerHTML={{ __html: processedText }} />
                  );
                }

                // Italic text
                if (trimmedLine.startsWith('*') && trimmedLine.endsWith('*') && !trimmedLine.includes('**')) {
                  return (
                    <p key={index} className="text-gray-300 italic mt-6 mb-4">
                      {trimmedLine.slice(1, -1)}
                    </p>
                  );
                }

                // Empty lines
                if (trimmedLine === '' || trimmedLine === '---') {
                  return <div key={index} className="h-4" />;
                }

                // Markdown links in bold format **[text](url)**
                if (trimmedLine.startsWith('**[') && trimmedLine.includes('](') && trimmedLine.endsWith(')**')) {
                  const linkMatch = trimmedLine.match(/\*\*\[(.*?)\]\((.*?)\)\*\*/);
                  if (linkMatch) {
                    const [, linkText, linkUrl] = linkMatch;
                    return (
                      <div key={index} className="mb-4 text-center">
                        <a
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-8 py-3 bg-cyan-400 text-gray-900 rounded-lg font-bold hover:bg-cyan-300 transition-all duration-200 text-lg"
                        >
                          {linkText}
                        </a>
                      </div>
                    );
                  }
                }

                // Handle bold section headings that start and end with **
                if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && trimmedLine.length > 4) {
                  const headingText = trimmedLine.slice(2, -2);
                  // Check if this looks like a section heading (no other content)
                  if (!headingText.includes('Pick') && !headingText.includes(':') && headingText.split(' ').length <= 8) {
                    return (
                      <h2 key={index} className="text-3xl font-bold text-cyan-400 mt-8 mb-6 first:mt-0">
                        {headingText}
                      </h2>
                    );
                  }
                }

                // Regular paragraphs with bold text processing
                const processedText = trimmedLine
                  // Handle bonus starts numbers with gold highlighting
                  .replace(/\*\*(\+\d+)\*\*/g, '<span class="font-bold" style="color: #ffd36a;">$1</span>')
                  // Handle "The Gap" numbers with gold highlighting
                  .replace(/\*\*(\d+)\s+(bonus starts|additional starts|more opportunities)\*\*/g, '<span class="font-bold" style="color: #ffd36a;">$1 $2</span>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em class="text-gray-300">$1</em>');

                return (
                  <p key={index} className="mb-4 text-gray-100 leading-relaxed" dangerouslySetInnerHTML={{ __html: processedText }} />
                );
              })}
            </div>
          </article>

          {/* Support Section */}
          <div className="mt-12 text-center">
            <div className="bg-gradient-to-r from-gray-900/40 via-gray-800/50 to-gray-900/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8 mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent w-24"></div>
                <span className="mx-4 text-cyan-400 text-lg">⚡</span>
                <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent w-24"></div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Enjoyed this strategy guide?</h3>
              <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                If these analytics helped you build a better roster, consider supporting the development of more advanced tools and content.
              </p>
              <CoffeeLink variant="blog" />
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 text-center">
            <Link
              to="/blog"
              className="inline-block px-8 py-3 bg-cyan-500/20 border border-cyan-400 text-cyan-400 rounded-lg hover:bg-cyan-400 hover:text-gray-900 transition-all duration-200 font-medium"
            >
              ← Back to All Articles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}