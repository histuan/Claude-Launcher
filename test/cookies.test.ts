// Bug c: "signed in" = a claude.ai sessionKey row in the profile's cookie database (real SQLite files).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Account } from '../src/core/config.js';
import { SignedInTracker } from '../src/main/signedIn.js';
import { hasSessionCookie } from '../src/main/system/cookies.js';

async function tempDir(t: { after: (fn: () => Promise<void>) => void }, name: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), name));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** A Chromium-like cookie database with the given (host, name) rows. */
function cookieDb(file: string, rows: [string, string][]): void {
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE cookies (creation_utc INTEGER, host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB)');
  const insert = db.prepare('INSERT INTO cookies VALUES (0, ?, ?, \'\', x\'00\')');
  for (const [host, name] of rows) insert.run(host, name);
  db.close();
}

test('sessionKey for claude.ai → true; deleted after sign-out → false (even if the text stays in free pages)', async (t) => {
  const profile = await tempDir(t, 'launcher-cookies-');
  const temp = await tempDir(t, 'launcher-cookies-tmp-');
  await mkdir(path.join(profile, 'Network'));
  const file = path.join(profile, 'Network', 'Cookies');
  cookieDb(file, [['.claude.ai', 'sessionKey'], ['.claude.ai', 'anthropic-device-id']]);
  assert.equal(await hasSessionCookie(profile, temp), true);

  // Sign-out inside Claude deletes the row; SQLite may keep the bytes in a free page.
  const db = new DatabaseSync(file);
  db.exec("DELETE FROM cookies WHERE name = 'sessionKey'");
  db.close();
  assert.equal(await hasSessionCookie(profile, temp), false);
  assert.deepEqual(await readdir(temp), [], 'the temporary copy is deleted');
});

test('only claude.ai counts; other hosts and look-alikes do not', async (t) => {
  const profile = await tempDir(t, 'launcher-cookies-');
  await mkdir(path.join(profile, 'Network'));
  cookieDb(path.join(profile, 'Network', 'Cookies'), [['.example.com', 'sessionKey'], ['.notclaude.ai', 'sessionKey']]);
  assert.equal(await hasSessionCookie(profile), false);
  cookieDb(path.join(profile, 'Cookies'), []); // old layout is only used when Network\Cookies is missing
  assert.equal(await hasSessionCookie(profile), false);
});

test('unreadable cookie database → null (no file, not SQLite, no cookies table)', async (t) => {
  const profile = await tempDir(t, 'launcher-cookies-');
  assert.equal(await hasSessionCookie(profile), null);
  await mkdir(path.join(profile, 'Network'));
  await writeFile(path.join(profile, 'Network', 'Cookies'), 'not a database');
  assert.equal(await hasSessionCookie(profile), null);
  await rm(path.join(profile, 'Network', 'Cookies'));
  const db = new DatabaseSync(path.join(profile, 'Network', 'Cookies'));
  db.exec('CREATE TABLE other (x)');
  db.close();
  assert.equal(await hasSessionCookie(profile), null);
});

const account = (id: string): Account => ({
  id, label: id, email: null, realName: null, photo: null, profileDir: `C:\\Users\\u\\ClaudeProfiles\\${id}`,
});
const main: Account = { ...account('main'), label: null, profileDir: null };

test('tracker: cookie first, config.json only as fallback; a running profile keeps its last known state', async () => {
  const cookie = new Map<string, boolean | null>([['work', true], ['home', null]]);
  const config = new Map<string, boolean>([['work', true], ['home', true]]);
  const reads: string[] = [];
  const tracker = new SignedInTracker({
    sessionCookie: async (dir) => { reads.push(dir); return cookie.get(path.win32.basename(dir)) ?? null; },
    configOauth: async (dir) => config.get(path.win32.basename(dir)) ?? false,
  });
  const accounts = [main, account('work'), account('home')];
  assert.deepEqual(await tracker.signedOut(accounts, []), [], 'home: cookie DB unreadable → config.json');

  // Signed out inside Claude: the cookie row is gone, but config.json still has the oauth keys.
  cookie.set('work', false);
  assert.deepEqual(await tracker.signedOut(accounts, ['work']), [], 'running: last known state, file not read');
  assert.equal(reads.filter((d) => d.endsWith('work')).length, 1);
  assert.deepEqual(await tracker.signedOut(accounts, []), ['work'], 'closed: the cookie decides');

  tracker.forget('work');
  cookie.set('work', true);
  assert.deepEqual(await tracker.signedOut(accounts, ['work']), [], 'forgotten: read even while running');
});
