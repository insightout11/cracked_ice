---
slug: 2026-27-draft-roster-context-strategies
title: "I Tested Four Draft Strategies. Here's What Changes When the Draft Knows Your Roster, Not Just the Market."
excerpt: "I removed my personal opinions, gave four Cracked Ice strategies the same Yahoo draft board, and watched them make different decisions across 16 rounds."
status: published
author: Cracked Ice Analytics
tags: [draft, strategy, roster-context, yahoo-adp, 2026-27]
imageUrl: /blog-assets/draft-context-strategy-bars-hero.png
---

Let's get one thing out of the way: **I didn't choose, rank, or veto any of these players.**

The draft engine didn't know that I usually avoid centers early. It didn't know that I fade goalies, have a soft spot for Matt Boldy, worry about Miro Heiskanen sharing the spotlight with Thomas Harley, or would happily talk myself into Alex Ovechkin because... well, it's Ovie.

I locked the league settings, Yahoo ADP snapshot, strategy weights, and a 20-pick reach limit before the draft. Then I let Cracked Ice make every selection. My opinions came afterward.

And yes, the machine still waited on goalies.

Yahoo ADP is useful. It's great at telling me when a player's on sale. It has no idea if I actually need one.

ADP tells you when a player is usually drafted. It doesn't know that you already have two centers, that your league starts four defensemen, or that your playoffs begin on a different date than somebody else's. It definitely doesn't know whether one more winger gives your completed roster seven extra usable starts.

None of this is a case against Yahoo ADP. Everyone already knows ADP is an average of thousands of other people's drafts; it was never built to know your particular league. The interesting question isn't whether a context-aware draft can beat a spreadsheet of averages. It's what actually changes once the model can see your team while it's building it, and whether the strategy you pick, Balanced, Playoff Edge, Make the Playoffs, or Stars and Streamers, makes different, defensible calls with that context.

So I set up a controlled draft to see what would actually change when Cracked Ice was allowed to make those close calls without me putting my thumb on the scale.

The test was a 10-team Yahoo Standard points league from pick five, with no keepers and 16 rounds. The other nine teams drafted by Yahoo ADP. Cracked Ice could reach, but never more than 20 picks beyond the current selection. That last rule matters. Schedule value is useful; taking Mark Stone 50 picks early is still a bad draft.

One honest caveat: the other nine teams were drafting straight Yahoo ADP, not behaving like humans. That matters most at defense. Real managers know good defensemen disappear quickly and often take them ahead of ADP. So don't read Seider lasting to Round 5 or Heiskanen reaching Round 7 as a promise about your draft. Read those picks as how the model valued them against everything available at that moment. Against humans, it may have to make the same call earlier.

I ran five separate drafts from the same setup:

- Yahoo ADP only
- Balanced
- Playoff Edge
- Make the Playoffs
- Stars and Streamers

Each strategy built its own roster from Round 1 onward. This wasn't one finished team with four labels pasted onto it.

![The Yahoo Standard Draft Room showing the Balanced blend of projected value, regular-season schedule, playoff schedule, and position value.](/blog-assets/draft-context-strategy-bars.png)

## The model immediately ignored one of my personal draft rules

I usually avoid centers early. There are always quality centers later, and I'd rather fill thinner positions before I turn around and realize my roster has six centers and one right winger.

Cracked Ice took Macklin Celebrini fifth overall anyway.

I like it. My playoff window loves San Jose, Celebrini is already ridiculous, and how can you not want to bet on Macklin getting even better? It is also a useful reminder that these weren't secretly my rankings. If I had steered the draft by hand, an early center would have needed to fight through my bias first.

The strategies didn't produce four completely different teams. Good.

If moving a slider turns Connor McDavid into a seventh-round pick, the slider is broken. Strategy should change the close decisions, not give the model permission to ignore talent and market price.

The Yahoo ADP column below is the market-only control, not the headline. The real comparison is what the four context-aware strategies did with the same board.

| Draft approach | Regular-season points | Regular-season starts | Playoff points | Playoff starts | Total points |
|---|---:|---:|---:|---:|---:|
| Yahoo ADP only (control) | 8,590.5 | 1,021 | 1,113.6 | 132 | 9,704.1 |
| Balanced | 9,704.4 | 1,043 | 1,228.4 | 132 | 10,932.9 |
| Playoff Edge | 9,456.9 | 1,040 | 1,258.2 | 139 | 10,715.0 |
| Make the Playoffs | 9,589.4 | 1,047 | 1,228.4 | 135 | 10,817.8 |
| Stars and Streamers | 9,678.4 | 1,045 | 1,219.9 | 132 | 10,898.4 |

These are all Cracked Ice model outputs under the same Yahoo Standard scoring. They show how the model values each completed roster relative to the others. They are not promises about what any roster will actually score.

Across the four context-aware drafts, the average roster finished 25.3 usable starts and 1,136.9 modeled points ahead of the ADP control. That gap is not a pure schedule dividend—the model also selected players it projected more highly under Yahoo Standard scoring—and it is not a promise of 1,137 real points.

What I care about is the shape of the result. Balanced kept the strongest overall projection. Make the Playoffs found four more regular-season starts than Balanced. Playoff Edge found seven more playoff starts and 29.8 additional playoff points, while giving up 247.5 regular-season points. After the playoff gain, it finished 217.9 total modeled points behind Balanced.

That's the bill for additional playoff volume. Whether I want to pay it is on me.

## All 16 rounds

Here is every pick. Identical names are the boring part. The useful rows are where one strategy found a reason to leave the consensus.

| Rd | Pick | Yahoo ADP | Balanced | Playoff Edge | Make Playoffs | Stars/Streamers |
|---:|---:|---|---|---|---|---|
| 1 | 5 | Cale Makar | Macklin Celebrini | Macklin Celebrini | Macklin Celebrini | Macklin Celebrini |
| 2 | 16 | Jack Hughes | Matt Boldy | Matt Boldy | Matt Boldy | Matt Boldy |
| 3 | 25 | Jake Oettinger | Brandon Hagel | Brandon Hagel | Brandon Hagel | Brandon Hagel |
| 4 | 36 | Rasmus Dahlin | Tim Stützle | Tim Stützle | Tim Stützle | Tim Stützle |
| 5 | 45 | Clayton Keller | Moritz Seider | Moritz Seider | Moritz Seider | Darren Raddysh |
| 6 | 56 | Jesper Wallstedt | Jake Sanderson | Connor Bedard | Jake Sanderson | Jake Sanderson |
| 7 | 65 | Lucas Raymond | Miro Heiskanen | Miro Heiskanen | Miro Heiskanen | Miro Heiskanen |
| 8 | 76 | Sebastian Aho | Mika Zibanejad | Alex Ovechkin | Mika Zibanejad | Mika Zibanejad |
| 9 | 85 | Mika Zibanejad | Charlie McAvoy | Charlie McAvoy | Charlie McAvoy | Charlie McAvoy |
| 10 | 96 | Charlie McAvoy | Mark Stone | Thomas Harley | Mark Stone | Mark Stone |
| 11 | 105 | MacKenzie Weegar | Ukko-Pekka Luukkonen | Ukko-Pekka Luukkonen | Ukko-Pekka Luukkonen | Ukko-Pekka Luukkonen |
| 12 | 116 | Morgan Geekie | Filip Gustavsson | Filip Gustavsson | Filip Gustavsson | Filip Gustavsson |
| 13 | 125 | Jake Neighbours | Seth Jarvis | Seth Jarvis | Seth Jarvis | Seth Jarvis |
| 14 | 136 | Seth Jarvis | Nico Hischier | Evgeni Malkin | Nico Hischier | Nico Hischier |
| 15 | 145 | Devon Toews | Thomas Chabot | Nico Hischier | Jacob Trouba | Evgeni Malkin |
| 16 | 156 | Jordan Binnington | Evgeni Malkin | Thomas Chabot | Mattias Ekholm | Jacob Trouba |

Balanced drafted ahead of ADP on 13 of its 16 picks. That is partly how I designed the test: once a player was inside the 20-pick window, the model received no extra credit for waiting. It chose the best fit available now, not the player most likely to survive until my next turn.

That means this experiment can show why Cracked Ice preferred a player, but it doesn't perfectly model the poker involved in a human draft room. Sometimes the right player right now is still the wrong pick, if I'm confident he'll last another round.

## A player can have games without adding starts

The more interesting test came once two players could have plenty of games available and still add completely different value.

At pick 136, Nico Hischier showed 77 candidate starts, but only 57 increased the team's optimized starts because the center slots were already crowded. Evgeni Malkin showed 61 candidate starts, and all 61 helped. His C/LW/RW eligibility let the optimizer move him into whichever legal position was open on each date.

That is the part I wanted Cracked Ice to understand. Counting a player's NHL games is easy. Counting the games my roster can actually use is the job.

It also explains why the answer can change after the draft. Balanced selected Hischier in Round 14 and Malkin in Round 16 because each was the best option at that moment. Once the roster was complete, the optimizer could reassess all 16 players together.

## Where I agreed with the machine, and where I wanted to throw something at it

**Matt Boldy at 16:** Love it. I've had Boldy for the last couple of seasons and would happily take him back. He keeps getting better, and LW/RW eligibility makes him much easier to fit into a real lineup. No argument from me.

**Seider and Sanderson in Rounds 5 and 6:** This is where I like taking defensemen. The elite forwards are starting to thin out, but I can still get two defensemen I trust without paying the first-round Makar price.

**Bedard over Sanderson for Playoff Edge:** I'd take this one myself. I love Sanderson, he's one of my keepers, but Bedard has incredible upside and the better playoff schedule.

**Heiskanen in Round 7:** This one makes me nervous. The talent is obvious, but Harley is real competition for the premium Dallas usage. I wouldn't reject the pick, but I want another look at role and power-play deployment before draft day.

**Raddysh over Seider for Stars and Streamers:** I wouldn't do it. Raddysh's production is interesting, but he's on a new team now, without Kucherov setting up his looks, and that's exactly the kind of context a small sample can't account for on its own. I still prefer Seider's much stronger floor. A model can show me the bet. It doesn't get to make me comfortable with the risk.

**Stone in Round 10:** The model clearly likes him. He's the pick in three strategies, taken about ten spots ahead of his ADP. Probably a good pick. Also boring. The projection is there and the market price is reasonable, but make sure the league gives you enough IR room. Stone without roster flexibility is a different bet.

**Goalies in Rounds 11 and 12:** Fine. I guess we have to draft them eventually. Luukkonen and Gustavsson are decent bets at that price, and both bring enough uncertainty that I don't want them much earlier. Yahoo ADP gave the control roster Jake Oettinger in Round 3 and Jesper Wallstedt in Round 6. Balanced waited. That is much closer to how I want to build. I didn't fight the model on this one. It waited exactly as long as I would have.

**Jarvis in Round 13:** Steal. I don't need a longer explanation.

**Hischier in Round 14:** Great value this late. Only 57 of his 77 candidate starts improved this crowded roster, but at this point the center-depth argument becomes a reason to take him rather than avoid him. I still expect a bounce-back.

**Malkin in Round 16:** All 61 of his candidate starts helped, which is the argument for his positional flexibility here. He has also started the last couple of seasons on fire. I can see drafting him, enjoying the early production, and trying to sell before old age remembers where he lives.

**The final-round alternatives:** I don't love them. In a real draft, I would rather swing for upside or leave myself a streamer spot for Week 1 than finish with a low-ceiling pick just because the spreadsheet wanted every box filled.

## The best strategy fork: Zibanejad or Ovechkin?

Round 8 is the cleanest example of what the strategy controls are supposed to do.

Balanced selected Mika Zibanejad. He added 84 team starts and about 697.2 projected points. Playoff Edge selected Alex Ovechkin. He also added 84 team starts, but brought three additional playoff starts at the cost of about 29.4 full-season points.

Neither answer is ridiculous, but I kind of love the Ovechkin pick. I favor playoff upside, and it's Ovie. Zibanejad's scoring last season also looks difficult to sustain. The model is honest about the price: Ovechkin gives back some full-season projection, but this is exactly the kind of calculated playoff swing I would take.

![The Playoff Edge decision context behind the Ovechkin-over-Zibanejad choice.](/blog-assets/draft-context-ovechkin-zibanejad.png)

## The Balanced roster

Here is what Balanced built after all 16 rounds.

| Slot | Player | Yahoo ADP |
|---|---|---:|
| C | Macklin Celebrini | 8.0 |
| C | Tim Stützle | 47.1 |
| LW | Matt Boldy | 20.7 |
| LW | Brandon Hagel | 37.0 |
| RW | Mika Zibanejad | 91.7 |
| RW | Mark Stone | 106.0 |
| D | Moritz Seider | 56.9 |
| D | Jake Sanderson | 63.5 |
| D | Miro Heiskanen | 73.2 |
| D | Charlie McAvoy | 99.6 |
| G | Ukko-Pekka Luukkonen | 109.2 |
| G | Filip Gustavsson | 128.2 |
| BN | Seth Jarvis | 126.8 |
| BN | Nico Hischier | 131.2 |
| BN | Thomas Chabot | 144.3 |
| BN | Evgeni Malkin | 141.2 |

No Cracked Ice pick exceeded the 20-pick reach limit. There were reaches, but no "I can get him five rounds later" picks pretending to be clever.

![The complete Balanced roster share card with all 16 drafted players.](/blog-assets/draft-context-full-roster-share.png)

![The Balanced roster's regular-season projections.](/blog-assets/draft-context-regular-projections.png)

*Regular season: the Balanced roster projected across the full fantasy regular season.*

![The same roster projected across the league's saved fantasy-playoff window.](/blog-assets/draft-context-playoff-projections.png)

*Fantasy playoffs: the same Balanced roster projected only across the league's saved playoff window.*

## The draft is only half of it

The completed-roster optimizer identified Brock Nelson for Nico Hischier as the strongest available schedule move in this test:

- seven additional regular-season team starts
- about 6.4 additional projected season points
- one additional playoff start and roughly 1.7 playoff points

I would still keep Hischier as the safer bet. Those modeled margins are small enough for role, health, or normal projection error to erase them quickly.

If my league rewards power-play points heavily and I care more about this playoff window, I would consider Nelson. That isn't an automatic transaction; it's a useful question. The tool has shown me exactly what I would gain and what kind of bet I would be making.

That is what I want from the optimizer. Not "who is the best player left?" but "where is this specific roster leaking games, and is the player upgrade worth the talent risk?"

## What the four strategies are actually for

**Balanced** is my default, and it's staying my default. Production leads, schedule and position break the tie, no drama, just the highest-value roster I could build without gambling on anything.

**Playoff Edge** is the "I've already decided I'm making the playoffs" strategy. It's the Ovechkin-over-Zibanejad pick, as a whole philosophy. You're paying full-season points for playoff volume, and I think that's a fair trade, if your roster's actually good enough to cash it in.

**Make the Playoffs** is the nervous version of me. The one who remembers missing a bye week by two points. It leans toward volume over ceiling: the one real swing it made here was Jacob Trouba over Thomas Chabot in Round 15, five extra season starts and a playoff start for 0.82 less projected FPPG. Cheap insurance.

**Stars and Streamers** assumes I'm willing to do the unglamorous part: chase the studs, then actually work the wire the other 361 days of the year. It barely moved here, and that's partly the experiment's guardrail working. A 20-spot leash means "stars and streamers" can't quietly turn into "reach for whoever I like."

The presets are only starting points. The Draft Room shows the relative weight assigned to projected value, regular-season schedule, playoff schedule, and position value. I can open **Customize weights** and move those priorities myself. If I want to become irrationally obsessed with my playoff calendar, the software will not stop me.

I also killed Schedule Maximizer as a preset. It promised something a single draft pick can't actually deliver: a fully optimized final roster, decided one pick at a time before the remaining picks that would complete the team were known. That's not a draft problem. That's what the completed-roster optimizer is for, and leaving the preset in would've just been selling a promise the tool couldn't keep.

## My takeaway

I don't need an optimizer to surprise me. I need it to explain why two players priced the same aren't worth the same to my team.

ADP is the asking price. It isn't the shopping list.

Yahoo ADP sets the market. Cracked Ice adds league scoring, roster needs, position eligibility, regular-season access, and the playoff calendar. Sometimes the answer stays the same. Sometimes three playoff starts are enough to change it. Sometimes the best schedule pick is simply the player who can move from center to wing on a crowded Tuesday.

Which of those matters more to you, extra playoff volume, a higher regular-season floor, or swinging for elite production and working the wire, is exactly what picking a strategy is for. That choice, not the ADP number, is the actual decision.

Set your scoring, enter your playoff dates, and choose the strategy that matches your team. Then run the completed roster through My Team before you decide the draft is finished.

That is where the extra games are hiding.

**[Build your draft board and test your league](https://www.crackedicehockey.com/?tool=draft)**
