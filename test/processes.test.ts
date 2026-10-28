import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, type Account } from '../src/core/config.js';
import {
  defaultProfileFromProcesses, parseClaudeProcesses, parseProcessList, pidsForProfile, pidsInsideFolder, windowPid,
  runningAccountIds,
} from '../src/core/processes.js';

const APP = 'C:\\Program Files\\WindowsApps\\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe';
const CLI = 'C:\\Users\\thiag\\AppData\\Local\\Claude-Data\\x\\claude-code\\2.1.0\\claude.exe';

// Sample of what the PowerShell process query prints (ConvertTo-Json -Compress -InputObject @(...)).
const SAMPLE = JSON.stringify([
  { ProcessId: 100, ExecutablePath: APP, CommandLine: `"${APP}"` },
  { ProcessId: 101, ExecutablePath: APP, CommandLine: `"${APP}" --type=renderer --user-data-dir=C:\\x` },
  { ProcessId: 200, ExecutablePath: APP, CommandLine: `"${APP}" --user-data-dir=C:\\Users\\thiag\\ClaudeProfiles\\work` },
  { ProcessId: 201, ExecutablePath: APP, CommandLine: `"${APP}" "--user-data-dir=C:\\Users\\a b\\ClaudeProfiles\\college"` },
  { ProcessId: 300, ExecutablePath: CLI, CommandLine: `"${CLI}" --user-data-dir=C:\\Users\\thiag\\ClaudeProfiles\\other` },
  { ProcessId: 301, ExecutablePath: CLI, CommandLine: 'claude' },
  { ProcessId: 400, ExecutablePath: null, CommandLine: null },
]);

test('keeps only Claude Desktop main processes, by exe path; reads --user-data-dir', () => {
  assert.deepEqual(parseClaudeProcesses(SAMPLE), [
    { pid: 100, profileDir: null },
    { pid: 200, profileDir: 'C:\\Users\\thiag\\ClaudeProfiles\\work' },
    { pid: 201, profileDir: 'C:\\Users\\a b\\ClaudeProfiles\\college' },
  ]);
});

test('accepts a single object, empty output and garbage', () => {
  assert.deepEqual(parseClaudeProcesses(JSON.stringify({ ProcessId: 1, ExecutablePath: APP, CommandLine: APP })),
    [{ pid: 1, profileDir: null }]);
  assert.deepEqual(parseClaudeProcesses(''), []);
  assert.deepEqual(parseClaudeProcesses('[]'), []);
  assert.throws(() => parseClaudeProcesses('not json'));
});

test('only the Claude Code CLI running: nothing is running', () => {
  const json = JSON.stringify([{ ProcessId: 9, ExecutablePath: CLI.toUpperCase(), CommandLine: 'claude.exe' }]);
  assert.deepEqual(parseClaudeProcesses(json), []);
});

test('maps processes to account ids (Main = no flag; paths compared without case or trailing slash)', () => {
  const work: Account = { id: 'work', label: 'Work', email: null, realName: null, photo: null,
    profileDir: 'C:\\Users\\thiag\\ClaudeProfiles\\work' };
  const home: Account = { ...work, id: 'home', profileDir: 'C:\\Users\\thiag\\ClaudeProfiles\\home' };
  const accounts = [...defaultConfig().accounts, work, home];
  assert.deepEqual(runningAccountIds(accounts, [{ pid: 1, profileDir: 'c:/users/THIAG/ClaudeProfiles/Work/' }]), ['work']);
  assert.deepEqual(runningAccountIds(accounts, [{ pid: 1, profileDir: null }]), ['main']);
  assert.deepEqual(runningAccountIds(accounts, []), []);
});

const PROFILE = 'C:\\Users\\thiag\\AppData\\Local\\Claude-Data\\claude_pzs8sxrjxfjjc';
const ALL = JSON.stringify([
  { ProcessId: 100, ParentProcessId: 4, ExecutablePath: APP, CommandLine: `"${APP}"` },
  { ProcessId: 101, ParentProcessId: 100, ExecutablePath: APP, CommandLine: `"${APP}" --type=gpu-process "--user-data-dir=${PROFILE}"` },
  // An extra account: its children carry its own folder and must not be taken for the default one.
  { ProcessId: 200, ParentProcessId: 4, ExecutablePath: APP, CommandLine: `"${APP}" --user-data-dir=C:\\Users\\thiag\\ClaudeProfiles\\work` },
  { ProcessId: 201, ParentProcessId: 200, ExecutablePath: APP, CommandLine: `"${APP}" --type=renderer --user-data-dir=C:\\Users\\thiag\\ClaudeProfiles\\work` },
  { ProcessId: 300, ParentProcessId: 1, ExecutablePath: `${PROFILE}\\claude-code\\2.1.0\\claude.exe`, CommandLine: 'claude' },
  { ProcessId: 400, ParentProcessId: 1, ExecutablePath: `${PROFILE}-other\\x.exe`, CommandLine: null },
  { ProcessId: 500, ExecutablePath: null },
]);

test('default profile = --user-data-dir of a child of the default (flagless) main process', () => {
  assert.equal(defaultProfileFromProcesses(parseProcessList(ALL)), PROFILE);
  const onlyExtra = parseProcessList(ALL).filter((p) => p.pid !== 100 && p.pid !== 101);
  assert.equal(defaultProfileFromProcesses(onlyExtra), null);
  assert.equal(defaultProfileFromProcesses(parseProcessList('')), null);
});

test('processes running from inside a folder (not a sibling with the same prefix)', () => {
  assert.deepEqual(pidsInsideFolder(parseProcessList(ALL), PROFILE.toUpperCase() + '\\'), [300]);
  assert.deepEqual(pidsInsideFolder(parseProcessList(ALL), 'C:\\Elsewhere'), []);
});

test('pidsForProfile: null = default instance only; a folder matches only that profile', () => {
  const list = parseClaudeProcesses(SAMPLE);
  assert.deepEqual(pidsForProfile(list, null), [100]);
  assert.deepEqual(pidsForProfile(list, 'c:/users/THIAG/claudeprofiles/work/'), [200]);
  assert.deepEqual(pidsForProfile(list, 'C:\\Users\\thiag\\ClaudeProfiles\\nope'), []);
});

test('window query: MainWindowHandle 0 or null = no window (Claude in the tray)', () => {
  const json = JSON.stringify([
    { ProcessId: 100, ExecutablePath: APP, CommandLine: `"${APP}"`, MainWindowHandle: 0 },
    { ProcessId: 101, ExecutablePath: APP, CommandLine: `"${APP}" --type=gpu-process`, MainWindowHandle: 77 },
    { ProcessId: 200, ExecutablePath: APP, CommandLine: `"${APP}" --user-data-dir=C:\\P\\work`, MainWindowHandle: 4242 },
    { ProcessId: 201, ExecutablePath: APP, CommandLine: `"${APP}" --user-data-dir=C:\\P\\home`, MainWindowHandle: null },
  ]);
  const list = parseClaudeProcesses(json);
  assert.deepEqual(list.map((p) => p.hasWindow), [false, true, false]);
  assert.equal(windowPid(list, null), null);
  assert.equal(windowPid(list, 'C:\\P\\work'), 200);
  assert.equal(windowPid(list, 'C:\\P\\home'), null);
  assert.equal(windowPid(parseClaudeProcesses(SAMPLE), 'C:\\Users\\thiag\\ClaudeProfiles\\work'), null,
    'the plain process query has no window information');
});
