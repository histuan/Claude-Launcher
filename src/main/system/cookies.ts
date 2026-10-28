// Signed-in signal: a valid claude.ai "sessionKey" row in <profile>\Network\Cookies (SQLite).
// Only names, hosts, the expiry date and value LENGTHS are queried, on a temporary copy that is deleted afterwards.
// Cookie values are never selected, decrypted or logged, and the real file is never opened by SQLite.
import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const QUERY = 'SELECT expires_utc / 1000000 AS exp, length(value) AS v, length(encrypted_value) AS e FROM cookies '
  + "WHERE name = 'sessionKey' AND (host_key = 'claude.ai' OR host_key LIKE '%.claude.ai')";

/** Seconds between 1601-01-01 (Chromium's epoch) and 1970-01-01. */
const EPOCH_1601_S = 11_644_473_600;

/**
 * found = a sessionKey row that is neither expired nor empty; missing = no row; expired / empty = only stale rows;
 * unreadable = no file, the copy failed (e.g. locked) or not a cookie database. The reason has no cookie data.
 */
export type CookieCheck =
  | { state: 'found' | 'missing' | 'expired' | 'empty' }
  | { state: 'unreadable'; reason: string };

export interface SessionRow {
  /** expires_utc in seconds since 1601; 0 = session cookie (no expiry). */
  exp: number | null;
  /** Lengths only: the plain and encrypted value are never read. */
  v: number | null;
  e: number | null;
}

/** Pure decision on the sessionKey rows (any valid row wins). */
export function classifySessionRows(rows: SessionRow[], nowMs: number): 'found' | 'missing' | 'expired' | 'empty' {
  if (rows.length === 0) return 'missing';
  const nowS = Math.floor(nowMs / 1000) + EPOCH_1601_S;
  const expired = (r: SessionRow): boolean => (r.exp ?? 0) > 0 && (r.exp ?? 0) <= nowS;
  const empty = (r: SessionRow): boolean => (r.v ?? 0) === 0 && (r.e ?? 0) === 0;
  if (rows.some((r) => !expired(r) && !empty(r))) return 'found';
  return rows.some(expired) ? 'expired' : 'empty';
}

const isFile = (p: string): Promise<boolean> => stat(p).then((s) => s.isFile(), () => false);
const errText = (err: unknown): string => (err as NodeJS.ErrnoException).code ?? (err as Error).message;

export async function readSessionCookie(profileDir: string, tempRoot = os.tmpdir(), nowMs = Date.now()): Promise<CookieCheck> {
  const candidates = [path.join(profileDir, 'Network', 'Cookies'), path.join(profileDir, 'Cookies')];
  let source: string | null = null;
  for (const file of candidates) if (!source && (await isFile(file))) source = file;
  if (!source) return { state: 'unreadable', reason: 'no cookie file' };
  let dir: string | null = null;
  try {
    dir = await mkdtemp(path.join(tempRoot, 'claude-launcher-cookies-'));
    const copy = path.join(dir, 'Cookies');
    try {
      await copyFile(source, copy);
    } catch (err) {
      return { state: 'unreadable', reason: `copy failed (${errText(err)})` };
    }
    // The journal / WAL hold the latest committed rows (or what a crashed write must roll back): copied alongside.
    for (const suffix of ['-journal', '-wal']) await copyFile(source + suffix, copy + suffix).catch(() => undefined);
    const { DatabaseSync } = await import('node:sqlite');
    const query = (readOnly: boolean): SessionRow[] => {
      const db = new DatabaseSync(copy, { readOnly });
      try {
        return db.prepare(QUERY).all() as unknown as SessionRow[];
      } finally {
        db.close();
      }
    };
    let rows: SessionRow[];
    try {
      rows = query(true);
    } catch {
      // A copied journal / WAL may need to be replayed first; that only ever writes to our private temp copy.
      try {
        rows = query(false);
      } catch (err) {
        return { state: 'unreadable', reason: `sqlite: ${(err as Error).message}` };
      }
    }
    return { state: classifySessionRows(rows, nowMs) };
  } catch (err) {
    return { state: 'unreadable', reason: errText(err) };
  } finally {
    // Every SQLite handle is closed above (query's finally) before this: Windows cannot delete an open file. rm
    // retries EBUSY / EPERM a few times (~100 ms apart) for a file that is still being released.
    if (dir) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }
}
