import assert from 'node:assert/strict';
import test from 'node:test';
import {
  minUsableStatsRatio,
  positionGroupOf,
  priorSeasonLines,
  resolveStatsSeason,
} from '../../apps/api/scripts/stats-season.mjs';

const config = { seasonId: '20262027', regularSeasonStart: '2026-09-29' };

test('stats stay on last season until the morning after opening night', () => {
  assert.equal(resolveStatsSeason('20262027', config, new Date('2026-09-23T09:00:00Z')), '20252026');
  // Opening-day run: no games have been played yet.
  assert.equal(resolveStatsSeason('20262027', config, new Date('2026-09-29T09:00:00Z')), '20252026');
  assert.equal(resolveStatsSeason('20262027', config, new Date('2026-09-30T09:00:00Z')), '20262027');
});

test('the usable-stats floor is lowered for the first week of games only', () => {
  assert.equal(minUsableStatsRatio(config, new Date('2026-09-23T09:00:00Z')), 0.5);
  assert.equal(minUsableStatsRatio(config, new Date('2026-09-30T09:00:00Z')), 0.05);
  // Oct 6 reports games through Oct 5, the end of the first week of games.
  assert.equal(minUsableStatsRatio(config, new Date('2026-10-06T09:00:00Z')), 0.05);
  assert.equal(minUsableStatsRatio(config, new Date('2026-10-07T09:00:00Z')), 0.5);
});

test('last season\'s NHL lines are kept on the switch and carried forward after it', () => {
  const lastSeasonSnapshot = {
    source: 'api-web.nhle.com->api.nhle.com:20252026',
    players: {
      'nhl:1': { skaterStats: { gamesPlayed: 82, goals: 40 }, advancedStats: { avgToiPerGame: 1300 }, careerHistory: { '20252026': { gamesPlayed: 82 } } },
      // A prospect's junior line has no NHL career season: never kept.
      'nhl:2': { skaterStats: { gamesPlayed: 54, goals: 33 }, careerHistory: {} },
      'nhl:3': { goalieStats: { gamesPlayed: 50, wins: 30 }, careerHistory: { '20252026': { gamesPlayed: 50 } } },
    },
  };
  const first = priorSeasonLines(lastSeasonSnapshot, '20262027');
  assert.deepEqual([...first.keys()], ['nhl:1', 'nhl:3']);
  assert.equal(first.get('nhl:1').priorSeason, '20252026');
  assert.equal(first.get('nhl:1').priorSkaterStats.goals, 40);
  assert.equal(first.get('nhl:3').priorGoalieStats.wins, 30);
  assert.equal(first.get('nhl:1').priorAdvancedStats.avgToiPerGame, 1300);

  const newSeasonSnapshot = {
    source: 'api-web.nhle.com->api.nhle.com:20262027',
    players: { 'nhl:1': { skaterStats: { gamesPlayed: 3 }, ...first.get('nhl:1') } },
  };
  const carried = priorSeasonLines(newSeasonSnapshot, '20262027');
  assert.equal(carried.get('nhl:1').priorSkaterStats.goals, 40);
  assert.equal(carried.get('nhl:1').priorAdvancedStats.avgToiPerGame, 1300);

  // Before the switch (still hydrating last season) nothing is attached.
  assert.equal(priorSeasonLines(lastSeasonSnapshot, '20252026').size, 0);
});

test('position groups', () => {
  assert.equal(positionGroupOf(['G']), 'G');
  assert.equal(positionGroupOf(['D']), 'D');
  assert.equal(positionGroupOf(['C', 'LW']), 'F');
  assert.equal(positionGroupOf([]), 'F');
});
