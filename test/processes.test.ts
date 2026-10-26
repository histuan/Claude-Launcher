import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, type Account } from '../src/core/config.js';
import { parseClaudeProcesses, runningAccountIds } from '../src/core/processes.js';

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
