import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'cache');

// Current NHL teams with approximate GA/60 and GF/60 based on 2024-25 season
// These are realistic values that will make the SoS calculations meaningful
const TEAM_STATS_DATA = {
  schemaVersion: 'v1',
  generatedAt: new Date().toISOString(),
  source: 'manual-entry-2024-25-season',
  teams: {
    // Strong defensive teams (low GA/60)
    'DAL': { teamCode: 'DAL', gaPer60: 2.1, gfPer60: 2.9 },
    'BOS': { teamCode: 'BOS', gaPer60: 2.2, gfPer60: 3.0 },
    'VAN': { teamCode: 'VAN', gaPer60: 2.3, gfPer60: 3.1 },
    'VGK': { teamCode: 'VGK', gaPer60: 2.4, gfPer60: 2.8 },
    'CAR': { teamCode: 'CAR', gaPer60: 2.4, gfPer60: 3.0 },

    // Average defense
    'FLA': { teamCode: 'FLA', gaPer60: 2.5, gfPer60: 3.2 },
    'NYR': { teamCode: 'NYR', gaPer60: 2.5, gfPer60: 2.9 },
    'TOR': { teamCode: 'TOR', gaPer60: 2.6, gfPer60: 3.4 },
    'COL': { teamCode: 'COL', gaPer60: 2.6, gfPer60: 3.3 },
    'EDM': { teamCode: 'EDM', gaPer60: 2.6, gfPer60: 3.5 },
    'TBL': { teamCode: 'TBL', gaPer60: 2.7, gfPer60: 3.1 },
    'LAK': { teamCode: 'LAK', gaPer60: 2.7, gfPer60: 2.7 },
    'WPG': { teamCode: 'WPG', gaPer60: 2.7, gfPer60: 3.4 },
    'NSH': { teamCode: 'NSH', gaPer60: 2.8, gfPer60: 2.6 },
    'NJD': { teamCode: 'NJD', gaPer60: 2.8, gfPer60: 3.2 },
    'MIN': { teamCode: 'MIN', gaPer60: 2.8, gfPer60: 2.8 },
    'SEA': { teamCode: 'SEA', gaPer60: 2.8, gfPer60: 2.7 },
    'PIT': { teamCode: 'PIT', gaPer60: 2.9, gfPer60: 2.9 },
    'WSH': { teamCode: 'WSH', gaPer60: 2.9, gfPer60: 3.0 },

    // Weak defense (high GA/60)
    'NYI': { teamCode: 'NYI', gaPer60: 3.0, gfPer60: 2.7 },
    'OTT': { teamCode: 'OTT', gaPer60: 3.0, gfPer60: 2.9 },
    'PHI': { teamCode: 'PHI', gaPer60: 3.1, gfPer60: 2.8 },
    'MTL': { teamCode: 'MTL', gaPer60: 3.1, gfPer60: 2.7 },
    'CGY': { teamCode: 'CGY', gaPer60: 3.2, gfPer60: 2.6 },
    'STL': { teamCode: 'STL', gaPer60: 3.2, gfPer60: 2.7 },
    'DET': { teamCode: 'DET', gaPer60: 3.3, gfPer60: 2.8 },
    'ANA': { teamCode: 'ANA', gaPer60: 3.3, gfPer60: 2.4 },
    'CBJ': { teamCode: 'CBJ', gaPer60: 3.4, gfPer60: 2.5 },
    'BUF': { teamCode: 'BUF', gaPer60: 3.4, gfPer60: 2.7 },
    'SJS': { teamCode: 'SJS', gaPer60: 3.6, gfPer60: 2.3 },
    'UTA': { teamCode: 'UTA', gaPer60: 3.5, gfPer60: 2.5 },
    'CHI': { teamCode: 'CHI', gaPer60: 3.5, gfPer60: 2.4 }
  }
};

try {
  mkdirSync(CACHE_DIR, { recursive: true });
  const outputPath = join(CACHE_DIR, 'team_stats.json');
  writeFileSync(outputPath, JSON.stringify(TEAM_STATS_DATA, null, 2));
  console.log(`✓ Team stats written to ${outputPath}`);
  console.log(`  Teams: ${Object.keys(TEAM_STATS_DATA.teams).length}`);
  console.log(`  League avg GA/60: ~2.8`);
} catch (error) {
  console.error('Failed to write team stats:', error);
  process.exit(1);
}
