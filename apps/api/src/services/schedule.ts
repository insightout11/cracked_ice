import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Window } from '../models/types';

interface ScheduleEntry {
  date: string;
  isOffNight: boolean;
}

interface ScheduleCacheFile {
  schemaVersion?: string;
  generatedAt: string;
  source: string;
  teams: Record<string, ScheduleEntry[]>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let memoisedCache: ScheduleCacheFile | null = null;
let offNightCache: Set<string> | null = null;

function loadScheduleCache(): ScheduleCacheFile {
  if (memoisedCache) {
    return memoisedCache;
  }

  const cachePath = join(__dirname, '..', '..', 'cache', 'schedule.json');
  try {
    memoisedCache = JSON.parse(readFileSync(cachePath, 'utf8')) as ScheduleCacheFile;
    return memoisedCache;
  } catch (error) {
    const fallbackPath = join(__dirname, '..', 'data', 'schedule.sample.json');
    const fallbackRaw = JSON.parse(readFileSync(fallbackPath, 'utf8')) as Record<string, string[]> & {
      _offnight?: string[];
    };

    const teams: ScheduleCacheFile['teams'] = {};
    const offNightSet = new Set(fallbackRaw._offnight ?? []);

    for (const [team, dates] of Object.entries(fallbackRaw)) {
      if (team.startsWith('_')) continue;
      teams[team] = dates.map((date) => ({ date, isOffNight: offNightSet.has(date) }));
    }

    memoisedCache = {
      schemaVersion: 'v1',
      generatedAt: new Date().toISOString(),
      source: 'fallback',
      teams
    };

    return memoisedCache;
  }
}

function buildOffNightSet(): Set<string> {
  if (offNightCache) {
    return offNightCache;
  }
  const cache = loadScheduleCache();
  offNightCache = new Set(
    Object.values(cache.teams)
      .flat()
      .filter((entry) => entry.isOffNight)
      .map((entry) => entry.date)
  );
  return offNightCache;
}

function withinWindow(date: string, window: Window): boolean {
  return date >= window.start && date <= window.end;
}

export function getTeamGames(team: string, window: Window): string[] {
  const cache = loadScheduleCache();
  const entries = cache.teams[team] ?? [];
  return entries
    .filter((entry) => withinWindow(entry.date, window))
    .map((entry) => entry.date);
}

export function isOffNight(date: string): boolean {
  return buildOffNightSet().has(date);
}

export function listWindowDates(window: Window): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${window.start}T00:00:00Z`);
  const end = new Date(`${window.end}T00:00:00Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function getTeamSchedule(team: string): ScheduleEntry[] {
  const cache = loadScheduleCache();
  return cache.teams[team] ?? [];
}

export function getScheduleMetadata(): Pick<ScheduleCacheFile, 'generatedAt' | 'source' | 'schemaVersion'> {
  const { generatedAt, source, schemaVersion } = loadScheduleCache();
  return { generatedAt, source, schemaVersion };
}