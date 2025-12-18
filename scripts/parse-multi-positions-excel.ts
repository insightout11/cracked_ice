import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MultiPositionMapping {
  description: string;
  lastUpdated: string;
  players: Record<string, { name: string; positions: string[] }>;
}

// Load existing players.json to get player IDs
function loadPlayersContext() {
  const playersPath = path.join(__dirname, '../data/players.json');
  const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf-8'));
  return playersData.players || [];
}

// Search for player by name (fuzzy match)
function searchPlayerByName(name: string, playersContext: any[]): any | null {
  const normalizedName = name.toLowerCase().trim();

  // Try exact match first
  let match = playersContext.find(p =>
    p.name.toLowerCase() === normalizedName
  );

  if (match) return match;

  // Try last name match
  const nameParts = normalizedName.split(' ');
  const lastName = nameParts[nameParts.length - 1];

  // Find all players with matching last name
  const lastNameMatches = playersContext.filter(p => {
    const playerLastName = p.name.toLowerCase().split(' ').pop();
    return playerLastName === lastName;
  });

  if (lastNameMatches.length === 1) {
    return lastNameMatches[0];
  }

  // If multiple matches, try to match first name too
  if (lastNameMatches.length > 1 && nameParts.length > 1) {
    const firstName = nameParts[0];
    const firstInitial = firstName.charAt(0);

    const fullMatch = lastNameMatches.find(p => {
      const playerFirstName = p.name.toLowerCase().split(' ')[0];
      return playerFirstName === firstName || playerFirstName.startsWith(firstInitial);
    });

    if (fullMatch) return fullMatch;
  }

  return lastNameMatches[0] || null;
}

// Parse positions from string like "C,LW" or "LW/RW"
function parsePositions(positionStr: string | undefined | null): string[] | null {
  if (!positionStr || typeof positionStr !== 'string') return null;

  // Split by comma, slash, or space
  const positions = positionStr
    .split(/[,\/\s]+/)
    .map(p => p.trim().toUpperCase())
    .filter(p => ['C', 'LW', 'RW', 'D', 'G'].includes(p));

  // Only return if multiple positions
  return positions.length > 1 ? positions : null;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx ts-node parse-multi-positions-excel.ts <path-to-excel-file.xlsx>');
    console.error('Example: npx ts-node parse-multi-positions-excel.ts ~/Downloads/fantasy-projections.xlsx');
    process.exit(1);
  }

  const excelPath = args[0];

  if (!fs.existsSync(excelPath)) {
    console.error(`Error: File not found: ${excelPath}`);
    process.exit(1);
  }

  console.log(`Loading Excel file: ${excelPath}`);

  // Read Excel file
  const workbook = XLSX.readFile(excelPath);

  console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);

  // Find sheet with player data (has both Name/Player and Position columns)
  let sheetName: string | null = null;
  let data: any[] = [];
  let nameKey: string | undefined;
  let positionKey: string | undefined;

  for (const sheet of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheet];
    const sheetData = XLSX.utils.sheet_to_json(worksheet);

    if (sheetData.length === 0) continue;

    const sampleRow = sheetData[0] as any;
    const columns = Object.keys(sampleRow);

    // Look for player name column
    const candidateNameKey = columns.find(key =>
      key.toLowerCase().includes('name') ||
      key.toLowerCase() === 'player' ||
      key.toLowerCase().includes('player name')
    );

    // Look for position column
    const candidatePositionKey = columns.find(key =>
      key.toLowerCase() === 'position' ||
      key.toLowerCase() === 'pos' ||
      key.toLowerCase() === 'positions' ||
      key.toLowerCase().includes('elig')
    );

    if (candidateNameKey && candidatePositionKey) {
      sheetName = sheet;
      data = sheetData;
      nameKey = candidateNameKey;
      positionKey = candidatePositionKey;
      console.log(`Found player data in sheet: "${sheet}"`);
      console.log(`  Columns: Name="${nameKey}", Position="${positionKey}"`);
      console.log(`  ${data.length} rows`);
      break;
    }
  }

  if (!sheetName || !nameKey || !positionKey || data.length === 0) {
    console.error('\nError: Could not find sheet with player data');
    console.error('Looking for a sheet with both Name/Player and Position columns');
    process.exit(1);
  }

  console.log('\nLoading players database...');

  const playersContext = loadPlayersContext();
  console.log(`Loaded ${playersContext.length} players from database\n`);

  const multiPositionPlayers: Record<string, { name: string; positions: string[] }> = {};
  let totalProcessed = 0;
  let totalMultiPosition = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;

  // Process each row
  for (const row of data as any[]) {
    totalProcessed++;

    const name = row[nameKey];
    const positionStr = row[positionKey];

    if (!name) continue;

    const positions = parsePositions(positionStr);

    if (positions && positions.length > 1) {
      totalMultiPosition++;

      // Try to match to NHL player ID
      const match = searchPlayerByName(name, playersContext);

      if (match) {
        multiPositionPlayers[match.id] = {
          name: match.name,
          positions: positions
        };
        totalMatched++;

        if (totalMatched <= 10) {
          console.log(`✓ ${match.name} (${positions.join('/')}) -> ${match.id}`);
        }
      } else {
        totalUnmatched++;
        if (totalUnmatched <= 5) {
          console.warn(`⚠️  Could not match: ${name} (${positions.join('/')})`);
        }
      }
    }
  }

  // Write to mapping file
  const outputPath = path.join(__dirname, '../data/multi-position-players.json');
  const mapping: MultiPositionMapping = {
    description: "Multi-position players extracted from Yahoo Fantasy projections",
    lastUpdated: new Date().toISOString().split('T')[0],
    players: multiPositionPlayers
  };

  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ Parsing complete!`);
  console.log(`  Total rows processed: ${totalProcessed}`);
  console.log(`  Multi-position players found: ${totalMultiPosition}`);
  console.log(`  Successfully matched to NHL IDs: ${totalMatched}`);
  console.log(`  Unmatched: ${totalUnmatched}`);
  console.log(`\n✓ Wrote ${Object.keys(multiPositionPlayers).length} players to: ${outputPath}`);
  console.log(`${'='.repeat(60)}\n`);

  // Show sample of what was found
  if (Object.keys(multiPositionPlayers).length > 10) {
    console.log(`Sample of multi-position players (showing first 10):`);
    const sample = Object.entries(multiPositionPlayers).slice(0, 10);
    sample.forEach(([id, player]) => {
      console.log(`  - ${player.name} (${player.positions.join('/')})`);
    });
    console.log(`  ... and ${Object.keys(multiPositionPlayers).length - 10} more\n`);
  } else if (Object.keys(multiPositionPlayers).length > 0) {
    console.log(`All multi-position players found:`);
    Object.entries(multiPositionPlayers).forEach(([id, player]) => {
      console.log(`  - ${player.name} (${player.positions.join('/')})`);
    });
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
