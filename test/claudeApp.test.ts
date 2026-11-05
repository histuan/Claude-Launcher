import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { bringToFront, launchClaude, listClaudeProcesses, lookUpClaudeApp, type SpawnFn } from '../src/main/system/claudeApp.js';

const LOC = 'C:\\Program Files\\WindowsApps\\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc';
const EXE = `${LOC}\\app\\Claude.exe`;
const OLD = 'C:\\Users\\alex\\AppData\\Local\\AnthropicClaude\\claude.exe';
const env = { LOCALAPPDATA: 'C:\\Users\\alex\\AppData\\Local' };
const exists = (files: string[]) => (p: string) => files.includes(p);

const pkg = (exe = true) => JSON.stringify([{ Name: 'Claude', InstallLocation: exe ? LOC : 'C:\\gone', PackageFamilyName: 'Claude_pzs8sxrjxfjjc' }]);

test('lookup: exe and PackageFamilyName from one Get-AppxPackage call, with a ~15 s timeout', async () => {
  const timeouts: (number | undefined)[] = [];
  const run = async (script: string, timeoutMs?: number) => {
    assert.match(script, /Get-AppxPackage/);
    assert.match(script, /PackageFamilyName/);
    timeouts.push(timeoutMs);
    return pkg();
  };
  assert.deepEqual(await lookUpClaudeApp(run, env, exists([EXE])),
    { state: 'found', app: { exe: EXE, family: 'Claude_pzs8sxrjxfjjc' }, source: 'lookup' });
  assert.deepEqual(timeouts, [15_000]);
});

test('lookup: a timeout is retried once; the second answer is used', async () => {
  let calls = 0;
  const run = async () => { if (++calls === 1) throw new Error('spawnSync powershell.exe ETIMEDOUT'); return pkg(); };
  const r = await lookUpClaudeApp(run, env, exists([EXE]));
  assert.equal(r.state, 'found');
  assert.equal(calls, 2);
});

test('lookup: two timeouts → failed (never "not installed"); the old install still counts', async () => {
  let calls = 0;
  const run = async () => { calls++; throw new Error('timeout'); };
  const r = await lookUpClaudeApp(run, env, exists([]));
  assert.equal(r.state, 'failed');
  assert.match(r.state === 'failed' ? r.reason : '', /timeout/);
  assert.equal(calls, 2);
  assert.deepEqual(await lookUpClaudeApp(run, env, exists([OLD])),
    { state: 'found', app: { exe: OLD, family: null }, source: 'old install' });
});

test('lookup completed: no package, or its exe missing → not installed (old install first)', async () => {
  assert.deepEqual(await lookUpClaudeApp(async () => '[]', env, exists([])), { state: 'notInstalled' });
  assert.deepEqual(await lookUpClaudeApp(async () => '', env, exists([])), { state: 'notInstalled' });
  assert.deepEqual(await lookUpClaudeApp(async () => pkg(false), env, exists([])), { state: 'notInstalled' });
  assert.equal((await lookUpClaudeApp(async () => '[]', env, exists([OLD]))).state, 'found');
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
