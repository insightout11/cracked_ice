import OpenAI from 'openai';
import type { UserContext, LeagueProfile, Player, FreeAgent } from '../features/coach/types';

export type OcrProvider = 'openai' | 'groq' | 'anthropic' | 'custom';

export interface ScreenshotIngestOptions {
  provider: OcrProvider;
  userId: string;
  promptHints?: string[];
}

export interface ScreenshotIngestResult {
  context: UserContext;
  rawText: string;
  provider: OcrProvider;
  durationMs: number;
  warnings?: string[];
}

export interface LeagueSettingsOcrResult {
  league_profile: LeagueProfile;
  rawText: string;
  confidence: number;
  warnings?: string[];
}

export interface RosterOcrResult {
  roster: Player[];
  rawText: string;
  unmatchedPlayers: Array<{ name: string; team?: string; position?: string }>;
  confidence: number;
}

export interface FreeAgentsOcrResult {
  free_agents: FreeAgent[];
  extractedPlayers: Array<{ name: string; team?: string; position?: string }>;
  rawText: string;
  unmatchedPlayers: Array<{ name: string; team?: string; position?: string }>;
  confidence: number;
}

type OcrPlayerMatch = { id: string; name: string; team: string; position: string };

export function resolveFreeAgentOcrMatch(
  entry: { name: string; team?: string },
  matches: OcrPlayerMatch[],
): OcrPlayerMatch | null {
  if (matches.length === 1) return matches[0];
  if (!entry.team) return null;

  const teamMatches = matches.filter((match) => match.team.toUpperCase() === entry.team?.toUpperCase());
  return teamMatches.length === 1 ? teamMatches[0] : null;
}

export class OcrNotConfiguredError extends Error {
  constructor() {
    super('Screenshot OCR pipeline not configured');
    this.name = 'OcrNotConfiguredError';
  }
}

export class OcrProviderError extends Error {
  constructor(message: string, public provider: OcrProvider) {
    super(message);
    this.name = 'OcrProviderError';
  }
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OcrNotConfiguredError();
  }
  return new OpenAI({ apiKey });
}

async function callOpenAIVision(
  imageBuffer: Buffer,
  prompt: string
): Promise<{ text: string; durationMs: number }> {
  const startedAt = Date.now();
  const client = getOpenAIClient();

  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64Image}`;

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
      max_tokens: 2000,
      temperature: 0.1
    });

    const text = response.choices[0]?.message?.content ?? '';
    return {
      text,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    throw new OcrProviderError(
      `OpenAI Vision API failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'openai'
    );
  }
}

export async function parseLeagueSettingsScreenshot(
  imageBuffer: Buffer,
  options: ScreenshotIngestOptions
): Promise<LeagueSettingsOcrResult> {
  if (options.provider !== 'openai') {
    throw new OcrProviderError(`Provider ${options.provider} not yet implemented`, options.provider);
  }

  const hints = options.promptHints?.join('\n') ?? '';
  const prompt = `You are analyzing a fantasy hockey league settings screenshot.

Extract the following information and return it as a JSON object:

{
  "league_name": "string",
  "scoring_type": "points",
  "scoring_weights": {
    "goals": number,
    "assists": number,
    "shots_on_goal": number,
    "blocks": number,
    "power_play_points": number
  },
  "lineup_slots": {
    "C": number,
    "LW": number,
    "RW": number,
    "F": number,
    "D": number,
    "G": number,
    "BN": number,
    "IR": number
  }
}

Additional hints: ${hints}

Important:
- Return ONLY valid JSON, no markdown code blocks
- If a value is not visible, use 0 or omit the key
- scoring_type should always be "points"
- Common lineup position abbreviations: C (Center), LW (Left Wing), RW (Right Wing), F (Forward), D (Defense), G (Goalie), BN (Bench), IR (Injured Reserve)
`;

  const result = await callOpenAIVision(imageBuffer, prompt);

  try {
    // Try to extract JSON from the response
    let jsonText = result.text.trim();

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const parsed = JSON.parse(jsonText);

    // Validate and construct league profile
    const league_profile: LeagueProfile = {
      league_name: parsed.league_name || 'My League',
      scoring_type: 'points' as const,
      scoring_weights: {
        goals: parsed.scoring_weights?.goals ?? 0,
        assists: parsed.scoring_weights?.assists ?? 0,
        shots_on_goal: parsed.scoring_weights?.shots_on_goal ?? 0,
        blocks: parsed.scoring_weights?.blocks ?? 0,
        power_play_points: parsed.scoring_weights?.power_play_points ?? 0
      },
      lineup_slots: parsed.lineup_slots || {}
    };

    const warnings: string[] = [];
    if (!parsed.league_name) warnings.push('League name not detected');
    if (Object.keys(league_profile.lineup_slots).length === 0) {
      warnings.push('Lineup slots not detected');
    }

    return {
      league_profile,
      rawText: result.text,
      confidence: warnings.length === 0 ? 0.9 : 0.7,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    throw new OcrProviderError(
      `Failed to parse league settings: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      'openai'
    );
  }
}

export async function parseRosterScreenshot(
  imageBuffer: Buffer,
  options: ScreenshotIngestOptions,
  playerSearchFn: (name: string) => Promise<Array<{ id: string; name: string; team: string; position: string }>>
): Promise<RosterOcrResult> {
  if (options.provider !== 'openai') {
    throw new OcrProviderError(`Provider ${options.provider} not yet implemented`, options.provider);
  }

  const hints = options.promptHints?.join('\n') ?? '';
  const prompt = `You are analyzing a fantasy hockey roster screenshot.

Extract all players from the table and return as a JSON array:

[
  {
    "name": "Connor McDavid",
    "team": "EDM",
    "position": "C",
    "current_slot": "C"
  }
]

Additional hints: ${hints}

Important:
- Return ONLY valid JSON array, no markdown code blocks
- Use full player names (first and last)
- Use 3-letter team abbreviations (EDM, TOR, BOS, etc.)
- Position should be single letter or slash-separated (C, LW, RW, D, G, C/LW, etc.)
- current_slot should be the roster slot the player is currently in (C, LW, RW, F, D, G, BN for bench, IR for injured reserve, IR+ for IR+)
- Extract ALL players visible in the screenshot
`;

  const result = await callOpenAIVision(imageBuffer, prompt);

  try {
    let jsonText = result.text.trim();
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const parsed = JSON.parse(jsonText) as Array<{
      name: string;
      team?: string;
      position?: string;
      current_slot?: string;
    }>;

    const roster: Player[] = [];
    const unmatchedPlayers: Array<{ name: string; team?: string; position?: string }> = [];

    // Attempt to match each player
    for (const entry of parsed) {
      try {
        const matches = await playerSearchFn(entry.name);

        if (matches.length > 0) {
          // If we have team info and multiple matches, prefer the one that matches the team
          let match = matches[0];
          if (entry.team && matches.length > 1) {
            const teamMatch = matches.find(m => m.team.toUpperCase() === entry.team?.toUpperCase());
            if (teamMatch) {
              match = teamMatch;
            }
          }
          roster.push({
            id: match.id,
            full_name: match.name,
            team: entry.team || match.team,
            position: entry.position || match.position,
            games_played: 1, // Placeholder
            stats: {
              goals: 0,
              assists: 0,
              shots_on_goal: 0,
              blocks: 0,
              power_play_points: 0
            },
            upcoming_games: [],
            is_drop_eligible: true,
            current_slot: entry.current_slot // Capture current roster slot from OCR
          });
        } else {
          unmatchedPlayers.push(entry);
        }
      } catch (error) {
        unmatchedPlayers.push(entry);
      }
    }

    return {
      roster,
      rawText: result.text,
      unmatchedPlayers,
      confidence: unmatchedPlayers.length === 0 ? 0.95 : Math.max(0.5, 1 - (unmatchedPlayers.length / parsed.length))
    };
  } catch (error) {
    throw new OcrProviderError(
      `Failed to parse roster: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      'openai'
    );
  }
}

export async function parseFreeAgentsScreenshot(
  imageBuffer: Buffer,
  options: ScreenshotIngestOptions,
  playerSearchFn: (name: string) => Promise<Array<{ id: string; name: string; team: string; position: string }>>
): Promise<FreeAgentsOcrResult> {
  if (options.provider !== 'openai') {
    throw new OcrProviderError(`Provider ${options.provider} not yet implemented`, options.provider);
  }

  const hints = options.promptHints?.join('\n') ?? '';
  const prompt = `You are analyzing a fantasy hockey free agents list screenshot.

Extract all available free agent players and return as a JSON array:

[
  {
    "name": "Brock Boeser",
    "team": "VAN",
    "position": "RW"
  }
]

Additional hints: ${hints}

Important:
- Return ONLY valid JSON array, no markdown code blocks
- Use full player names
- Use 3-letter team abbreviations
- Position should be single letter or slash-separated (C, LW, RW, D, G, etc.)
- Extract ALL players visible
`;

  const result = await callOpenAIVision(imageBuffer, prompt);

  try {
    let jsonText = result.text.trim();
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const parsed = JSON.parse(jsonText) as Array<{
      name: string;
      team?: string;
      position?: string;
    }>;

    const extractedPlayers = parsed
      .filter((entry) => typeof entry.name === 'string' && entry.name.trim().length > 0)
      .map((entry) => ({ name: entry.name.trim(), team: entry.team, position: entry.position }));
    const free_agents: FreeAgent[] = [];
    const unmatchedPlayers: Array<{ name: string; team?: string; position?: string }> = [];

    for (const entry of parsed) {
      try {
        const matches = await playerSearchFn(entry.name);

        const match = resolveFreeAgentOcrMatch(entry, matches);
        if (match) {
          free_agents.push({
            id: match.id,
            full_name: match.name,
            team: entry.team || match.team,
            position: entry.position || match.position,
            games_played: 1,
            stats: {
              goals: 0,
              assists: 0,
              shots_on_goal: 0,
              blocks: 0,
              power_play_points: 0
            },
            upcoming_games: [],
            is_drop_eligible: false
          });
        } else {
          unmatchedPlayers.push(entry);
        }
      } catch (error) {
        unmatchedPlayers.push(entry);
      }
    }

    return {
      free_agents,
      extractedPlayers,
      rawText: result.text,
      unmatchedPlayers,
      confidence: unmatchedPlayers.length === 0 ? 0.95 : Math.max(0.5, 1 - (unmatchedPlayers.length / parsed.length))
    };
  } catch (error) {
    throw new OcrProviderError(
      `Failed to parse free agents: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      'openai'
    );
  }
}

// Legacy function kept for backwards compatibility
export async function parseScreenshotLegacy(
  _imageBuffer: Buffer,
  _options: ScreenshotIngestOptions
): Promise<ScreenshotIngestResult> {
  throw new OcrNotConfiguredError();
}
