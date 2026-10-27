// Signed-in signal (Phase 4.1): a claude.ai "sessionKey" row in <profile>\Network\Cookies (SQLite).
// Only cookie names and hosts are queried, on a temporary copy that is deleted afterwards. Cookie values are never
// selected, decrypted or logged, and the real file is never opened by SQLite.
import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const QUERY = "SELECT 1 FROM cookies WHERE name = 'sessionKey' "
  + "AND (host_key = 'claude.ai' OR host_key LIKE '%.claude.ai') LIMIT 1";

const isFile = (p: string): Promise<boolean> => stat(p).then((s) => s.isFile(), () => false);

/** true/false from the cookie database; null when it cannot be read (no file, locked, not a cookie database). */
export async function hasSessionCookie(profileDir: string, tempRoot = os.tmpdir()): Promise<boolean | null> {
  const candidates = [path.join(profileDir, 'Network', 'Cookies'), path.join(profileDir, 'Cookies')];
  let source: string | null = null;
  for (const file of candidates) if (!source && (await isFile(file))) source = file;
  if (!source) return null;
  let dir: string | null = null;
  try {
    dir = await mkdtemp(path.join(tempRoot, 'claude-launcher-cookies-'));
    const copy = path.join(dir, 'Cookies');
    await copyFile(source, copy);
    // The journal / WAL hold the latest committed rows; copied alongside when present.
    for (const suffix of ['-journal', '-wal']) await copyFile(source + suffix, copy + suffix).catch(() => undefined);
    const { DatabaseSync } = await import('node:sqlite');
    const query = (readOnly: boolean): boolean => {
      const db = new DatabaseSync(copy, { readOnly });
      try {
        return db.prepare(QUERY).get() !== undefined;
      } finally {
        db.close();
      }
    };
    try {
      return query(true);
    } catch {
      // A copied journal may need to be replayed first; that only ever writes to our private temp copy.
      return query(false);
    }
  } catch (err) {
    console.warn(`Cookie database not readable: ${(err as Error).message}`);
    return null;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined);
  }
}
