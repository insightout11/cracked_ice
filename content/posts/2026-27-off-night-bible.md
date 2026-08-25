---
slug: 2026-27-fantasy-hockey-off-night-bible
title: "The 2026-27 Fantasy Hockey Off-Night Bible"
excerpt: "Every NHL team plays 84 games. Your fantasy lineup won't use all of them. Here is where the schedule creates—and quietly kills—real value."
publishDate: 2026-08-12
status: published
author: Cracked Ice Analytics
tags: [off-night-bible, schedule, playoffs, draft, 2026-27]
imageUrl: /blog-assets/off-night-bible-84-game-illusion.png
---

# The 2026-27 Fantasy Hockey Off-Night Bible

## You landed Kucherov and Pastrnak. Congratulations. Now what?

You somehow leave the first two rounds with Nikita Kucherov and David Pastrnak. Congratulations. Your right-wing room is disgusting.

It is also about to become a scheduling problem.

Later in the draft, you are staring at Pavel Dorofeyev and Kirill Marchenko. Marchenko scores slightly more per game in the Cracked Ice default setup. Most rankings stop there and take Marchenko.

I ran both players behind Kucherov and Pastrnak in a controlled lineup with **two active RW slots and no utility slot**. This is what happens:

| Third RW | Reference FPPG | Usable starts behind Kucherov + Pastrnak |
| --- | --- | --- |
| Pavel Dorofeyev (NYR) | 3.52 | 57 |
| Kirill Marchenko (CBJ) | 3.73 | 42 |

Marchenko has the better reference scoring rate. Dorofeyev gets into this lineup **15 more times**. At those rates, that extra room is worth roughly **44 fantasy points** over the season.

No, this does not mean everybody should draft Dorofeyev over Marchenko. Please do not send me that screenshot in December. Your scoring, utility slots, and multi-position eligibility can recover some of these conflicts. The point is that once two premium players occupy a position, the third player is no longer an isolated ranking. He has to fit the roster you already built.

One important distinction before we go any further: the 17-date Tampa Bay example later in this guide is a one-slot team-schedule test. It is not the same calculation as this 15-start, three-player RW example.

![Pavel Dorofeyev creates 15 more usable starts than Kirill Marchenko behind Nikita Kucherov and David Pastrnak in the controlled two-RW example.](/blog-assets/off-night-bible-third-rw.png)

## The 84-game lie hiding in plain sight

Every NHL team plays 84 games this season. Fantasy rankings will happily treat those games as if they are all worth the same.

They are not. A Wednesday game that slides into an empty slot can score for you. A Saturday game trapped behind two better players is just something you watch from the bench while wondering why your “deep” roster is not actually helping.

Washington leads the league with 40 off-night games. Nashville has 22. That 18-game gap is useful, but it is still the obvious version of schedule analysis.

The better question is what happens when schedules start colliding with each other:

- The best two-team pairing creates **134 distinct playable dates** in one shared slot. The worst creates 107—a 27-start swing before changing either player's talent projection.
- A TBL anchor has ANA as its cleanest partner and TOR as its most congested. That decision alone changes the one-slot ceiling by 17 dates.
- SJS looks elite across the configured playoff window (9 games, 6 off-nights), but has only 2 games and 0 off-nights in the final NHL week. **Your playoff dates can reverse a recommendation.**

That is the part a generic “best schedules” list cannot answer. Your best schedule depends on the players already occupying your slots and the dates your league actually uses.

## Before somebody yells at me about the math

For this guide, an off-night is any date with **8 or fewer NHL games**. It is a useful shortcut, not a magic number. The better measurement is usable starts: the games that survive your league dates, active slots, position eligibility, and the congestion already sitting on your roster.

For the pairing tables below, two teams compete for **one shared active slot**:

- **Usable dates** are the union of both team schedules.
- **Conflicts** are dates when both teams play.
- **Off-night dates** are distinct dates in the pairing that fall on quieter NHL slates.

## Five anchor teams, five different answers

Pick an anchor team and the answer changes immediately. These are team-level comparisons, not claims that a particular player is sitting on your waiver wire.

| Anchor | Cleanest partner | Most congested partner | Usable-date swing |
| --- | --- | --- | --- |
| TBL | ANA · 124 dates · 44 conflicts | TOR · 107 dates · 61 conflicts | 17 |
| WSH | NYR · 130 dates · 38 conflicts | WPG · 118 dates · 50 conflicts | 12 |
| NYR | BOS · 133 dates · 35 conflicts | PHI · 116 dates · 52 conflicts | 17 |
| COL | NYR · 132 dates · 36 conflicts | DAL · 115 dates · 53 conflicts | 17 |
| SJS | NYR · 131 dates · 37 conflicts | NSH · 117 dates · 51 conflicts | 14 |

Tampa Bay is the cleanest example. Pair it with Anaheim and you get 124 playable dates with 44 conflicts. Pair it with Toronto and that drops to 107 dates with 61 conflicts.

Same 84-game season. Same talent tier, if you choose comparable players. **Seventeen possible starts disappear because you picked the wrong partner.**

## The best one-slot combinations

I ran all 496 two-team combinations. These ten create the most playable dates when both players are fighting for one active slot.

Do not use this table to draft a mediocre player over a star. Use it after you have two players in the same neighborhood and need an actual reason to break the tie.

| Teams | Usable dates | Shared nights | Off-night dates | Complement rate |
| --- | --- | --- | --- | --- |
| ANA + UTA | 134 | 34 | 66 | 79.8% |
| BOS + NYR | 133 | 35 | 63 | 79.2% |
| COL + NYR | 132 | 36 | 67 | 78.6% |
| COL + UTA | 131 | 37 | 65 | 78% |
| NYR + SJS | 131 | 37 | 65 | 78% |
| NYR + WSH | 130 | 38 | 65 | 77.4% |
| DET + PHI | 130 | 38 | 64 | 77.4% |
| PHI + WSH | 130 | 38 | 64 | 77.4% |
| DAL + NYR | 130 | 38 | 63 | 77.4% |
| COL + FLA | 130 | 38 | 62 | 77.4% |

## The combinations most likely to collide

| Teams | Shared nights | Usable dates |
| --- | --- | --- |
| TBL + TOR | 61 | 107 |
| NSH + TBL | 60 | 108 |
| LAK + NJD | 58 | 110 |
| BUF + FLA | 58 | 110 |
| CBJ + LAK | 58 | 110 |
| CGY + SEA | 58 | 110 |
| DAL + TBL | 58 | 110 |
| CBJ + STL | 58 | 110 |

You are never eliminating every conflict, and you should not pass on elite talent trying. This is where close picks, depth players, and late-round roster construction get decided.

## This is where playoff rankings go to die

Whenever somebody says a team has a “good playoff schedule,” ask them one question: **which playoff dates?**

A league ending April 4 is not playing the same fantasy season as one running through April 10. That difference can flip the recommendation completely.

| Scenario | Dates | Top schedules |
| --- | --- | --- |
| Early three-week playoffs | 2027-03-15 to 2027-04-04 | SJS (11 GP, 7 off); MIN (10 GP, 7 off); WSH (12 GP, 6 off); COL (11 GP, 6 off) |
| Configured site default | 2027-03-22 to 2027-04-10 | SJS (9 GP, 6 off); DET (10 GP, 5 off); WSH (11 GP, 4 off); BOS (10 GP, 4 off) |
| Final NHL week only | 2027-04-05 to 2027-04-10 | BOS (4 GP, 3 off); DAL (4 GP, 3 off); UTA (4 GP, 3 off); WPG (4 GP, 3 off) |

San Jose is the funniest example because all three statements below are true:

- **Early three-week window:** 11 games, 7 off-nights.
- **Configured window:** 9 games, 6 off-nights.
- **Final NHL week:** 2 games, 0 off-nights.

Call San Jose a playoff target without giving the dates and you may be giving excellent advice to one league and terrible advice to another. Enter your championship window before trusting anybody's playoff ranking—including mine.

![San Jose's fantasy value changes sharply when the playoff window moves from March 22–April 10 to the final NHL week.](/blog-assets/off-night-bible-playoff-flip.png)

## Full-season off-night leaders

This is the useful starting map. It is not a draft board. Washington's 40 off-nights cannot rescue a bad player, a lost power-play role, or an injury. What it can do is break a close decision after the hockey part of the evaluation is done.

| Rank | Team | Games | Off-nights | Off-night rate | B2Bs |
| --- | --- | --- | --- | --- | --- |
| 1 | WSH | 84 | 40 | 47.6% | 14 |
| 2 | NYR | 84 | 39 | 46.4% | 11 |
| 3 | COL | 84 | 38 | 45.2% | 10 |
| 4 | UTA | 84 | 37 | 44% | 10 |
| 5 | ANA | 84 | 36 | 42.9% | 11 |
| 6 | CHI | 84 | 36 | 42.9% | 12 |
| 7 | EDM | 84 | 36 | 42.9% | 11 |
| 8 | SJS | 84 | 36 | 42.9% | 13 |
| 9 | DET | 84 | 35 | 41.7% | 12 |
| 10 | DAL | 84 | 34 | 40.5% | 13 |

[Explore all 32 teams and choose your own dates](/season).

## Configured fantasy playoff table

The site default is March 22 through April 10. If those are not your league dates, this table is not your table. Change the window in My League and rerun it.

| Rank | Team | Playoff games | Off-nights | Busy nights |
| --- | --- | --- | --- | --- |
| 1 | SJS | 9 | 6 | 3 |
| 2 | DET | 10 | 5 | 5 |
| 3 | WSH | 11 | 4 | 7 |
| 4 | BOS | 10 | 4 | 6 |
| 5 | CAR | 10 | 4 | 6 |
| 6 | DAL | 10 | 4 | 6 |
| 7 | MIN | 10 | 4 | 6 |
| 8 | MTL | 10 | 4 | 6 |
| 9 | EDM | 9 | 4 | 5 |
| 10 | OTT | 9 | 4 | 5 |
| 11 | UTA | 9 | 4 | 5 |
| 12 | WPG | 9 | 4 | 5 |

## Pick the strategy that matches your league

### Balanced

Projected value does most of the work. Regular-season access, playoff weeks, and position value break the close calls. This is where I would start if you do not have a specific reason to lean harder in another direction.

### Playoff edge

Take a small regular-season hit for players who gain games during your exact playoff weeks. This makes sense when your keeper base already gives you a strong floor. It is a lot less clever when you are fighting for sixth place in February.

### Make the playoffs

Push usable regular-season games ahead of playoff optimization. Pick this when qualification is the real problem, your league is deep, or your roster cannot afford to stash value for March.

### Stars and streamers

Bet harder on elite production and assume you can churn the final roster spots during the season. This is the least schedule-sensitive preset. It fits active managers who trust themselves to stream around the stars later.

### Custom

The site also lets you set the four weights yourself: projected value, regular-season access, playoffs, and position value. Use Custom when one of the presets is close but your league format demands a stronger opinion.

None of these settings changes the underlying player projection. They change how aggressively schedule access and positional value are allowed to move players within that projection landscape.

## What I would actually do on draft day

1. Save your league scoring, positions, and exact playoff dates in My League.
2. Rank players primarily by production, role, and health.
3. Compare schedule fit inside a tier—not across a massive talent gap.
4. Recalculate usable starts as your roster fills.
5. Check availability in your own league before acting.

The first two rounds are still about talent. The schedule gets louder as the tiers tighten and your active slots fill. That is where ten extra playable dates can matter more than a tiny projection difference nobody is going to predict correctly anyway.

[Build your league-scored draft board](/), [explore the full season schedule](/season), or [compare the two players you are actually arguing about](/compare).
