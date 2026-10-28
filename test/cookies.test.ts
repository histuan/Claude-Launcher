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

const files = (cookie: Map<string, boolean | null>, keys: Map<string, boolean>) => ({
  sessionCookie: async (dir: string) => cookie.get(path.win32.basename(dir)) ?? null,
  configOauth: async (dir: string) => keys.get(path.win32.basename(dir)) ?? false,
});

test('tracker: the sessionKey cookie decides; the keys alone never count (they stay after a sign-out)', async () => {
  const tracker = new SignedInTracker(files(
    new Map([['work', true], ['gone', false], ['fresh', false]]),
    new Map([['work', false], ['gone', true], ['fresh', false]]),
  ));
  // work: cookie → signed in; gone: signed out inside Claude (keys stay) → Not signed in; fresh: nothing → Not signed in.
  assert.deepEqual(await tracker.signedOut([main, account('work'), account('gone'), account('fresh')], []), ['gone', 'fresh']);
});

test('tracker: cookie database unreadable → the config.json keys decide', async () => {
  const tracker = new SignedInTracker(files(new Map(), new Map([['work', true], ['home', false]])));
  assert.deepEqual(await tracker.signedOut([main, account('work'), account('home')], []), ['home']);
});

test('tracker: a running profile keeps its last known state until forgotten', async () => {
  let signedIn = true;
  const reads: string[] = [];
  const tracker = new SignedInTracker({
    sessionCookie: async (dir) => { reads.push(dir); return signedIn; },
    configOauth: async () => false,
  });
  const accounts = [main, account('work')];
  assert.deepEqual(await tracker.signedOut(accounts, []), []);
  signedIn = false;
  assert.deepEqual(await tracker.signedOut(accounts, ['work']), [], 'running: last known state, file not read');
  assert.equal(reads.length, 1);
  assert.deepEqual(await tracker.signedOut(accounts, []), ['work'], 'closed: read again');
  tracker.forget('work');
  signedIn = true;
  assert.deepEqual(await tracker.signedOut(accounts, ['work']), [], 'forgotten: read even while running');
});
