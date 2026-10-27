import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RawProcess } from '../src/core/processes.js';
import {
  describeProfileLookup, killProcesses, markerFileFor, resolveDefaultProfile, type ProfileLookupDeps,
} from '../src/main/system/claudeProfile.js';

const LOCAL = 'C:\\Users\\u\\AppData\\Local';
const DATA = `${LOCAL}\\Claude-Data`;
const REAL = `${DATA}\\claude_abc123`;
const MSIX = `${LOCAL}\\Packages\\Claude_abc123\\LocalCache\\Roaming\\Claude`;
const APP = 'C:\\Program Files\\WindowsApps\\Claude_3.6556.2.0_x64__abc123\\app\\Claude.exe';

/** files: paths that exist; dirs: folder listings. */
function deps(opts: { files?: string[]; claudeDataNames?: string[]; processes?: RawProcess[]; family?: string | null;
  processError?: boolean }): ProfileLookupDeps {
  return {
    run: async (script) => {
      assert.match(script, /PackageFamilyName/);
      return opts.family === null ? '[]' : JSON.stringify([{ Name: 'Claude', PackageFamilyName: opts.family ?? 'Claude_abc123' }]);
    },
    env: { LOCALAPPDATA: LOCAL },
    listClaudeProcesses: async () => {
      if (opts.processError) throw new Error('timeout');
      return opts.processes ?? [];
    },
    exists: (file) => (opts.files ?? []).includes(file),
    listDir: (dir) => {
      if (dir !== DATA || !opts.claudeDataNames) throw new Error('ENOENT');
      return opts.claudeDataNames;
    },
  };
}

const running = (dir: string): RawProcess[] => [
  { pid: 1, parentPid: 0, exe: APP, args: [APP] },
  { pid: 2, parentPid: 1, exe: APP, args: [APP, '--type=gpu-process', `--user-data-dir=${dir}`] },
];

test('1st: the --user-data-dir of the running default Claude', async () => {
  const other = `${DATA}\\claude_runningone`;
  const r = await resolveDefaultProfile(deps({ processes: running(other), files: [`${other}\\Network\\Cookies`, `${REAL}\\Network\\Cookies`] }));
  assert.equal(r.slot, other);
  assert.deepEqual(r.checked.map((c) => c.source), ['process']);
});

test('2nd: Claude-Data\\<PackageFamilyName lowercased> (Claude not running)', async () => {
  const r = await resolveDefaultProfile(deps({ family: 'Claude_ABC123', files: [`${REAL}\\Network\\Cookies`] }));
  assert.equal(r.slot, REAL);
});

test('3rd: any Claude-Data\\claude_* with Network\\Cookies (stash folders ignored)', async () => {
  const found = `${DATA}\\claude_zzz`;
  const r = await resolveDefaultProfile(deps({
    claudeDataNames: ['claude_abc123.launcher-stash', 'claude_empty', 'claude_zzz', 'other'],
    files: [`${DATA}\\claude_abc123.launcher-stash\\Network\\Cookies`, `${found}\\Network\\Cookies`],
  }));
  assert.equal(r.slot, found);
  assert.deepEqual(r.checked.map((c) => c.path), [REAL, `${DATA}\\claude_empty`, found]);
});

test('4th: the old MSIX LocalCache path only if it holds cookies', async () => {
  assert.equal((await resolveDefaultProfile(deps({ files: [`${MSIX}\\Cookies`] }))).slot, MSIX);
  assert.equal((await resolveDefaultProfile(deps({ files: [`${MSIX}\\Network\\Cookies`] }))).slot, MSIX);
});

test('fail safe: no candidate with cookies → no profile; every checked path is reported', async () => {
  // Thiago's PC case for the old code: the MSIX LocalCache folder exists but is empty.
  const r = await resolveDefaultProfile(deps({ processes: running(REAL), processError: false, claudeDataNames: ['claude_abc123'] }));
  assert.equal(r.slot, null);
  assert.deepEqual(r.checked, [
    { source: 'process', path: REAL, hasCookies: false },
    { source: 'msix', path: MSIX, hasCookies: false },
  ]);
  const log = describeProfileLookup(r, new Date(0));
  assert.match(log, /\[process\] .*claude_abc123 {2}cookies: no/);
  assert.match(log, /Result: none \(sign-in disabled\)/);
});

test('fail safe: PowerShell errors are logged and never guessed around', async () => {
  const r = await resolveDefaultProfile({ ...deps({ processError: true }), run: async () => { throw new Error('no ps'); } });
  assert.equal(r.slot, null);
  assert.deepEqual(r.errors, ['process query: timeout', 'Get-AppxPackage: no ps']);
  assert.equal((await resolveDefaultProfile({ ...deps({}), env: {} })).slot, null);
});

test('marker path and kill arguments', async () => {
  assert.equal(markerFileFor({ LOCALAPPDATA: LOCAL }), `${LOCAL}\\ClaudeLauncher\\login-pending.json`);
  const calls: string[][] = [];
  await killProcesses([10, 20], async (file, args) => { calls.push([file, ...args]); });
  assert.deepEqual(calls, [['taskkill', '/PID', '10', '/T', '/F'], ['taskkill', '/PID', '20', '/T', '/F']]);
});
