// Card "Not signed in" decision (0.4.5, after the PC test): the cookie database alone decides, never the
// oauth:tokenCache keys. It is locked while Claude runs, so running accounts are not read; when an account stops
// running it is read again every ~1 s for up to ~10 s ("Checking…" meanwhile), then the card updates.
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
const busy: CookieCheck = { state: 'unreadable', reason: 'copy failed (EBUSY)' };

/** A tracker whose sleeps resolve only when the test calls tick(), so "Checking…" can be observed. */
function setup(read: (id: string) => CookieCheck, over: Partial<SignedInDeps> = {}) {
  const lines: string[] = [];
  const reads: string[] = [];
  let changes = 0;
  const sleeps: (() => void)[] = [];
  const t = new SignedInTracker({
    sessionCookie: async (dir) => { const id = path.win32.basename(dir); reads.push(id); return read(id); },
    log: (line) => lines.push(line),
    onChange: () => { changes++; },
    sleep: () => new Promise<void>((r) => sleeps.push(r)),
    ...over,
  });
  /** Lets one pending retry run (and the reads it does). */
  const tick = async (): Promise<void> => {
    for (let i = 0; i < 20 && sleeps.length === 0; i++) await new Promise((r) => setImmediate(r));
    sleeps.shift()?.();
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  };
  return { t, lines, reads, tick, changes: () => changes, done: (id: string) => t.settled(id) };
}

test('closed accounts: readable at once → decided at once, no "Checking…", one log line each', async () => {
  const states: Record<string, CookieCheck> = {
    work: { state: 'found' }, gone: { state: 'missing' }, old: { state: 'expired' }, blank: { state: 'empty' },
  };
  const { t, lines, changes } = setup((id) => states[id]!);
  const accounts = [main, account('work'), account('gone'), account('old'), account('blank')];
  assert.deepEqual(await t.cards(accounts, []), { signedOut: ['gone', 'old', 'blank'], checking: [] });
  assert.deepEqual(lines, [
    'card check work: cookie found',
    'card check gone: cookie not found',
    'card check old: cookie expired',
    'card check blank: cookie empty',
  ]);
  await t.cards(accounts, []);
  assert.equal(lines.length, 4, 'a settled account is not read again');
  assert.equal(changes(), 0);
});

test('(a) unreadable never decides from the keys: last known state kept, "Checking…" shown', async () => {
  let check: CookieCheck = { state: 'missing' };
  const { t, tick, done } = setup(() => check);
  const accounts = [account('work')];
  assert.deepEqual(await t.cards(accounts, []), { signedOut: ['work'], checking: [] });
  await t.cards(accounts, ['work']); // opened
  check = busy;
  assert.deepEqual(await t.cards(accounts, []), { signedOut: ['work'], checking: ['work'] }, 'kept: not signed in');
  check = { state: 'found' };
  await tick();
  await done('work');
  assert.deepEqual(await t.cards(accounts, []), { signedOut: [], checking: [] });
});

test('(a) no known state and unreadable → no "Not signed in" label, only "Checking…"', async () => {
  const { t } = setup(() => busy);
  assert.deepEqual(await t.cards([account('work')], []), { signedOut: [], checking: ['work'] });
});

test('(b) after "Close this account": retried every ~1 s until readable, then the card updates (PC log case)', async () => {
  let check: CookieCheck = { state: 'found' };
  const { t, lines, reads, tick, changes, done } = setup(() => check);
  const accounts = [account('work')];
  assert.deepEqual(await t.cards(accounts, []), { signedOut: [], checking: [] });
  // Running: never read (the database is locked while Claude runs); sign-out inside Claude happens here.
  reads.length = 0;
  assert.deepEqual(await t.cards(accounts, ['work']), { signedOut: [], checking: [] });
  assert.deepEqual(reads, [], 'a running account is not read');
  check = busy;
  // Closed: still locked for a few seconds.
  assert.deepEqual(await t.cards(accounts, []), { signedOut: [], checking: ['work'] });
  await tick();
  await tick();
  assert.deepEqual(await t.cards(accounts, []), { signedOut: [], checking: ['work'] }, 'no second retry loop');
  check = { state: 'missing' };
  await tick();
  await done('work');
  assert.equal(reads.length, 4, 'first read + 3 retries');
  assert.equal(changes(), 1, 'the window is told once, when the decision is final');
  assert.deepEqual(await t.cards(accounts, []), { signedOut: ['work'], checking: [] });
  assert.deepEqual(lines, ['card check work: cookie found', 'card check work: cookie not found']);
});

test('(b) still locked after ~10 s: gives up, keeps the last state, logs it', async () => {
  const { t, lines, reads, tick, changes, done } = setup(() => busy, { retryMs: 1000, retryForMs: 10_000 });
  assert.deepEqual(await t.cards([account('work')], []), { signedOut: [], checking: ['work'] });
  for (let i = 0; i < 10; i++) await tick();
  await done('work');
  assert.equal(reads.length, 11, 'first read + 10 retries (~1 s apart, ~10 s)');
  assert.deepEqual(await t.cards([account('work')], []), { signedOut: [], checking: [] });
  assert.deepEqual(lines, ['card check work: cookie DB unreadable (copy failed (EBUSY)) for ~10 s -> kept: unknown']);
  assert.equal(changes(), 1);
});

test('forget: the next check reads the profile again', async () => {
  let check: CookieCheck = { state: 'found' };
  const { t } = setup(() => check);
  assert.deepEqual((await t.cards([account('work')], [])).signedOut, []);
  check = { state: 'missing' };
  t.forget('work');
  assert.deepEqual((await t.cards([account('work')], [])).signedOut, ['work']);
});
