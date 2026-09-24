import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRosterCard, buildWeekPreview, matchRosterText, parsePlayerBio, rosterCardText, rosterGroups, withInjuryStatus, type BioPlayer } from './rosterCard';
import { simulateRosters } from './rosterCardBaseline';
import { rosterTeamNames } from './rosterCardNames';
import { TRAITS } from './rosterCardTraits';

const bio = withInjuryStatus(parsePlayerBio(JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/player-bio.json'), 'utf8'))), {});
const TODAY = '2026-09-24';
const topicOf = (key: string) => TRAITS.find((trait) => trait.id === key)?.topic;

function player(name: string, extra: Partial<BioPlayer> = {}): BioPlayer {
  return {
    id: name, name, team: 'TOR', pos: ['C'], number: null, shoots: 'L', heightIn: 73, weightLb: 195, birthDate: '1998-06-01', country: 'CAN', city: 'Toronto', adp: null,
    draft: { year: 2016, round: 2, overall: 40 }, awards: {}, career: { gp: 400, goals: 100, points: 250, pim: 100, wins: 0, shutouts: 0 },
    last: { gp: 80, goals: 20, points: 50, pim: 20, wins: 0, savePct: null }, debut: 2018, teams: 2, legend: null, injury: null, ...extra,
  };
}

describe('matching a pasted roster', () => {
  it('finds players in a messy team-page paste', () => {
    const paste = [
      'Pos\tPlayer\tAction\tOpp',
      'C\tConnor McDavidEDM - C\t+\tvs CGY',
      'LW\tC. Makar Col - D',
      'Tim Stutzle (OTT - C,LW) Q',
      'BN  Sebastian Aho  CAR - C  Sebastian Aho again',
      'Util  Empty',
    ].join('\n');
    expect(matchRosterText(paste, bio).map((p) => p.name)).toEqual(['Connor McDavid', 'Cale Makar', 'Tim Stützle', 'Sebastian Aho']);
  });

  it('reads last-first lists without breaking plain comma lists', () => {
    const lastFirst = ['Player', 'McDavid, Connor EDM C', 'Eriksson Ek, Joel MIN C', 'Makar, Cale COL D', '82 GP 32 G'].join('\n');
    expect(matchRosterText(lastFirst, bio).map((p) => p.name)).toEqual(['Connor McDavid', 'Joel Eriksson Ek', 'Cale Makar']);
    const commaList = 'Connor McDavid, Connor Bedard, Cale Makar, Quinn Hughes';
    expect(matchRosterText(commaList, bio).map((p) => p.name)).toEqual(['Connor McDavid', 'Connor Bedard', 'Cale Makar', 'Quinn Hughes']);
  });

  it('takes the better-known player when two share a name, and ignores names inside words', () => {
    const [aho] = matchRosterText('Sebastian Aho', bio);
    expect(aho.team).toBe('CAR');
    expect(matchRosterText('Makarov and Connor McDavidson', bio).map((p) => p.name)).toEqual([]);
  });
});

describe('the roster card', () => {
  const veterans = matchRosterText('Sidney Crosby, Alex Ovechkin, Evgeni Malkin, Steven Stamkos, Brad Marchand, John Tavares, Patrick Kane, Erik Karlsson, Drew Doughty, Kris Letang, Ryan O\'Reilly, Sergei Bobrovsky, Jonathan Quick, Mark Stone', bio);

  it('calls out what is rare about a roster, one topic per line', () => {
    const card = buildRosterCard(veterans, TODAY, 0, bio);
    expect(['first-overall', 'age-old', 'cups', 'major-awards']).toContain(card.verdict.key);
    expect(card.facts).toHaveLength(3);
    const topics = [card.verdict.key, ...card.facts.map((fact) => fact.key)].map(topicOf);
    expect(new Set(topics).size).toBe(topics.length);
    expect(card.highlights[0].rarity).toBeGreaterThanOrEqual(0.85);
  });

  it('only makes extreme claims about rosters that are extreme', () => {
    // A roster of typical 28-year-olds must not be told it's old or young.
    const typical = Array.from({ length: 16 }, (_, index) => player(`Player ${index}`, { birthDate: `1998-0${(index % 9) + 1}-1${index % 9}`, team: ['TOR', 'MTL', 'BOS', 'NYR', 'CHI', 'DET', 'EDM', 'CGY'][index % 8], city: `City ${index}`, number: index + 10 }));
    const card = buildRosterCard(typical, TODAY, 0, bio);
    expect(card.facts.map((fact) => fact.key)).not.toContain('age-old');
    expect(card.facts.map((fact) => fact.key)).not.toContain('age-young');
  });

  it('roasts rosters that drafted injured players', () => {
    const hurt = withInjuryStatus(veterans, Object.fromEntries(veterans.slice(0, 3).map((p) => [`nhl:${p.id}`, 'IR'])));
    const card = buildRosterCard(hurt, TODAY, 0, bio);
    expect([card.verdict.key, ...card.facts.map((fact) => fact.key)]).toContain('hurt-now');
  });

  it('gives different rosters different cards', () => {
    const rosters = simulateRosters([...bio].reverse(), 40).filter((_, index) => index % 12 === 7);
    const verdicts = rosters.map((roster) => buildRosterCard(roster, TODAY, 0, bio).verdict.key);
    const counts = verdicts.reduce<Record<string, number>>((all, key) => ({ ...all, [key]: (all[key] ?? 0) + 1 }), {});
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(15);
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(verdicts.length * 0.2);
    expect(counts.balanced ?? 0).toBeLessThanOrEqual(verdicts.length * 0.15);
  });

  it('names a team after its best-known players, puns first', () => {
    const roster = matchRosterText('Nick Suzuki, Connor McDavid, Cale Makar, Some Nobody', bio);
    const names = rosterTeamNames(roster);
    expect(names[0]).toBe('McDavid Copperfield');
    expect(names).toContain('The Makar-ena');
  });
});

describe('the week preview', () => {
  it("counts your players' games each night and finds the packed and light nights", () => {
    const teams = ['TOR', 'MTL', 'BOS', 'NYR', 'CHI', 'DET', 'EDM', 'CGY', 'VAN', 'SEA', 'SJS', 'LAK', 'ANA', 'VGK', 'COL', 'DAL', 'MIN', 'WPG', 'STL', 'NSH', 'UTA', 'CBJ', 'PIT', 'PHI', 'NJD', 'NYI'];
    const games: Record<string, Array<{ date: string }>> = {};
    const play = (date: string, playing: string[]) => playing.forEach((team) => { (games[team] ??= []).push({ date }); });
    play('2026-10-06', teams.slice(0, 4)); // Tue: 2 games
    play('2026-10-10', teams); // Sat: 13 games
    const roster = [player('A', { team: 'TOR' }), player('B', { team: 'MTL' }), player('C', { team: 'NYI' })];
    const week = buildWeekPreview(roster, games, '2026-10-05');
    expect(week.days.map((day) => day.yourPlayers)).toEqual([0, 2, 0, 0, 0, 3, 0]);
    expect(week.yourGames).toBe(5);
    expect(week.packedNights.map((day) => day.date)).toEqual(['2026-10-10']);
    expect(week.bestStreamNight?.date).toBe('2026-10-06');
  });
});

describe('the lineup', () => {
  const roster = matchRosterText('Igor Shesterkin, Cale Makar, Connor McDavid, Quinn Hughes, Nathan MacKinnon', bio);

  it('groups forwards, defence and goalies, best-known first', () => {
    expect(rosterGroups(roster).map((group) => [group.label, group.players.map((p) => p.name)])).toEqual([
      ['Forwards', ['Connor McDavid', 'Nathan MacKinnon']],
      ['Defence', ['Cale Makar', 'Quinn Hughes']],
      ['Goalies', ['Igor Shesterkin']],
    ]);
  });

  it('copies the card as text for a group chat', () => {
    const text = rosterCardText({ teamName: 'McDavid Copperfield', verdict: { key: 'x', title: 'Blue Chip Club', roast: 'You shop at the designer store.' }, players: roster }, 'https://www.crackedicehockey.com/card');
    expect(text).toBe([
      'McDavid Copperfield: Blue Chip Club',
      'You shop at the designer store.',
      '',
      'Forwards: Connor McDavid (EDM), Nathan MacKinnon (COL)',
      'Defence: Cale Makar (COL), Quinn Hughes (MIN)',
      'Goalies: Igor Shesterkin (NYR)',
      '',
      'What does your draft say about you? https://www.crackedicehockey.com/card',
    ].join('\n'));
  });
});
