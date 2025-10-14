import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOGS_DIR = join(__dirname, '..', '..', 'logs');
const REQUEST_LOG = join(LOGS_DIR, 'coach_requests.log');

interface LogPayload {
  reqId: string;
  userId: string;
  window: { start: string; end: string };
  faCount: number;
  dropPoolCount: number;
  durationMs: number;
  truncatedFa?: number;
  truncatedDrops?: number;
  error?: string;
}

export function ensureLogsDir(): void {
  mkdirSync(LOGS_DIR, { recursive: true });
}

export function writeRequestLog(entry: LogPayload): void {
  ensureLogsDir();
  appendFileSync(REQUEST_LOG, `${JSON.stringify(entry)}\n`, 'utf8');
}

export function newRequestId(): string {
  return randomUUID();
}

export function readJsonFixture(pathSegments: string[]): any {
  const path = join(__dirname, '..', '..', ...pathSegments);
  return JSON.parse(readFileSync(path, 'utf8'));
}