// Close this account (e), Remove on a running account (f), Add account closes only the default instance (d).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ClaudeProcess } from '../src/core/processes.js';
import { closeProfile, removeProfile, type AccountProcessDeps } from '../src/main/accountActions.js';

const WORK = 'C:\\Users\\u\\ClaudeProfiles\\work';
const HOME = 'C:\\Users\\u\\ClaudeProfiles\\home';

function system(processes: ClaudeProcess[], opts: { killWorks?: boolean } = {}) {
  const s = {
    processes: [...processes],
    killed: [] as number[],
    deleted: [] as string[],
    deps: undefined as unknown as AccountProcessDeps & { deleteDir(dir: string): Promise<void> },
  };
  s.deps = {
    listProcesses: async () => [...s.processes],
    kill: async (pids) => {
      s.killed.push(...pids);
      if (opts.killWorks !== false) s.processes = s.processes.filter((p) => !pids.includes(p.pid));
    },
    deleteDir: async (dir) => { s.deleted.push(dir); },
    sleep: async () => undefined,
    closeTimeoutMs: 1000,
  };
  return s;
}

const all = (): ClaudeProcess[] => [
  { pid: 1, profileDir: null },
  { pid: 2, profileDir: WORK },
  { pid: 3, profileDir: 'c:/users/U/claudeprofiles/HOME/' },
];

test('closing an extra account ends only its processes', async () => {
  const s = system(all());
  assert.equal(await closeProfile(s.deps, WORK), true);
  assert.deepEqual(s.killed, [2]);
  assert.deepEqual(s.processes.map((p) => p.pid), [1, 3]);
});

test('closing Main (and Add account) ends only the default instance; extra accounts stay open', async () => {
  const s = system(all());
  assert.equal(await closeProfile(s.deps, null), true);
  assert.deepEqual(s.killed, [1]);
  assert.deepEqual(s.processes.map((p) => p.pid), [2, 3]);
});

test('close: nothing running → nothing killed; a process that survives → false', async () => {
  const idle = system([{ pid: 2, profileDir: WORK }]);
  assert.equal(await closeProfile(idle.deps, HOME), true);
  assert.deepEqual(idle.killed, []);
  const stuck = system(all(), { killWorks: false });
  assert.equal(await closeProfile(stuck.deps, HOME), false);
  assert.deepEqual(stuck.killed, [3], 'killed once, then only waited');
});

test('remove: a running account is refused without "Close and remove"', async () => {
  const s = system(all());
  assert.equal(await removeProfile(s.deps, WORK, false), 'running');
  assert.deepEqual(s.killed, []);
  assert.deepEqual(s.deleted, []);
});

test('remove with "Close and remove": closes only that account, then deletes its folder', async () => {
  const s = system(all());
  assert.equal(await removeProfile(s.deps, WORK, true), null);
  assert.deepEqual(s.killed, [2]);
  assert.deepEqual(s.deleted, [WORK]);
  assert.deepEqual(s.processes.map((p) => p.pid), [1, 3]);
});

test('remove: closing fails → folder kept; delete fails → folder error; not running → just deleted', async () => {
  const stuck = system(all(), { killWorks: false });
  assert.equal(await removeProfile(stuck.deps, WORK, true), 'closeFailed');
  assert.deepEqual(stuck.deleted, []);
  const locked = system([]);
  locked.deps.deleteDir = async () => { throw new Error('EBUSY'); };
  assert.equal(await removeProfile(locked.deps, WORK, false), 'folder');
  const idle = system([{ pid: 1, profileDir: null }]);
  assert.equal(await removeProfile(idle.deps, WORK, false), null);
  assert.deepEqual(idle.deleted, [WORK]);
});
