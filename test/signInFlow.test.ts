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
  deps: SignInDeps;
}

async function world(t: { after: (fn: () => Promise<void>) => void }, opts: { killWorks?: boolean; mainRunning?: boolean;
  noDefaultProfile?: boolean; isNew?: boolean; minFreeBytes?: number } = {}): Promise<World> {
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
    deps: undefined as unknown as SignInDeps,
  };
  w.deps = {
    userProfile,
    markerFile: w.markerFile,
    listDefaultPids: async () => [...w.pids],
    kill: async () => { if (opts.killWorks !== false) w.pids = []; },
    listPidsInside: async (dir) => { assert.equal(dir, w.slot); return [...w.insidePids]; },
    launchDefault: async () => { w.launches++; w.pids = [22]; },
    freeBytes: async () => 10 ** 12,
    minFreeBytes: opts.minFreeBytes ?? 0,
    sleep: async () => undefined,
    settleMs: 0,
    checkMs: 0,
    onStatus: (s) => w.statuses.push(s),
  };
  return w;
}

const last = (w: World) => w.statuses.at(-1);
const read = (file: string) => readFile(file, 'utf8');

/** What the fresh Claude does while the person signs in. */
async function signInInClaude(w: World, flow: SignInFlow, withCookie = true): Promise<void> {
  await mkdir(path.join(w.slot, 'Network'), { recursive: true });
  await writeFile(path.join(w.slot, 'Network', 'Cookies'), 'startup');
  await flow.poll(0); // startup write: ignored
  await writeFile(path.join(w.slot, 'config.json'), JSON.stringify({ 'oauth:tokenCacheV2': 'encrypted' }));
  await flow.poll(5000);
  assert.equal(last(w)?.phase, 'detected');
  if (withCookie) {
    await writeFile(path.join(w.slot, 'Network', 'Cookies'), 'startup claude.ai sessionKey new');
    await flow.poll(9000); // cookie flushed after the token → finishes by itself
  }
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

/** Fake clock for the "I've signed in" countdown; `onTick` runs on every pause (e.g. the person signs in meanwhile). */
function clockFor(w: World, onTick: (t: number) => Promise<void> | void = () => undefined): void {
  let t = 0;
  w.deps.now = () => t;
  w.deps.sleep = async (ms) => { t += ms; await onTick(t); };
  w.deps.checkMs = 15_000;
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
  await signInInClaude(w, flow, false); // token appears; the poll has not seen the cookie flush yet
  await writeFile(path.join(w.slot, 'Network', 'Cookies'), 'claude.ai sessionKey');
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
  clockFor(w, async (now) => {
    if (now === 4000) await writeFile(path.join(w.slot, 'Network', 'Cookies'), 'claude.ai sessionKey');
  });
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await blankClaude(w);
  await flow.confirm();
  assert.deepEqual(checking(w), [15, 14, 13, 12]);
  assert.deepEqual(last(w), { phase: 'done', account: w.account });
});

test('"I\'ve signed in": Cancel during the countdown cancels; no notFound afterwards', async (t) => {
  const w = await world(t);
  clockFor(w, (now) => { if (now === 2000) cancelling = flow.cancel(); });
  const flow = new SignInFlow(w.deps);
  assert.equal(await flow.start(w.slot, w.account), null);
  await blankClaude(w);
  let cancelling: Promise<void> | null = null;
  await flow.confirm();
  await cancelling;
  assert.deepEqual(last(w), { phase: 'cancelled' });
  assert.equal(w.statuses.some((s) => s.phase === 'notFound'), false);
  assert.equal(await read(path.join(w.slot, 'main.txt')), 'MAIN');
  assert.equal(existsSync(w.markerFile), false);
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
