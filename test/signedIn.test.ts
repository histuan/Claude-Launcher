// Card "Not signed in" decision (0.4.5, after the PC test): the cookie database alone decides, never the
// oauth:tokenCache keys. It is locked while Claude runs, so running accounts are not read; when an account stops
// running it is read again every ~1 s for up to ~10 s ("Checking…" meanwhile), then the card updates.
// Since 0.5.0 the cards never wait for a read: they show the last known state (saved in the config) at once and the
// checks run in the background, telling the window to redraw when something changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Account } from '../src/core/config.js';
import { SignedInTracker, type SignedInDeps } from '../src/main/signedIn.js';
import type { CookieCheck } from '../src/main/system/cookies.js';

const account = (id: string, signedIn: boolean | null = null): Account => ({
  id, label: id, email: null, realName: null, photo: null, profileDir: `C:\\Users\\u\\ClaudeProfiles\\${id}`, signedIn,
});
const main: Account = { ...account('main'), label: null, profileDir: null };
const busy: CookieCheck = { state: 'unreadable', reason: 'copy failed (EBUSY)' };

/** A tracker whose sleeps resolve only when the test calls tick(), so "Checking…" can be observed. */
function setup(read: (id: string) => CookieCheck | Promise<CookieCheck>, over: Partial<SignedInDeps> = {}) {
  const lines: string[] = [];
  const reads: string[] = [];
  const saved: string[] = [];
  let changes = 0;
  const sleeps: (() => void)[] = [];
  const t = new SignedInTracker({
    sessionCookie: async (dir) => { const id = path.win32.basename(dir); reads.push(id); return read(id); },
    log: (line) => lines.push(line),
    onChange: () => { changes++; },
    save: (id, signedIn) => saved.push(`${id}=${signedIn}`),
    sleep: () => new Promise<void>((r) => sleeps.push(r)),
    ...over,
  });
  /** Lets pending reads finish and one pending retry run. */
  const flush = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  const tick = async (): Promise<void> => {
    await flush();
    sleeps.shift()?.();
    await flush();
  };
  /** check() and wait until every read it started is final. */
  const checkAll = async (accounts: Account[], running: string[]): Promise<void> => {
    t.check(accounts, running);
    await Promise.all(accounts.map((a) => t.settled(a.id)));
  };
  return { t, lines, reads, saved, tick, flush, checkAll, changes: () => changes, done: (id: string) => t.settled(id) };
}

test('startup: the last known state shows at once, before any read finishes', async () => {
  let release!: () => void;
  const slow = new Promise<CookieCheck>((r) => { release = () => r({ state: 'found' }); });
  const { t, done, saved, changes } = setup(() => slow);
  const accounts = [main, account('work', false), account('new')];
  t.seed(accounts);
  assert.deepEqual(t.cards(accounts, []), { signedOut: ['work'], checking: [] }, 'from the config, no read needed');
  t.check(accounts, []); // background: not awaited by the cards
  assert.deepEqual(t.cards(accounts, []), { signedOut: ['work'], checking: [] });
  release();
  await done('work');
  await done('new');
  assert.deepEqual(t.cards(accounts, []), { signedOut: [], checking: [] });
  assert.deepEqual(saved.sort(), ['new=true', 'work=true'], 'each new state is saved to the config');
  assert.equal(changes(), 1, 'one redraw: only work changed what the cards show');
});

test('closed accounts: readable at once → decided, no "Checking…", one log line each, read once', async () => {
  const states: Record<string, CookieCheck> = {
    work: { state: 'found' }, gone: { state: 'missing' }, old: { state: 'expired' }, blank: { state: 'empty' },
  };
  const { t, lines, checkAll, saved } = setup((id) => states[id]!);
  const accounts = [main, account('work'), account('gone'), account('old'), account('blank')];
  await checkAll(accounts, []);
  assert.deepEqual(t.cards(accounts, []), { signedOut: ['gone', 'old', 'blank'], checking: [] });
  assert.deepEqual(lines, [
    'card check work: cookie found',
    'card check gone: cookie not found',
    'card check old: cookie expired',
    'card check blank: cookie empty',
  ]);
  await checkAll(accounts, []);
  assert.equal(lines.length, 4, 'a settled account is not read again');
  assert.equal(saved.length, 4);
});

test('same state as the config: nothing saved, no redraw', async () => {
  const { t, checkAll, saved, changes } = setup(() => ({ state: 'missing' }));
  const accounts = [account('work', false)];
  t.seed(accounts);
  await checkAll(accounts, []);
  assert.deepEqual(saved, []);
  assert.equal(changes(), 0);
});

test('(a) unreadable never decides from the keys: last known state kept, "Checking…" shown', async () => {
  let check: CookieCheck = { state: 'missing' };
  const { t, tick, done, flush, checkAll } = setup(() => check);
  const accounts = [account('work')];
  await checkAll(accounts, []);
  t.check(accounts, ['work']); // opened
  check = busy;
  t.check(accounts, []);
  await flush();
  assert.deepEqual(t.cards(accounts, []), { signedOut: ['work'], checking: ['work'] }, 'kept: not signed in');
  check = { state: 'found' };
  await tick();
  await done('work');
  assert.deepEqual(t.cards(accounts, []), { signedOut: [], checking: [] });
});

test('(a) no known state and unreadable → no "Not signed in" label, only "Checking…"', async () => {
  const { t, flush } = setup(() => busy);
  t.check([account('work')], []);
  await flush();
  assert.deepEqual(t.cards([account('work')], []), { signedOut: [], checking: ['work'] });
});

test('(b) after "Close this account": retried every ~1 s until readable, then the card updates (PC log case)', async () => {
  let check: CookieCheck = { state: 'found' };
  const { t, lines, reads, tick, flush, changes, done, checkAll } = setup(() => check);
  const accounts = [account('work')];
  await checkAll(accounts, []);
  const before = changes();
  // Running: never read (the database is locked while Claude runs); sign-out inside Claude happens here.
  reads.length = 0;
  t.check(accounts, ['work']);
  assert.deepEqual(t.cards(accounts, ['work']), { signedOut: [], checking: [] });
  assert.deepEqual(reads, [], 'a running account is not read');
  check = busy;
  // Closed: still locked for a few seconds.
  t.check(accounts, []);
  await flush();
  assert.deepEqual(t.cards(accounts, []), { signedOut: [], checking: ['work'] });
  assert.equal(changes(), before + 1, 'the window is told when "Checking…" starts');
  await tick();
  await tick();
  t.check(accounts, []);
  assert.deepEqual(t.cards(accounts, []), { signedOut: [], checking: ['work'] }, 'no second retry loop');
  check = { state: 'missing' };
  await tick();
  await done('work');
  assert.equal(reads.length, 4, 'first read + 3 retries');
  assert.equal(changes(), before + 2, 'and once more when the decision is final');
  assert.deepEqual(t.cards(accounts, []), { signedOut: ['work'], checking: [] });
  assert.deepEqual(lines, ['card check work: cookie found', 'card check work: cookie not found']);
});

test('(b) still locked after ~10 s: gives up, keeps the last state, logs it', async () => {
  const { t, lines, reads, tick, changes, done } = setup(() => busy, { retryMs: 1000, retryForMs: 10_000 });
  t.check([account('work')], []);
  for (let i = 0; i < 10; i++) await tick();
  await done('work');
  assert.equal(reads.length, 11, 'first read + 10 retries (~1 s apart, ~10 s)');
  assert.deepEqual(t.cards([account('work')], []), { signedOut: [], checking: [] });
  assert.deepEqual(lines, ['card check work: cookie DB unreadable (copy failed (EBUSY)) for ~10 s -> kept: unknown']);
  assert.equal(changes(), 2, '"Checking…" on, then off');
});

test('forget: the next check reads the profile again', async () => {
  let check: CookieCheck = { state: 'found' };
  const { t, checkAll } = setup(() => check);
  await checkAll([account('work')], []);
  assert.deepEqual(t.cards([account('work')], []).signedOut, []);
  check = { state: 'missing' };
  t.forget('work');
  await checkAll([account('work')], []);
  assert.deepEqual(t.cards([account('work')], []).signedOut, ['work']);
});
