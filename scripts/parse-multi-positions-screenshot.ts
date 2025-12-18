import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

interface MultiPositionPlayer {
  name: string;
  positions: string[];
}

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
  const lastNameParts = normalizedName.split(' ');
  const lastName = lastNameParts[lastNameParts.length - 1];

  match = playersContext.find(p => {
    const playerLastName = p.name.toLowerCase().split(' ').pop();
    return playerLastName === lastName;
  });

  return match || null;
}

// Parse screenshot using OpenAI Vision API
async function parseScreenshot(imagePath: string): Promise<MultiPositionPlayer[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const client = new OpenAI({ apiKey });

  // Read image file
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64Image}`;

  const prompt = `You are analyzing a fantasy hockey player list screenshot showing players with multiple position eligibility.

Extract ALL players that have multiple positions (e.g., C/LW, LW/RW, etc.) and return as a JSON array:

[
  {
    "name": "Quinton Byfield",
    "positions": ["C", "LW"]
  },
  {
    "name": "Alex DeBrincat",
    "positions": ["LW", "RW"]
  }
]

Important:
- Return ONLY valid JSON array, no markdown code blocks
- Use full player names (first and last name)
- Only include players that have MULTIPLE positions (2 or more)
- positions should be an array of position strings: ["C"], ["LW", "RW"], etc.
- Valid positions: C, LW, RW, D, G
- If a player has only one position, DO NOT include them
- Extract ALL multi-position players visible in the screenshot`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      max_tokens: 3000,
      temperature: 0.1
    });

    const text = response.choices[0]?.message?.content ?? '';

    // Clean up markdown code blocks if present
    let jsonText = text.trim();
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const parsed = JSON.parse(jsonText) as MultiPositionPlayer[];
    return parsed;

  } catch (error) {
    throw new Error(`Failed to parse screenshot ${imagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx ts-node parse-multi-positions-screenshot.ts <screenshot1.png> [screenshot2.png ...]');
    console.error('Example: npx ts-node parse-multi-positions-screenshot.ts screenshots/multi-positions/*.png');
    process.exit(1);
  }

  console.log(`Loading players database...`);
  const playersContext = loadPlayersContext();
  console.log(`Loaded ${playersContext.length} players from database\n`);

  const multiPositionPlayers: Record<string, { name: string; positions: string[] }> = {};
  let totalFound = 0;
  let totalUnmatched = 0;

  for (let i = 0; i < args.length; i++) {
    const screenshotPath = args[i];

    if (!fs.existsSync(screenshotPath)) {
      console.warn(`⚠️  Screenshot not found: ${screenshotPath}`);
      continue;
    }

    console.log(`\n[${i + 1}/${args.length}] Parsing: ${path.basename(screenshotPath)}`);

    try {
      const parsedPlayers = await parseScreenshot(screenshotPath);
      console.log(`   Found ${parsedPlayers.length} multi-position players in screenshot`);

      let matched = 0;
      let unmatched = 0;

      for (const player of parsedPlayers) {
        // Only process if player has multiple positions
        if (player.positions.length < 2) {
          continue;
        }

        // Try to match to NHL player ID
        const match = searchPlayerByName(player.name, playersContext);

        if (match) {
          multiPositionPlayers[match.id] = {
            name: match.name,
            positions: player.positions
          };
          matched++;
        } else {
          console.warn(`   ⚠️  Could not match player: ${player.name} (${player.positions.join('/')})`);
          unmatched++;
        }
      }

      console.log(`   ✓ Matched ${matched} players, ${unmatched} unmatched`);
      totalFound += matched;
      totalUnmatched += unmatched;

    } catch (error) {
      console.error(`   ✗ Error parsing screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Write to mapping file
  const outputPath = path.join(__dirname, '../data/multi-position-players.json');
  const mapping: MultiPositionMapping = {
    description: "Multi-position players parsed from Yahoo/ESPN screenshots",
    lastUpdated: new Date().toISOString().split('T')[0],
    players: multiPositionPlayers
  };

  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ Parsing complete!`);
  console.log(`  Total unique multi-position players: ${Object.keys(multiPositionPlayers).length}`);
  console.log(`  Successfully matched: ${totalFound}`);
  console.log(`  Unmatched: ${totalUnmatched}`);
  console.log(`\n✓ Wrote to: ${outputPath}`);
  console.log(`${'='.repeat(60)}\n`);

  // Show sample of what was found
  if (Object.keys(multiPositionPlayers).length > 0) {
    console.log(`Sample of multi-position players found:`);
    const sample = Object.entries(multiPositionPlayers).slice(0, 10);
    sample.forEach(([id, player]) => {
      console.log(`  - ${player.name} (${player.positions.join('/')})`);
    });
    if (Object.keys(multiPositionPlayers).length > 10) {
      console.log(`  ... and ${Object.keys(multiPositionPlayers).length - 10} more`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
