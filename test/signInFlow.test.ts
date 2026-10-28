// Sign-in flow on real temporary folders (runs on Linux and in the windows-latest job). Processes are faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SignInStatus } from '../src/core/api.js';
import { STASH_SUFFIX, type MarkerAccount } from '../src/core/signIn.js';
import { SignInFlow, type SignInDeps } from '../src/main/signInFlow.js';

interface World {
  slot: string;
  stash: string;
  markerFile: string;
  target: string;
  account: MarkerAccount;
  pids: number[];
  /** Processes running from inside the default profile folder (e.g. Claude Code CLI). */
  insidePids: number[];
  launches: number;
  statuses: SignInStatus[];
  /** Calls in order: 'graceful:11', 'kill:22', … */
  calls: string[];
  /** Processes of other accounts (own --user-data-dir): alive, never listed as default ones. */
  otherPids: number[];
  logs: string[];
  deps: SignInDeps;
}

async function world(t: { after: (fn: () => Promise<void>) => void }, opts: { killWorks?: boolean; mainRunning?: boolean;
  noDefaultProfile?: boolean; isNew?: boolean; minFreeBytes?: number; gracefulWorks?: boolean } = {}): Promise<World> {
  const root = await mkdtemp(path.join(tmpdir(), 'launcher-signin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const userProfile = path.join(root, 'User');
  // Real layout on Claude 3.6556.2.0: %LOCALAPPDATA%\Claude-Data\claude_<id>, cookie in Network\Cookies.
  const slot = path.join(root, 'Local', 'Claude-Data', 'claude_x');
  if (!opts.noDefaultProfile) {
    await mkdir(path.join(slot, 'Network'), { recursive: true });
    await writeFile(path.join(slot, 'main.txt'), 'MAIN');
    await writeFile(path.join(slot, 'Network', 'Cookies'), 'main sessionKey');
  } else {
    await mkdir(path.dirname(slot), { recursive: true });
  }
  const target = path.join(userProfile, 'ClaudeProfiles', 'work');
  const w: World = {
    slot,
    stash: slot + STASH_SUFFIX,
    markerFile: path.join(root, 'Local', 'ClaudeLauncher', 'login-pending.json'),
    target,
    account: { id: 'work', label: 'Work', profileDir: target, isNew: opts.isNew ?? true },
    pids: opts.mainRunning === false ? [] : [11],
    insidePids: [],
    launches: 0,
    statuses: [],
    calls: [],
    otherPids: [44],
    logs: [],
    deps: undefined as unknown as SignInDeps,
  };
  w.deps = {
    userProfile,
    markerFile: w.markerFile,
    listDefaultPids: async () => [...w.pids],
    // By default Claude only hides to the tray on a close request (what it does when its window is closed).
    closeGracefully: async (pids) => {
      w.calls.push(`graceful:${pids.join(',')}`);
      if (opts.gracefulWorks) w.pids = [];
    },
    kill: async (pids) => {
      w.calls.push(`kill:${pids.join(',')}`);
      if (opts.killWorks !== false) w.pids = [];
    },
    isAlive: (pid) => w.pids.includes(pid) || w.otherPids.includes(pid),
    listPidsInside: async (dir) => { assert.equal(dir, w.slot); return [...w.insidePids]; },
    launchDefault: async () => { w.launches++; w.pids = [22]; },
    freeBytes: async () => 10 ** 12,
    minFreeBytes: opts.minFreeBytes ?? 0,
    sleep: async () => undefined,
    checkMs: 0,
    onStatus: (s) => w.statuses.push(s),
    log: (line) => w.logs.push(line),
  };
  return w;
}

const last = (w: World) => w.statuses.at(-1);
const read = (file: string) => readFile(file, 'utf8');

const cookieFile = (w: World) => path.join(w.slot, 'Network', 'Cookies');
const writeKeys = (w: World) =>
  writeFile(path.join(w.slot, 'config.json'), JSON.stringify({ locale: 'en', 'oauth:tokenCacheV2': 'encrypted' }));

/** What the fresh Claude does while the person signs in; the next detection tick sees the oauth keys. */
async function signInInClaude(w: World, flow: SignInFlow, withCookie = true): Promise<void> {
  await mkdir(path.join(w.slot, 'Network'), { recursive: true });
  await writeFile(cookieFile(w), 'startup');
  await writeFile(path.join(w.slot, 'config.json'), JSON.stringify({ locale: 'en' }));
  await flow.poll(); // blank profile: no oauth keys yet, nothing happens
  assert.equal(last(w)?.phase, 'waiting');
  if (withCookie) await writeFile(cookieFile(w), 'startup claude.ai sessionKey new');
  await writeKeys(w);
  await flow.poll(); // keys → settle → force-end the sign-in Claude → move
}

test('success: session moved to the account folder, main profile restored, main Claude reopened', async (t) => {
  const w = await world(t);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  assert.equal(w.pids.includes(11), false, 'the default Claude was closed');
  assert.equal(existsSync(w.markerFile), true);
  assert.equal(await read(path.join(w.stash, 'main.txt')), 'MAIN');
  assert.equal(existsSync(w.slot), false, 'stashed by rename');
  assert.equal(w.launches, 1, 'fresh default Claude opened');

  await signInInClaude(w, flow);
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
  assert.match(await read(path.join(w.target, 'Network', 'Cookies')), /sessionKey new/);
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(path.join(w.slot, 'config.json')), false);
  assert.equal(existsSync(w.stash), false);
  assert.equal(existsSync(w.markerFile), false);
  assert.equal(w.launches, 2, 'main Claude reopened because it was running before');
  assert.equal(flow.active, false);
});

test('success on an existing card replaces its never-signed-in folder; main not reopened if it was closed', async (t) => {
  const w = await world(t, { isNew: false, mainRunning: false });
  await mkdir(w.target, { recursive: true });
  await writeFile(path.join(w.target, 'old.txt'), 'welcome screen');
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await signInInClaude(w, flow);
  assert.equal(last(w)?.phase, 'done');
  assert.equal(existsSync(path.join(w.target, 'old.txt')), false);
  assert.equal(existsSync(path.join(w.target, 'config.json')), true);
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(w.launches, 1);
});

test('no default profile before: nothing to stash, nothing left in its place', async (t) => {
  const w = await world(t, { noDefaultProfile: true });
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await signInInClaude(w, flow);
  assert.equal(last(w)?.phase, 'done');
  assert.equal(existsSync(w.slot), false);
  assert.equal(existsSync(path.join(w.target, 'config.json')), true);
});

test('cancel: fresh profile deleted, stash renamed back, no new folder', async (t) => {
  const w = await world(t);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await mkdir(w.slot, { recursive: true });
  await writeFile(path.join(w.slot, 'fresh.txt'), 'x');
  await flow.cancel();
  assert.deepEqual(last(w), { phase: 'cancelled' });
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(path.join(w.slot, 'fresh.txt')), false);
  assert.equal(existsSync(w.stash), false);
  assert.equal(existsSync(w.markerFile), false);
  assert.equal(existsSync(w.target), false);
  assert.equal(w.launches, 2);
});

/**
 * Fake clock for the "I've signed in" countdown. Call the returned function after start() (which also waits): it
 * resets the clock to 0 and from then on `onTick` runs on every pause (e.g. the person signs in meanwhile).
 */
function clockFor(w: World, onTick: (t: number) => Promise<void> | void = () => undefined): () => void {
  let t = 0;
  let armed = false;
  w.deps.now = () => t;
  w.deps.sleep = async (ms) => { t += ms; if (armed) await onTick(t); };
  w.deps.checkMs = 15_000;
  return () => { t = 0; armed = true; };
}

/** What the blank sign-in Claude creates when it starts. */
const blankClaude = (w: World) => mkdir(path.join(w.slot, 'Network'), { recursive: true });

const checking = (w: World) => w.statuses.flatMap((s) => (s.phase === 'checking' ? [s.secondsLeft] : []));

test('"I\'ve signed in" with the session already saved: continues at once, no countdown', async (t) => {
  const w = await world(t);
  clockFor(w);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await blankClaude(w);
  await writeFile(cookieFile(w), 'claude.ai sessionKey'); // the detection tick has not run yet
  await flow.confirm();
  assert.deepEqual(checking(w), []);
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
  assert.match(await read(path.join(w.target, 'Network', 'Cookies')), /sessionKey/);
});

test('"I\'ve signed in" without a sign-in: countdown, then notFound; read-only, nothing moved', async (t) => {
  const w = await world(t);
  clockFor(w);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await blankClaude(w);
  await writeFile(path.join(w.slot, 'fresh.txt'), 'blank Claude');
  await flow.confirm();
  assert.deepEqual(checking(w), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(last(w), { phase: 'notFound' });
  assert.equal(flow.active, true, 'the sign-in stays open');
  assert.equal(await read(path.join(w.slot, 'fresh.txt')), 'blank Claude', 'the sign-in Claude profile is untouched');
  assert.equal(await read(path.join(w.stash, 'main.txt')), 'MAIN', 'the main profile is still set aside');
  assert.equal(existsSync(w.markerFile), true);
  assert.equal(existsSync(w.target), false);
  assert.deepEqual(w.pids, [22], 'the sign-in Claude was not closed');
  assert.equal(w.launches, 1);

  // Pressing it again after signing in works.
  await writeFile(path.join(w.slot, 'Network', 'Cookies'), 'claude.ai sessionKey');
  await flow.confirm();
  assert.equal(last(w)?.phase, 'done');
});

test('"I\'ve signed in": the session saved during the countdown finishes the sign-in', async (t) => {
  const w = await world(t);
  const startClock = clockFor(w, async (now) => {
    if (now === 4000) await writeFile(path.join(w.slot, 'Network', 'Cookies'), 'claude.ai sessionKey');
  });
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  startClock();
  await blankClaude(w);
  await flow.confirm();
  assert.deepEqual(checking(w), [15, 14, 13, 12]);
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
});

test('"I\'ve signed in": Cancel during the countdown cancels; no notFound afterwards', async (t) => {
  const w = await world(t);
  const startClock = clockFor(w, (now) => { if (now === 2000) cancelling = flow.cancel(); });
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  startClock();
  await blankClaude(w);
  let cancelling: Promise<void> | null = null;
  await flow.confirm();
  await cancelling;
  assert.deepEqual(last(w), { phase: 'cancelled' });
  assert.equal(w.statuses.some((s) => s.phase === 'notFound'), false);
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(w.markerFile), false);
});

test('Cancel while the sign-in is finishing is ignored: the main profile is never moved to the account', async (t) => {
  const w = await world(t);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  // The finish pauses in its force-end of the sign-in Claude.
  let release: () => void = () => undefined;
  w.deps.kill = () => new Promise<void>((r) => { release = () => { w.pids = []; r(); }; });
  await blankClaude(w);
  await writeKeys(w);
  const finishing = flow.poll();
  for (let i = 0; i < 200 && last(w)?.phase !== 'saving'; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(last(w)?.phase, 'saving');
  await flow.cancel(); // e.g. a stale "checking" status re-enabled the Cancel button
  release();
  await finishing;
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN', 'the main profile is back in place');
  assert.equal(existsSync(path.join(w.target, 'main.txt')), false, 'the main profile was not moved to the account');
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
  assert.equal(w.statuses.some((s) => s.phase === 'cancelled'), false);
});

test('"I\'ve signed in" never shows the countdown again once the sign-in is finishing', async (t) => {
  const w = await world(t);
  clockFor(w);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await blankClaude(w);
  // The automatic detection fires while "I've signed in" is reading: a large cookie file (no sessionKey) keeps that
  // read slow, while the detection tick only reads the small config.json.
  await writeFile(cookieFile(w), Buffer.alloc(32 * 1024 ** 2, 'x'));
  const confirming = flow.confirm();
  await writeKeys(w);
  const polling = flow.poll(); // runs while confirm awaits its reads
  await Promise.all([confirming, polling]);
  const saving = w.statuses.findIndex((s) => s.phase === 'saving');
  assert.notEqual(saving, -1);
  assert.equal(w.statuses.slice(saving).some((s) => s.phase === 'checking'), false, 'no countdown after saving');
});

test('abort: a default Claude that does not close → nothing is touched', async (t) => {
  const w = await world(t, { killWorks: false });
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), 'defaultRunning');
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(w.stash), false);
  assert.equal(existsSync(w.markerFile), false);
  assert.equal(w.launches, 0);
});

test('abort: a program running from inside the profile folder (Claude Code CLI) → nothing moved', async (t) => {
  const w = await world(t);
  w.insidePids = [33];
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), 'profileInUse');
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(w.stash), false);
  assert.equal(existsSync(w.markerFile), false);
  assert.equal(w.launches, 1, 'the main Claude it closed is opened again');
});

test('abort: not enough disk space → main Claude is not even closed', async (t) => {
  const w = await world(t, { minFreeBytes: 10 ** 15 });
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), 'disk');
  assert.deepEqual(w.pids, [11]);
  assert.equal(existsSync(w.markerFile), false);
});

test('abort: an existing stash is never overwritten', async (t) => {
  const w = await world(t);
  await mkdir(w.stash);
  await writeFile(path.join(w.stash, 'older-main.txt'), 'OLD');
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), 'pending');
  assert.equal(await read(path.join(w.stash, 'older-main.txt')), 'OLD');
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.deepEqual(w.pids, [11]);
});

test('crash while signing in: marker found on startup → restore puts the main profile back', async (t) => {
  const w = await world(t);
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), null);
  await mkdir(w.slot, { recursive: true });
  await writeFile(path.join(w.slot, 'fresh.txt'), 'x');
  // The launcher "crashed": a new instance starts and finds the marker before anything else.
  const flow = new SignInFlow(w.deps);
  const marker = await flow.pending();
  assert.equal(marker?.state, 'signing-in');
  assert.equal(marker?.account.id, 'work');
  await flow.recover(marker!, 'restore');
  assert.deepEqual(last(w), { phase: 'cancelled' });
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(path.join(w.slot, 'fresh.txt')), false);
  assert.equal(existsSync(w.stash), false);
  assert.equal(existsSync(w.markerFile), false);
  assert.equal(await flow.pending(), null);
});

test('crash while signing in: "continue sign-in" resumes detection and finishes', async (t) => {
  const w = await world(t);
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), null);
  w.pids = []; // the fresh Claude died with the launcher
  const flow = new SignInFlow(w.deps);
  await flow.recover((await flow.pending())!, 'continue');
  assert.equal(w.launches, 2, 'fresh Claude opened again');
  assert.equal(last(w)?.phase, 'waiting');
  await signInInClaude(w, flow);
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
});

test('crash after the session moved: startup finishes the restore and reports the account', async (t) => {
  const w = await world(t);
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), null);
  await mkdir(path.join(w.slot, 'Network'), { recursive: true });
  await writeFile(path.join(w.slot, 'Network', 'Cookies'), 'sessionKey');
  await mkdir(path.dirname(w.target), { recursive: true });
  await rename(w.slot, w.target);
  const m = JSON.parse(await read(w.markerFile));
  await writeFile(w.markerFile, JSON.stringify({ ...m, state: 'adopted' }));

  const flow = new SignInFlow(w.deps);
  await flow.recover((await flow.pending())!, 'restore');
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(path.join(w.target, 'Network', 'Cookies')), true);
  assert.equal(existsSync(w.markerFile), false);
});

test('crash right after writing the marker, before the stash: the main profile is left alone', async (t) => {
  const w = await world(t);
  await mkdir(path.dirname(w.markerFile), { recursive: true });
  await writeFile(w.markerFile, JSON.stringify({
    version: 1, state: 'signing-in', slot: w.slot, stash: w.stash, stashed: true, mainWasRunning: false,
    account: w.account, startedAt: 1,
  }));
  const flow = new SignInFlow(w.deps);
  await flow.recover((await flow.pending())!, 'restore');
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN', 'never deleted: it is the original');
  assert.equal(existsSync(w.markerFile), false);
});

test('target outside ClaudeProfiles is refused before anything happens', async (t) => {
  const w = await world(t);
  const bad = { ...w.account, profileDir: path.join(path.dirname(w.deps.userProfile), 'Documents') };
  await assert.rejects(new SignInFlow(w.deps).start(w.slot, bad));
  assert.deepEqual(w.pids, [11]);
  assert.equal(existsSync(w.markerFile), false);
});

test('process query fails while cancelling: marker and stash are kept, the exact stash path is reported', async (t) => {
  const w = await world(t);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  w.deps.listDefaultPids = async () => { throw new Error('powershell timeout'); };
  await flow.cancel();
  assert.deepEqual(last(w), { phase: 'failed', stashPath: w.stash });
  assert.equal(await read(path.join(w.stash, 'main.txt')), 'MAIN');
  assert.equal(existsSync(w.markerFile), true, 'the next start offers the restore');
  assert.equal(flow.active, false);
});

// ---------- 0.4.3 (a): live steps and the graceful close of the main Claude ----------

const phases = (w: World) => w.statuses.map((s) => (s.phase === 'starting' ? `starting:${s.step}` : s.phase));

test('start: steps in order (closing → preparing → opening), then waiting', async (t) => {
  const w = await world(t);
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), null);
  assert.deepEqual(phases(w), ['starting:closing', 'starting:preparing', 'starting:opening', 'waiting']);
});

test('start: a main Claude that exits on the close request is never force-ended', async (t) => {
  const w = await world(t, { gracefulWorks: true });
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), null);
  assert.deepEqual(w.calls, ['graceful:11']);
});

test('start: still running ~1 s after the close request → force-ends only the default-profile processes', async (t) => {
  const w = await world(t);
  const sleeps: number[] = [];
  w.deps.sleep = async (ms) => { sleeps.push(ms); };
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), null);
  assert.deepEqual(w.calls, ['graceful:11', 'kill:11'], 'the extra account (pid 44) is never touched');
  assert.equal(sleeps.filter((ms) => ms === 250).length, 4, 'exit polled every 250 ms for 1 s');
  assert.equal(w.otherPids.includes(44), true);
});

test('start: Claude opened again while closing → stops at once with reopened; nothing stashed, the new one kept', async (t) => {
  const w = await world(t);
  const sleeps: number[] = [];
  w.deps.sleep = async (ms) => { sleeps.push(ms); };
  // The force-end works, but the person reopens Claude right away: a new default-profile process (99).
  w.deps.kill = async (pids) => { w.calls.push(`kill:${pids.join(',')}`); w.pids = [99]; };
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), 'reopened');
  assert.deepEqual(w.calls, ['graceful:11', 'kill:11'], 'the reopened Claude (99) is never ended');
  assert.deepEqual(w.pids, [99]);
  assert.equal(sleeps.filter((ms) => ms === 500).length, 0, 'no waiting once it is seen');
  assert.deepEqual(phases(w), ['starting:closing']);
  assert.equal(existsSync(w.stash), false);
  assert.equal(existsSync(w.markerFile), false);
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(w.launches, 0);
});

test('start: Claude opened again during the close request → reopened, nothing force-ended', async (t) => {
  const w = await world(t);
  w.deps.closeGracefully = async (pids) => { w.calls.push(`graceful:${pids.join(',')}`); w.pids = [99]; };
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), 'reopened');
  assert.deepEqual(w.calls, ['graceful:11']);
  assert.equal(existsSync(w.stash), false);
});

test('start: failed close → stops within ~10 s, no steps after "closing", nothing moved', async (t) => {
  const w = await world(t, { killWorks: false });
  let waited = 0;
  w.deps.sleep = async (ms) => { waited += ms; };
  assert.equal(await new SignInFlow(w.deps).start(w.slot, w.account), 'defaultRunning');
  assert.ok(waited <= 10_000, `waited ${waited} ms`);
  assert.deepEqual(phases(w), ['starting:closing']);
  assert.equal(existsSync(w.stash), false);
});

test('timings are logged per step, without config values', async (t) => {
  const w = await world(t, { gracefulWorks: true });
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await signInInClaude(w, flow);
  for (const step of ['start: close main Claude: graceful', 'start: prepare a clean profile', 'start: open the sign-in window',
    'start: total', 'finish: close the sign-in Claude: forced', 'finish: total']) {
    assert.ok(w.logs.some((l) => l.startsWith(step)), `missing "${step}"`);
  }
  assert.equal(w.logs.some((l) => /encrypted|sessionKey new/.test(l)), false);
});

// ---------- 0.4.3 (b): oauth keys in config.json as the fast signal ----------

// ---------- 0.4.4: wait until the profile folder is quiet before the force-end ----------

/** After the keys: Claude keeps writing for `busyPolls` polls of 500 ms (Infinity = never stops), then goes quiet. */
async function finishWithWrites(t: Parameters<typeof world>[0], busyPolls: number) {
  const w = await world(t);
  let sleeps: number[] = [];
  let writing = false;
  let n = 0;
  w.deps.sleep = async (ms) => {
    sleeps.push(ms);
    if (writing && ms === 500 && n < busyPolls) {
      n++;
      await mkdir(path.join(w.slot, 'Local Storage', 'leveldb'), { recursive: true });
      await writeFile(path.join(w.slot, 'Local Storage', 'leveldb', '000003.log'), 'secret-token-value'.repeat(n));
    }
  };
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  w.calls = [];
  sleeps = [];
  await blankClaude(w);
  await writeKeys(w); // the sessionKey cookie is not on disk (Claude writes it lazily)
  writing = true;
  await flow.poll();
  return { w, polls: sleeps.filter((ms) => ms === 500).length };
}

test('finish: waits until no file changed for ~5 s (10 polls of 500 ms), then force-ends', async (t) => {
  const { w, polls } = await finishWithWrites(t, 3);
  assert.equal(polls, 3 + 10, '3 busy polls, then 10 quiet ones');
  assert.deepEqual(w.calls, ['kill:22'], 'force-end only after the quiet wait, no close request');
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
  assert.match(await read(path.join(w.target, 'Local Storage', 'leveldb', '000003.log')), /secret/);
  assert.ok(w.logs.some((l) => /^finish: wait for a quiet profile: quiet: \d+ ms$/.test(l)), w.logs.join('\n'));
});

test('finish: the files changed after the keys are logged by relative path, never their contents', async (t) => {
  const { w } = await finishWithWrites(t, 3);
  const line = w.logs.find((l) => l.startsWith('finish: changed after the keys:'));
  assert.ok(line, w.logs.join('\n'));
  assert.match(line, /Local Storage[\\/]leveldb[\\/]000003\.log/);
  assert.doesNotMatch(line, /config\.json/, 'written before the keys were seen: not a change after them');
  assert.equal(w.logs.some((l) => /secret|encrypted/.test(l)), false);
});

test('finish: never quiet within ~40 s → still moved, but unsure (no cookiePending, "may not have been saved")', async (t) => {
  const { w, polls } = await finishWithWrites(t, Infinity);
  assert.equal(polls, 80, 'capped at 40 s');
  assert.deepEqual(w.calls, ['kill:22']);
  assert.deepEqual(last(w), { phase: 'done', account: w.account, unsure: true });
  assert.equal(existsSync(path.join(w.target, 'config.json')), true);
  assert.ok(w.logs.some((l) => l.startsWith('finish: wait for a quiet profile: still changing at the cap')));
});

test('keys never present → the detection never closes or moves anything', async (t) => {
  const w = await world(t);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  w.calls = [];
  await blankClaude(w);
  await writeFile(path.join(w.slot, 'config.json'), JSON.stringify({ locale: 'en' }));
  for (let i = 0; i < 10; i++) await flow.poll();
  assert.deepEqual(w.calls, []);
  assert.equal(last(w)?.phase, 'waiting');
  assert.equal(flow.active, true);
  assert.equal(existsSync(w.target), false);
  assert.equal(await read(path.join(w.stash, 'main.txt')), 'MAIN');
});

test('keys present but the sessionKey cookie never written → still moved; the card check decides', async (t) => {
  const w = await world(t);
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await signInInClaude(w, flow, false);
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
  assert.equal(existsSync(path.join(w.target, 'config.json')), true);
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(w.markerFile), false);
});
