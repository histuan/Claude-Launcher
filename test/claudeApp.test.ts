import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { bringToFront, launchClaude, listClaudeProcesses, resolveClaudeExe, type SpawnFn } from '../src/main/system/claudeApp.js';

const LOC = 'C:\\Program Files\\WindowsApps\\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc';
const EXE = `${LOC}\\app\\Claude.exe`;
const OLD = 'C:\\Users\\thiag\\AppData\\Local\\AnthropicClaude\\claude.exe';
const env = { LOCALAPPDATA: 'C:\\Users\\thiag\\AppData\\Local' };
const exists = (files: string[]) => (p: string) => files.includes(p);

test('resolves the MSIX exe from Get-AppxPackage, on every call', async () => {
  let calls = 0;
  const run = async (script: string) => {
    calls++;
    assert.match(script, /Get-AppxPackage/);
    return JSON.stringify([{ Name: 'ClaudeHelper', InstallLocation: 'C:\\x' }, { Name: 'Claude', InstallLocation: LOC }]);
  };
  assert.equal(await resolveClaudeExe(run, env, exists([EXE])), EXE);
  assert.equal(await resolveClaudeExe(run, env, exists([EXE])), EXE);
  assert.equal(calls, 2);
});

test('falls back to the old install, then null when Claude is not installed', async () => {
  assert.equal(await resolveClaudeExe(async () => '[]', env, exists([OLD])), OLD);
  assert.equal(await resolveClaudeExe(async () => { throw new Error('no powershell'); }, env, exists([OLD])), OLD);
  assert.equal(await resolveClaudeExe(async () => '', env, exists([])), null);
  // Package listed but its exe is missing.
  assert.equal(await resolveClaudeExe(async () => JSON.stringify({ Name: 'Claude', InstallLocation: LOC }), env, exists([])), null);
});

test('process list: PowerShell failure gives an empty list', async () => {
  assert.deepEqual(await listClaudeProcesses(async () => { throw new Error('timeout'); }), []);
  const one = JSON.stringify({ ProcessId: 5, ExecutablePath: EXE, CommandLine: `"${EXE}"` });
  assert.deepEqual(await listClaudeProcesses(async (s) => { assert.match(s, /Win32_Process/); return one; }),
    [{ pid: 5, profileDir: null }]);
});

function fakeSpawn(outcome: 'spawn' | 'error') {
  const calls: { file: string; args: readonly string[]; options: object; unref: boolean }[] = [];
  const spawn: SpawnFn = (file, args, options) => {
    const child = Object.assign(new EventEmitter(), { unref: () => { call.unref = true; } });
    const call = { file, args, options, unref: false };
    calls.push(call);
    setImmediate(() => child.emit(outcome, new Error('ENOENT')));
    return child;
  };
  return { spawn, calls };
}

test('launch: Main without flag, others with --user-data-dir; detached, hidden, unref', async () => {
  const fake = fakeSpawn('spawn');
  await launchClaude(EXE, null, fake.spawn);
  await launchClaude(EXE, 'C:\\Users\\a b\\ClaudeProfiles\\work', fake.spawn);
  assert.deepEqual(fake.calls.map((c) => c.args), [[], ['--user-data-dir=C:\\Users\\a b\\ClaudeProfiles\\work']]);
  for (const c of fake.calls) {
    assert.equal(c.file, EXE);
    assert.deepEqual(c.options, { detached: true, stdio: 'ignore', windowsHide: true });
    assert.equal(c.unref, true);
  }
});

test('launch: a spawn error rejects instead of crashing', async () => {
  await assert.rejects(launchClaude(EXE, null, fakeSpawn('error').spawn), /ENOENT/);
});

test('bring to front: that pid only, True from Windows → true; refused or failing → false, never throws', async () => {
  const scripts: string[] = [];
  assert.equal(await bringToFront(async (s) => { scripts.push(s); return 'True\r\n'; }, 4242), true);
  assert.match(scripts[0], /Get-Process -Id 4242 /);
  assert.match(scripts[0], /AllowSetForegroundWindow\(4242\)/);
  assert.match(scripts[0], /SetForegroundWindow\(\$h\)/);
  assert.equal(await bringToFront(async () => 'False', 4242), false);
  assert.equal(await bringToFront(async () => { throw new Error('timeout'); }, 4242), false);
  let ran = false;
  assert.equal(await bringToFront(async () => { ran = true; return 'True'; }, 1.5), false);
  assert.equal(ran, false, 'a non-integer pid never reaches PowerShell');
});
