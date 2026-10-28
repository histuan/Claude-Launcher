// Card "Not signed in" decision (0.4.5): logged per account, keys only when the cookie database is unreadable,
// a closed profile is retried before the keys decide, running accounts re-checked every ~30 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Account } from '../src/core/config.js';
import { SignedInTracker, type SignedInDeps } from '../src/main/signedIn.js';
import type { CookieCheck } from '../src/main/system/cookies.js';

const account = (id: string): Account => ({
  id, label: id, email: null, realName: null, photo: null, profileDir: `C:\\Users\\u\\ClaudeProfiles\\${id}`,
});
const main: Account = { ...account('main'), label: null, profileDir: null };
const id = (dir: string): string => path.win32.basename(dir);
const unreadable = (reason = 'copy failed (EBUSY)'): CookieCheck => ({ state: 'unreadable', reason });

function tracker(cookie: (id: string) => CookieCheck, keys: (id: string) => boolean, over: Partial<SignedInDeps> = {}) {
  const lines: string[] = [];
  let clock = 0;
  const t = new SignedInTracker({
    sessionCookie: async (dir) => cookie(id(dir)),
    configOauth: async (dir) => keys(id(dir)),
    log: (line) => lines.push(line),
    now: () => clock,
    sleep: async () => undefined,
    ...over,
  });
  return { t, lines, advance: (ms: number) => { clock += ms; } };
}

test('(a)(b)(d) decisions are logged; a readable database without a valid sessionKey is Not signed in, keys or not', async () => {
  const states: Record<string, CookieCheck> = {
    work: { state: 'found' }, gone: { state: 'missing' }, old: { state: 'expired' }, blank: { state: 'empty' },
  };
  const { t, lines } = tracker((i) => states[i]!, () => true);
  const accounts = [main, account('work'), account('gone'), account('old'), account('blank')];
  assert.deepEqual(await t.signedOut(accounts, []), ['gone', 'old', 'blank']);
  assert.deepEqual(lines, [
    'card check work: cookie found',
    'card check gone: cookie not found',
    'card check old: cookie expired',
    'card check blank: cookie empty',
  ]);
  await t.signedOut(accounts, []);
  assert.equal(lines.length, 4, 'an unchanged decision is not logged again');
});

test('(a) unreadable cookie database → keys fallback, with the reason in the log', async () => {
  const { t, lines } = tracker(() => unreadable('sqlite: file is not a database'), (i) => i === 'work');
  assert.deepEqual(await t.signedOut([main, account('work'), account('home')], []), ['home']);
  assert.deepEqual(lines, [
    'card check work: cookie DB unreadable (sqlite: file is not a database) -> keys fallback: keys found',
    'card check home: cookie DB unreadable (sqlite: file is not a database) -> keys fallback: no keys',
  ]);
});

test('closed profile: a busy cookie file right after "Close this account" is retried before the keys decide', async () => {
  let reads = 0;
  const { t, lines } = tracker(() => (++reads < 3 ? unreadable() : { state: 'missing' }), () => true);
  assert.deepEqual(await t.signedOut([account('work')], []), ['work']);
  assert.equal(reads, 3);
  assert.deepEqual(lines, ['card check work: cookie not found']);
});

test('(3) running accounts: re-read after ~30 s; a sign-out shows up; an unreadable copy keeps the last state', async () => {
  let check: CookieCheck = { state: 'found' };
  let reads = 0;
  const { t, lines, advance } = tracker(() => { reads++; return check; }, () => true);
  const accounts = [main, account('work')];
  assert.deepEqual(await t.signedOut(accounts, ['work']), []);
  check = { state: 'missing' };
  advance(10_000);
  assert.deepEqual(await t.signedOut(accounts, ['work']), [], 'within 30 s: last known state, file not read');
  assert.equal(reads, 1);
  advance(25_000);
  assert.deepEqual(await t.signedOut(accounts, ['work']), ['work'], 'after 30 s: read again → Running · Not signed in');
  check = unreadable();
  advance(31_000);
  assert.deepEqual(await t.signedOut(accounts, ['work']), ['work'], 'copy failed while running: state kept');
  assert.equal(reads, 3, 'no retries while running');
  assert.equal(lines.at(-1), 'card check work: cookie DB unreadable (copy failed (EBUSY)) while running -> kept: not signed in');
});

test('(3) running account, first read unreadable: keys decide; a signed-in state is never lost to a failed copy', async () => {
  let check: CookieCheck = unreadable();
  const { t, advance } = tracker(() => check, () => true);
  assert.deepEqual(await t.signedOut([account('work')], ['work']), [], 'keys found → Running only');
  check = { state: 'found' };
  advance(31_000);
  assert.deepEqual(await t.signedOut([account('work')], ['work']), []);
  check = unreadable();
  advance(31_000);
  assert.deepEqual(await t.signedOut([account('work')], ['work']), [], 'still Running only');
});

test('forget: the next check reads the profile again even while running', async () => {
  let check: CookieCheck = { state: 'found' };
  const { t } = tracker(() => check, () => false);
  assert.deepEqual(await t.signedOut([account('work')], ['work']), []);
  check = { state: 'missing' };
  t.forget('work');
  assert.deepEqual(await t.signedOut([account('work')], ['work']), ['work']);
});
