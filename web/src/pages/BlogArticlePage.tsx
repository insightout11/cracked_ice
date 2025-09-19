import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

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

    if (id === 'position-group-stacks-2025') {
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
**Players**: A. Matthews (TOR), M. Scheifele (WPG), V. Trochek (NYR)
**Bonus Starts**: **+55**
**Why It Works**: Perfect off-night coverage, elite anchor + mid-value + late steal
**Best For**: Managers leaning into center depth dominance

Draft Matthews in the 1st round for elite production, grab Scheifele as your mid-round value play, then steal Trochek in the late rounds as your schedule-breaking third center.

**Compare to**: A. Matthews, M. Celebrini, M. Beniers (+37 starts)
**The Gap**: **18 bonus starts** just by choosing the right third center

<img src="/CStack.png" alt="Center Position Stack - Matthews, Scheifele, Trochek" className="w-full rounded-xl my-6" />

---

### ⚔️ Port Side Domination (LW)
**Players**: K. Kaprizov (MIN), A. Panarin (NYR), C. Gauthier (ANA)
**Bonus Starts**: **+57**
**Why It Works**: Elite talent + proven veteran + rookie in schedule paradise
**Best For**: Contrarian managers who draft with calculators, not feelings

The genius move is grabbing Gauthier in the depths of your draft when everyone else chases last year's breakouts. Anaheim's schedule turns your throwaway pick into a weekly starter.

**Compare to**: K. Kaprizov, K. Connor, W. Eklund (+37 starts)
**The Gap**: **20 more opportunities** to rack up points

<img src="/LWStack.png" alt="Left Wing Position Stack - Kaprizov, Panarin, Gauthier" className="w-full rounded-xl my-6" />

---

### ⚡ Sniper's Paradise (RW)
**Players**: N. Kucherov (TBL), M. Necas (COL), T. Wilson (WSH)
**Bonus Starts**: **+55**
**Why It Works**: Elite ceiling + breakout narrative + reformed goon in perfect schedule
**Best For**: Managers who draft with ruthless efficiency over popular names

Welcome to the land of misfit toys where a reformed enforcer becomes your secret weapon. Kucherov brings Art Ross Trophy potential, Necas provides the breakout everyone loves in Colorado's high-octane system, but Wilson separates you from the sheep: evolved from knuckle-dragger to legitimate multi-category contributor.

**Compare to**: N. Kucherov, M. Michkov, K. Marchenko (+38 starts)
**The Gap**: **17 additional starts** while Wilson pads stats and Marchenko watches from the bench

<img src="/RWStack.png" alt="Right Wing Position Stack - Kucherov, Necas, Wilson" className="w-full rounded-xl my-6" />

---

### 🛡️ Blue Line Syndicate (D)
**Players**: C. Makar (COL), R. Dahlin (BUF), M. Sergachev (UTA), J. Chychrun (WSH), C. Fowler (STL)
**Bonus Starts**: **+69** *(nice)*
**Why It Works**: Offensive anchor + depth spread across optimal schedules
**Best For**: Deep league specialists who understand defensive arbitrage

Makar anchors with elite talent, while the depth crew (Sergachev in Utah's schedule paradise, Chychrun's Washington revival, reliable Fowler in St. Louis) grinds out stats without lineup conflicts.

**Compare to**: C. Makar, M. Heiskanen, S. Jones, E. Karlsson, N. Dobson (+53 starts)
**The Gap**: **16 additional starts** by choosing schedule over pedigree

<img src="/DStack.png" alt="Defense Position Stack - Makar, Dahlin, Sergachev, Chychrun, Fowler" className="w-full rounded-xl my-6" />

---

### 🥅 Crease Cartel (G)
**Players**: I. Shesterkin (NYR), J. Binnington (STL), K. Vejmelka (UTA)
**Bonus Starts**: **+63**
**Why It Works**: Elite anchor + veteran stability + volume play in schedule goldmine
**Best For**: Goalie streaming addicts who optimize daily lineups

Shesterkin provides the elite foundation, Binnington offers proven consistency, and Vejmelka (trapped in Utah's rebuild) sees massive volume on the most fantasy-friendly schedule in the league.

**Compare to**: I. Shesterkin, S. Bobrovsky, J. Saros (+43 starts)
**The Gap**: **20 additional starts** by embracing chaos over comfort

<img src="/GStack.png" alt="Goalie Position Stack - Shesterkin, Binnington, Vejmelka" className="w-full rounded-xl my-6" />

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

**[Calculate Now](https://www.crackedicehockey.com)**

## Your Next Move

Ready to stop playing fantasy hockey like an amateur?

Our complement and team synergy engine handles the mathematical heavy lifting so you can focus on watching your perfectly balanced roster demolish the competition while they're still trying to figure out why their "obvious" picks keep underperforming.

**Find your position stack. Build your machine. Win your league.**

The calculator is waiting. The only question is whether you're ready to handle the truth.

CALCULATE_NOW_LINK_PLACEHOLDER
        `.trim(),
        publishDate: '2025-01-15',
        readTimeMinutes: 8,
        tags: ['strategy', 'draft', 'position-stacks', 'advanced'],
        author: 'Cracked Ice Analytics',
        imageUrl: '/blog-images/position-stacks-hero.jpg'
      };
    } else if (id === '1') {
      mockArticle = {
        id: id,
        title: 'Welcome to the Cracked Ice Blog',
        content: `
# Welcome to the Cracked Ice Blog

Welcome to our new blog section! We're excited to share fantasy hockey insights, strategies, and analysis to help you dominate your league.

## What You'll Find Here

Our blog will cover:

- **Draft Strategies**: Tips for building a winning team from day one
- **Waiver Wire Gems**: Hidden players to target throughout the season
- **Trade Analysis**: When to buy, sell, or hold your players
- **Playoff Preparation**: Maximizing your roster for the fantasy playoffs
- **Advanced Analytics**: Using data to gain an edge over your competition

## Stay Connected

Make sure to check back regularly for new content. We'll be posting articles throughout the hockey season to keep you ahead of the competition.

*This is placeholder content that will be replaced with actual articles.*
        `.trim(),
        publishDate: '2024-01-15',
        readTimeMinutes: 3,
        tags: ['announcement', 'welcome'],
        author: 'Cracked Ice Team'
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
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-[var(--ci-white)]">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
            {error || 'Article not found'}
          </div>
          <Link
            to="/blog"
            className="inline-block mt-4 px-6 py-2 bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] text-[var(--laser-cyan)] rounded-lg hover:bg-[var(--laser-cyan)] hover:text-[var(--ice-card-strong)] transition-all duration-200 font-medium"
          >
            ← Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ice-rink-bg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back to Blog Link */}
          <div className="mb-8">
            <Link
              to="/blog"
              className="inline-flex items-center text-[var(--ci-muted)] hover:text-[var(--laser-cyan)] transition-colors"
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
                  className="w-full h-64 md:h-80 object-cover rounded-2xl"
                />
              </div>
            )}

            <div className="flex items-center gap-4 mb-6 text-sm text-[var(--ci-muted)]">
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

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[var(--ci-white)] mb-6 leading-tight">
              {article.title}
            </h1>

            <div className="flex flex-wrap gap-2 mb-8">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-[var(--glass-fill)] border border-[var(--glass-border)] rounded-full text-sm text-[var(--ci-muted)] hover:text-[var(--laser-cyan)] hover:border-[var(--laser-cyan)] transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </header>

          {/* Article Content */}
          <article className="bg-[var(--ice-card-strong)] rounded-2xl border border-[var(--glass-border)] p-8 md:p-12">
            <div
              className="prose prose-lg max-w-none text-[var(--ci-white)]"
              style={{
                lineHeight: '1.7',
                fontSize: '1.1rem'
              }}
            >
              {/* Simple markdown-like content rendering */}
              {article.content.split('\n').map((line, index) => {
                const trimmedLine = line.trim();

                if (trimmedLine.startsWith('# ')) {
                  return (
                    <h1 key={index} className="text-3xl font-bold text-[var(--ci-white)] mt-8 mb-4 first:mt-0">
                      {trimmedLine.substring(2)}
                    </h1>
                  );
                }

                if (trimmedLine.startsWith('## ')) {
                  return (
                    <h2 key={index} className="text-2xl font-bold text-[var(--ci-white)] mt-6 mb-3">
                      {trimmedLine.substring(3)}
                    </h2>
                  );
                }

                if (trimmedLine.startsWith('- **') && trimmedLine.includes('**:')) {
                  const [, boldText, rest] = trimmedLine.match(/- \*\*(.*?)\*\*:(.*)/) || [];
                  return (
                    <li key={index} className="mb-2">
                      <strong className="text-[var(--laser-cyan)]">{boldText}</strong>: {rest}
                    </li>
                  );
                }

                if (trimmedLine === 'CALCULATE_NOW_LINK_PLACEHOLDER') {
                  return (
                    <p key={index} className="mb-4 text-center">
                      <a
                        href="https://www.crackedicehockey.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-8 py-3 bg-[var(--laser-cyan)] text-[var(--ice-card-strong)] rounded-lg font-bold hover:bg-[var(--laser-cyan)]/80 transition-all duration-200 text-lg"
                      >
                        Calculate Now
                      </a>
                    </p>
                  );
                }

                if (trimmedLine.startsWith('**[') && trimmedLine.includes('](') && trimmedLine.endsWith(')**')) {
                  const linkMatch = trimmedLine.match(/\*\*\[(.*?)\]\((.*?)\)\*\*/);
                  if (linkMatch) {
                    const [, linkText, linkUrl] = linkMatch;
                    return (
                      <p key={index} className="mb-4 text-center">
                        <a
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-8 py-3 bg-[var(--laser-cyan)] text-[var(--ice-card-strong)] rounded-lg font-bold hover:bg-[var(--laser-cyan)]/80 transition-all duration-200 text-lg"
                        >
                          {linkText}
                        </a>
                      </p>
                    );
                  }
                }

                if (trimmedLine.startsWith('*') && trimmedLine.endsWith('*')) {
                  return (
                    <p key={index} className="text-[var(--ci-muted)] italic mt-6 mb-4">
                      {trimmedLine.slice(1, -1)}
                    </p>
                  );
                }

                if (trimmedLine === '') {
                  return <div key={index} className="h-4" />;
                }

                return (
                  <p key={index} className="mb-4 text-[var(--ci-white)]">
                    {trimmedLine}
                  </p>
                );
              })}
            </div>
          </article>

          {/* Navigation */}
          <div className="mt-12 text-center">
            <Link
              to="/blog"
              className="inline-block px-8 py-3 bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] text-[var(--laser-cyan)] rounded-lg hover:bg-[var(--laser-cyan)] hover:text-[var(--ice-card-strong)] transition-all duration-200 font-medium"
            >
              ← Back to All Articles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}