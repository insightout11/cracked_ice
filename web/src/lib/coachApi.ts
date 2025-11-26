import { z } from 'zod';
import type { LeagueProfile } from '../types';

// Zod Schemas for runtime validation
const PresetsResponseSchema = z.object({
  presets: z.array(z.string())
});

const WeightsResponseSchema = z.object({
  skater: z.record(z.string(), z.number()),
  goalie: z.record(z.string(), z.number()),
  source: z.string(),
  warnings: z.array(z.string()).optional()
});

const PlayerProjectionSchema = z.object({
  playerId: z.string(),
  fppg: z.number(),
  starts: z.number(),
  projectedPoints: z.number(),
  reasons: z.array(z.string()).optional()
});

const ProjectionsResponseSchema = z.object({
  projections: z.record(z.string(), PlayerProjectionSchema)
});

// Type exports
export type PresetsResponse = z.infer<typeof PresetsResponseSchema>;
export type WeightsResponse = z.infer<typeof WeightsResponseSchema>;
export type PlayerProjection = z.infer<typeof PlayerProjectionSchema>;
export type ProjectionsResponse = z.infer<typeof ProjectionsResponseSchema>;

// Error types
export class CoachApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'CoachApiError';
  }
}

// Global loading state management
type LoadingListener = (isLoading: boolean) => void;
type ErrorListener = (error: CoachApiError) => void;

const loadingListeners = new Set<LoadingListener>();
const errorListeners = new Set<ErrorListener>();

export function onLoadingChange(listener: LoadingListener): () => void {
  loadingListeners.add(listener);
  return () => loadingListeners.delete(listener);
}

export function onError(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function notifyLoading(isLoading: boolean) {
  loadingListeners.forEach(listener => listener(isLoading));
}

function notifyError(error: CoachApiError) {
  errorListeners.forEach(listener => listener(error));
}

// Abortable fetch with retry logic
interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  retryOnNetworkError?: boolean;
}

async function fetchWithRetry<T>(
  url: string,
  schema: z.ZodSchema<T>,
  options: FetchOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    signal,
    retryOnNetworkError = true
  } = options;

  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const fullURL = `${baseURL}${url}`;

  const fetchAttempt = async (isRetry = false): Promise<T> => {
    try {
      const response = await fetch(fullURL, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined,
        signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new CoachApiError(
          `API request failed: ${response.statusText}`,
          response.status
        );
      }

      const json = await response.json();

      // Runtime validation with Zod
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new CoachApiError(
          `Invalid response format: ${parsed.error.message}`,
          response.status,
          parsed.error
        );
      }

      return parsed.data;
    } catch (error) {
      // Don't retry if aborted
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // Retry once on network errors
      if (!isRetry && retryOnNetworkError && isNetworkError(error)) {
        return fetchAttempt(true);
      }

      // Convert to CoachApiError if not already
      if (error instanceof CoachApiError) {
        throw error;
      }

      throw new CoachApiError(
        error instanceof Error ? error.message : 'Network request failed',
        undefined,
        error
      );
    }
  };

  try {
    notifyLoading(true);
    return await fetchAttempt();
  } catch (error) {
    const apiError = error instanceof CoachApiError
      ? error
      : new CoachApiError('Unknown error', undefined, error);
    notifyError(apiError);
    throw apiError;
  } finally {
    notifyLoading(false);
  }
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const networkErrorMessages = [
    'Failed to fetch',
    'Network request failed',
    'NetworkError',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND'
  ];

  return networkErrorMessages.some(msg => error.message.includes(msg));
}

// API Functions

/**
 * Get available scoring presets
 */
export async function getPresets(signal?: AbortSignal): Promise<PresetsResponse> {
  return fetchWithRetry('/api/coach/presets', PresetsResponseSchema, {
    method: 'GET',
    signal
  });
}

/**
 * Get resolved scoring weights for a league profile
 */
export async function getWeights(
  league?: LeagueProfile,
  signal?: AbortSignal
): Promise<WeightsResponse> {
  return fetchWithRetry('/api/coach/weights', WeightsResponseSchema, {
    method: 'POST',
    body: { league },
    signal
  });
}

/**
 * Get player projections for a date window
 */
export interface ProjectionsRequest {
  league: LeagueProfile;
  window: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  roster: Array<{
    id: string;
    team: string;
    position: string;
    current_slot?: string;
  }>;
  free_agents?: Array<{
    id: string;
    team: string;
    position: string;
  }>;
}

export async function getProjections(
  request: ProjectionsRequest,
  signal?: AbortSignal
): Promise<ProjectionsResponse> {
  return fetchWithRetry('/api/coach/projections', ProjectionsResponseSchema, {
    method: 'POST',
    body: request,
    signal
  });
}
