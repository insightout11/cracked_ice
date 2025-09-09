import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  abbreviation: z.string(),
});

// New NHL Web API team schema
export const NHLWebTeamSchema = z.object({
  id: z.number(),
  name: z.object({
    default: z.string(),
  }),
  abbrev: z.string(),
});

// Flexible teams response schema that handles both formats
export const TeamsResponseSchema = z.union([
  z.object({
    teams: z.array(TeamSchema),
  }),
  z.array(TeamSchema),
  z.array(NHLWebTeamSchema),
]);

export const GameDateSchema = z.object({
  date: z.string(),
});

export const GameSchema = z.object({
  gameDate: z.string(),
  teams: z.object({
    away: z.object({
      team: TeamSchema,
    }),
    home: z.object({
      team: TeamSchema,
    }),
  }),
});

// New NHL Web API game schema
export const NHLWebGameSchema = z.object({
  id: z.number(),
  startTimeUTC: z.string(),
  awayTeam: z.object({
    id: z.number(),
    abbrev: z.string(),
  }),
  homeTeam: z.object({
    id: z.number(),
    abbrev: z.string(),
  }),
});

// Flexible schedule response schema
export const ScheduleResponseSchema = z.union([
  z.object({
    dates: z.array(z.object({
      date: z.string(),
      games: z.array(GameSchema),
    })),
  }),
  z.object({
    gameWeek: z.array(z.object({
      date: z.string(),
      games: z.array(NHLWebGameSchema),
    })),
  }),
  z.object({
    games: z.array(NHLWebGameSchema),
  }),
]);

export type Team = z.infer<typeof TeamSchema>;
export type TeamsResponse = z.infer<typeof TeamsResponseSchema>;
export type ScheduleResponse = z.infer<typeof ScheduleResponseSchema>;

export interface ComplementResult {
  teamId: number;
  teamName: string;
  abbreviation: string;
  complement: number;
  weightedComplement: number;
  datesComplement: string[];
}

export interface AddedStartsRequest {
  seedCenterTeamIds: number[];
  candidateTeamId: number;
  window: '7d' | '14d' | 'season';
}

export interface AddedStartsResult {
  addedStarts: number;
  dates: string[];
}