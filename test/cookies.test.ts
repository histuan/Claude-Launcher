// "Signed in" = a valid claude.ai sessionKey row in the profile's cookie database (real SQLite files).
// 0.4.5: expired / empty rows do not count; every decision is logged (no secrets); unreadable has a reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Account } from '../src/core/config.js';
import { SignedInTracker } from '../src/main/signedIn.js';
import { readSessionCookie, type CookieCheck } from '../src/main/system/cookies.js';

async function tempDir(t: { after: (fn: () => Promise<void>) => void }, name: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), name));
  // Short retry: on Windows a just-closed SQLite file can stay busy for a moment.
  t.after(() => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

const NOW = Date.UTC(2026, 9, 28);
/** Chromium time: microseconds since 1601-01-01 (UTC). */
const chromiumTime = (ms: number): bigint => (BigInt(ms) + 11_644_473_600_000n) * 1000n;
const FUTURE = chromiumTime(NOW + 30 * 86_400_000);

/** A Chromium-like cookie database with (host, name[, expires_utc, encrypted bytes]) rows. */
function cookieDb(file: string, rows: [string, string, bigint?, string?][]): void {
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE cookies (creation_utc INTEGER, host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB, '
    + 'expires_utc INTEGER)');
  const insert = db.prepare('INSERT INTO cookies VALUES (0, ?, ?, \'\', ?, ?)');
  for (const [host, name, expires = FUTURE, bytes = '00'] of rows) insert.run(host, name, Buffer.from(bytes, 'hex'), expires);
  db.close();
}

const read = (profile: string, temp?: string): Promise<CookieCheck['state']> =>
  readSessionCookie(profile, temp, NOW).then((c) => c.state);

test('sessionKey for claude.ai → found; deleted after sign-out → missing (even if the text stays in free pages)', async (t) => {
  const profile = await tempDir(t, 'launcher-cookies-');
  const temp = await tempDir(t, 'launcher-cookies-tmp-');
  await mkdir(path.join(profile, 'Network'));
  const file = path.join(profile, 'Network', 'Cookies');
  cookieDb(file, [['.claude.ai', 'sessionKey'], ['.claude.ai', 'anthropic-device-id']]);
  assert.equal(await read(profile, temp), 'found');

  // Sign-out inside Claude deletes the row; SQLite may keep the bytes in a free page.
  const db = new DatabaseSync(file);
  db.exec("DELETE FROM cookies WHERE name = 'sessionKey'");
  db.close();
  assert.equal(await read(profile, temp), 'missing');
  assert.deepEqual(await readdir(temp), [], 'the temporary copy is deleted');
});

test('only claude.ai counts; other hosts and look-alikes do not', async (t) => {
  const profile = await tempDir(t, 'launcher-cookies-');
  await mkdir(path.join(profile, 'Network'));
  cookieDb(path.join(profile, 'Network', 'Cookies'), [['.example.com', 'sessionKey'], ['.notclaude.ai', 'sessionKey']]);
  assert.equal(await read(profile), 'missing');
  cookieDb(path.join(profile, 'Cookies'), []); // old layout is only used when Network\Cookies is missing
  assert.equal(await read(profile), 'missing');
});

test('unreadable cookie database → unreadable with a reason (no file, not SQLite, no cookies table)', async (t) => {
  const profile = await tempDir(t, 'launcher-cookies-');
  assert.deepEqual(await readSessionCookie(profile), { state: 'unreadable', reason: 'no cookie file' });
  await mkdir(path.join(profile, 'Network'));
  await writeFile(path.join(profile, 'Network', 'Cookies'), 'not a database');
  const notDb = await readSessionCookie(profile);
  assert.equal(notDb.state, 'unreadable');
  assert.match(notDb.state === 'unreadable' ? notDb.reason : '', /^sqlite: /);
  await rm(path.join(profile, 'Network', 'Cookies'));
  const db = new DatabaseSync(path.join(profile, 'Network', 'Cookies'));
  db.exec('CREATE TABLE other (x)');
  db.close();
  assert.equal(await read(profile), 'unreadable');
});

test('(b) expired sessionKey → expired; empty value (length 0) → empty; session cookie (expires 0) → found', async (t) => {
  const profile = await tempDir(t, 'launcher-cookies-');
  await mkdir(path.join(profile, 'Network'));
  const file = path.join(profile, 'Network', 'Cookies');
  cookieDb(file, [['.claude.ai', 'sessionKey', chromiumTime(NOW - 1000)]]);
  assert.equal(await read(profile), 'expired');
  await rm(file);
  cookieDb(file, [['claude.ai', 'sessionKey', FUTURE, '']]);
  assert.equal(await read(profile), 'empty');
  await rm(file);
  cookieDb(file, [['claude.ai', 'sessionKey', 0n]]);
  assert.equal(await read(profile), 'found');
  await rm(file);
  // One valid row among stale ones still counts.
  cookieDb(file, [['claude.ai', 'sessionKey', chromiumTime(NOW - 1000)], ['.claude.ai', 'sessionKey']]);
  assert.equal(await read(profile), 'found');
});

test('(c) -wal / -journal are copied with the database, so rows not yet merged into Cookies are seen', async (t) => {
  const profile = await tempDir(t, 'launcher-cookies-');
  const temp = await tempDir(t, 'launcher-cookies-tmp-');
  await mkdir(path.join(profile, 'Network'));
  const file = path.join(profile, 'Network', 'Cookies');
  cookieDb(file, []);
  // Like a running Chromium: the new row sits in Cookies-wal while the writer keeps the database open.
  // Closed in finally, before the folders are deleted: Windows cannot delete an open file (EBUSY).
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0');
    db.prepare("INSERT INTO cookies VALUES (0, '.claude.ai', 'sessionKey', '', x'00', ?)").run(FUTURE);
    assert.ok((await readFile(`${file}-wal`)).length > 0, 'the row is only in the -wal file');
    assert.equal(await read(profile, temp), 'found');
    assert.deepEqual(await readdir(temp), [], 'the temporary copy and its -wal / -shm are deleted');
  } finally {
    db.close();
  }
});
