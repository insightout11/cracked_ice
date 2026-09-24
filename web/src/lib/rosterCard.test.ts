import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRosterCard, buildWeekPreview, matchRosterText, parsePlayerBio, type BioPlayer } from './rosterCard';
import { rosterTeamNames } from './rosterCardNames';

const bio = parsePlayerBio(JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/player-bio.json'), 'utf8')));
const TODAY = '2026-09-24';

function player(name: string, extra: Partial<BioPlayer> = {}): BioPlayer {
  return { id: name, name, team: 'TOR', pos: ['C'], number: null, shoots: 'L', heightIn: 73, weightLb: 195, birthDate: '1998-06-01', country: 'CAN', city: 'Toronto', adp: null, ...extra };
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

  it('takes the better-known player when two share a name, and ignores names inside words', () => {
    const [aho] = matchRosterText('Sebastian Aho', bio);
    expect(aho.team).toBe('CAR');
    expect(matchRosterText('Makarov and Connor McDavidson', bio).map((p) => p.name)).toEqual([]);
  });
});

describe('the roster card', () => {
  it('roasts an old roster and finds its shared birthday', () => {
    const roster = [
      player('Old One', { birthDate: '1988-03-05' }),
      player('Old Two', { birthDate: '1989-03-05' }),
      player('Old Three', { birthDate: '1990-07-01' }),
      player('Old Four', { birthDate: '1991-01-01' }),
      player('Old Five', { birthDate: '1992-01-01', team: 'EDM' }),
      player('Old Six', { birthDate: '1993-01-01', team: 'EDM' }),
    ];
    const card = buildRosterCard(roster, TODAY);
    expect(card.verdict.title).toBe('The Nostalgia Tour');
    expect(card.verdict.roast).toContain('Average age 36.1.');
    expect(card.facts[0].text).toBe('Old One and Old Two share a birthday (March 5). One cake, two candles, zero excuses.');
    expect(card.facts).toHaveLength(3);
  });

  it('calls out a homer and a nation', () => {
    const swedes = Array.from({ length: 8 }, (_, index) => player(`Svensson ${index}`, { country: index < 5 ? 'SWE' : 'CAN', team: index < 4 ? 'DET' : 'TOR', birthDate: `199${index}-0${index + 1}-1${index}` }));
    const card = buildRosterCard(swedes, TODAY);
    expect([card.verdict.title, ...card.badges]).toEqual(expect.arrayContaining(['Swedish House Mafia', 'The Homer']));
  });

  it('falls back to a balanced verdict', () => {
    const roster = Array.from({ length: 6 }, (_, index) => player(`Player ${index}`, { country: ['CAN', 'USA', 'SWE', 'FIN', 'CAN', 'USA'][index], team: ['TOR', 'MTL', 'BOS', 'NYR', 'CHI', 'DET'][index], birthDate: `199${index + 5}-0${index + 1}-0${index + 1}`, city: `City ${index}`, shoots: index % 2 ? 'R' : 'L' }));
    expect(buildRosterCard(roster, TODAY).verdict.key).toBe('balanced');
  });

  it('names a team after its best-known players, puns first', () => {
    const roster = matchRosterText('Nick Suzuki, Connor McDavid, Cale Makar, Some Nobody', bio);
    const names = rosterTeamNames(roster);
    expect(names[0]).toBe('McDavid Copperfield');
    expect(names).toContain('The Makar-ena');
    expect(names.length).toBeGreaterThan(5);
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
