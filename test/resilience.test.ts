// 1.0.1 resilience against Claude updates (docs/ideas/resilience.md): the pure guards, the parsers against the
// fixtures of every stored Claude version (guard 10) and "no behaviour depends on Claude's version" (guard 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pickClaudePackage, type AppxPackage } from '../src/core/claudeApp.js';
import { defaultConfig } from '../src/core/config.js';
import { defaultProfileFromProcesses, parseClaudeProcesses, parseProcessList } from '../src/core/processes.js';
import {
  missingCookieColumns, runSelfCheck, shouldNotify, shouldSelfCheck, type SelfCheckDeps,
} from '../src/core/selfCheck.js';
import { accountKeyNames, cardState } from '../src/core/signIn.js';
import { ConfigStore } from '../src/main/configStore.js';
import { queryClaudeProcesses, queryClaudeWindows } from '../src/main/system/claudeApp.js';

const LOC = 'C:\\Program Files\\WindowsApps\\Claude_5.1.0.0_x64__pzs8sxrjxfjjc';
const ANTHROPIC = 'CN="Anthropic, PBC", O="Anthropic, PBC", C=US';
const exists = (files: string[]) => (p: string) => files.includes(p);

test('guard 3: "signed out" only when the cookie and the account keys agree; disagreement = unknown', () => {
  assert.equal(cardState('found', []), 'signedIn');
  assert.equal(cardState('found', null), 'signedIn');
  for (const cookie of ['missing', 'expired', 'empty'] as const) {
    assert.equal(cardState(cookie, []), 'signedOut', cookie);
    assert.equal(cardState(cookie, ['oauth:tokenCache']), 'unknown', cookie);
    assert.equal(cardState(cookie, null), 'unknown', `${cookie}, config.json unreadable`);
  }
});

test('guards 5 and 7: exe from the manifest, package named Claude first, else an Anthropic package with Claude.exe', () => {
  const named: AppxPackage = {
    Name: 'Claude', Publisher: ANTHROPIC, InstallLocation: LOC, PackageFamilyName: 'Claude_x', Executables: ['bin\\Claude.exe'],
  };
  assert.deepEqual(pickClaudePackage([named], exists([`${LOC}\\bin\\Claude.exe`])), { exe: `${LOC}\\bin\\Claude.exe`, family: 'Claude_x' });
  // Manifest exe missing on disk (or no manifest): the usual app\Claude.exe.
  assert.deepEqual(pickClaudePackage([{ ...named, Executables: [] }], exists([`${LOC}\\app\\Claude.exe`])),
    { exe: `${LOC}\\app\\Claude.exe`, family: 'Claude_x' });
  // Renamed package: accepted only from Anthropic and with a Claude.exe in its manifest.
  const renamed = { ...named, Name: 'AnthropicClaudeDesktop', Executables: ['app\\Claude.exe', 'app\\helper.exe'] };
  assert.equal(pickClaudePackage([renamed], exists([`${LOC}\\app\\Claude.exe`]))?.exe, `${LOC}\\app\\Claude.exe`);
  assert.equal(pickClaudePackage([{ ...renamed, Publisher: 'CN=Someone Else' }], exists([`${LOC}\\app\\Claude.exe`])), null);
  assert.equal(pickClaudePackage([{ ...renamed, Executables: ['app\\helper.exe'] }], exists([`${LOC}\\app\\Claude.exe`])), null);
  // A single executable may come as a string; "Claude" wins over another Anthropic package.
  const other = { ...renamed, InstallLocation: 'C:\\Other', Executables: 'app\\Claude.exe' };
  assert.equal(pickClaudePackage([other, named], exists([`${LOC}\\bin\\Claude.exe`, 'C:\\Other\\app\\Claude.exe']))?.exe,
    `${LOC}\\bin\\Claude.exe`);
  assert.equal(pickClaudePackage([], exists([])), null);
});

test('guard 6: processes match the exe actually found, with the usual path as the fallback; never the CLI', () => {
  const moved = `${LOC}\\bin\\claude-desktop.exe`;
  const usual = `${LOC}\\app\\Claude.exe`;
  const cli = 'C:\\Users\\johnd\\AppData\\Local\\Claude-Data\\x\\claude-code\\2.1.0\\claude.exe';
  const json = JSON.stringify([
    { ProcessId: 1, ExecutablePath: moved, CommandLine: `"${moved}"` },
    { ProcessId: 2, ExecutablePath: usual, CommandLine: `"${usual}" --user-data-dir=C:\\p\\work` },
    { ProcessId: 3, ExecutablePath: cli, CommandLine: 'claude' },
  ]);
  assert.deepEqual(parseClaudeProcesses(json).map((p) => p.pid), [2], 'without the found exe: the usual path only');
  assert.deepEqual(parseClaudeProcesses(json, moved.toUpperCase()).map((p) => p.pid), [1, 2], 'case-insensitive');
  const list = parseProcessList(JSON.stringify([
    { ProcessId: 10, ParentProcessId: 1, ExecutablePath: moved, CommandLine: `"${moved}"` },
    { ProcessId: 11, ParentProcessId: 10, ExecutablePath: moved, CommandLine: `"${moved}" --type=gpu --user-data-dir=C:\\d\\claude_x` },
  ]));
  assert.equal(defaultProfileFromProcesses(list), null);
  assert.equal(defaultProfileFromProcesses(list, moved), 'C:\\d\\claude_x');
});

test('guard 6: the process queries add the found exe\'s own file name; anything odd in it is never put in the script', async () => {
  const scripts: string[] = [];
  const run = async (script: string) => { scripts.push(script); return '[]'; };
  await queryClaudeProcesses(run, `${LOC}\\bin\\claude-desktop.exe`);
  await queryClaudeWindows(run, `${LOC}\\bin\\claude-desktop.exe`);
  await queryClaudeProcesses(run, `${LOC}\\app\\x';Remove-Item C:\\.exe`);
  await queryClaudeProcesses(run);
  assert.match(scripts[0]!, /Name='claude\.exe' OR Name='claude-desktop\.exe'/);
  assert.match(scripts[1]!, /Get-Process -Name claude,claude-desktop /);
  for (const s of scripts.slice(2)) assert.match(s, /-Filter "Name='claude\.exe'"/);
  assert.equal(scripts.some((s) => s.includes('Remove-Item')), false);
});

const passing = (over: Partial<SelfCheckDeps> = {}): SelfCheckDeps => ({
  exe: async () => true,
  mainProfile: async () => 'C:\\d\\claude_x',
  processQuery: async () => [],
  accountKeys: async () => ['lastKnownAccountUuid'],
  cookieColumns: async () => ['name', 'host_key', 'expires_utc', 'value', 'encrypted_value', 'path'],
  ...over,
});

test('guard 9: the self-check names each broken assumption; a throwing check fails, nothing to read is skipped', async () => {
  assert.deepEqual(await runSelfCheck(passing()), []);
  assert.deepEqual(await runSelfCheck(passing({ cookieColumns: async () => null })), [], 'every profile running: skipped');
  assert.deepEqual(await runSelfCheck(passing({
    exe: async () => false,
    processQuery: async () => { throw new Error('timeout'); },
    accountKeys: async () => [],
    cookieColumns: async () => ['name', 'host_key'],
  })), ['exe', 'processQuery', 'accountKeys', 'cookieColumns']);
  assert.deepEqual(await runSelfCheck(passing({ mainProfile: async () => null })), ['mainProfile'],
    'no main profile: its config.json is not looked at');
  assert.deepEqual(missingCookieColumns(['name', 'value']), ['host_key', 'expires_utc', 'encrypted_value']);
});

test('guard 9: when it runs and when it shows the notice (only a new failure)', () => {
  assert.equal(shouldSelfCheck(null, '4.23118.0.0'), true, 'never run');
  assert.equal(shouldSelfCheck({ version: '4.23118.0.0', failed: [] }, '4.23118.0.0'), false, 'same version, clean');
  assert.equal(shouldSelfCheck({ version: '4.23118.0.0', failed: [] }, '4.24000.0.0'), true, 'Claude updated');
  assert.equal(shouldSelfCheck({ version: '4.23118.0.0', failed: ['accountKeys'] }, '4.23118.0.0'), true,
    'still failing: checked again on every start, so a launcher fix clears it');
  assert.equal(shouldNotify(null, []), false);
  assert.equal(shouldNotify(null, ['accountKeys']), true);
  assert.equal(shouldNotify({ version: 'a', failed: ['accountKeys'] }, ['accountKeys']), false, 'a repeat only logs');
  assert.equal(shouldNotify({ version: 'a', failed: ['accountKeys'] }, ['accountKeys', 'exe']), true);
  assert.equal(shouldNotify({ version: 'a', failed: ['exe', 'accountKeys'] }, ['accountKeys']), true, 'a different list');
  assert.equal(shouldNotify({ version: 'a', failed: ['exe'] }, []), false, 'fixed: no notice');
});

test('guard 8: Claude\'s version string decides nothing (only logged, shown, or compared for a change)', () => {
  const uses = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') || f.endsWith('.cts'))
    .flatMap((f) => readFileSync(path.join('src', f), 'utf8').split('\n')
      .filter((line) => line.includes('claudeVersion(') && !line.includes('export function claudeVersion'))
      .map((line) => line.trim()));
  assert.ok(uses.length > 0);
  for (const line of uses) {
    assert.ok(/logTiming\(|claudeVersion: |compared for a change only/.test(line), `unexpected use: ${line}`);
  }
});

test('--simulate-claude-change: a read-only store keeps changes in memory and never writes the file', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'launcher-readonly-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');
  const store = new ConfigStore(file, true);
  await store.load(defaultConfig);
  await store.update((c) => ({ ...c, greetingName: 'John' }));
  assert.equal(store.current.greetingName, 'John');
  assert.equal(existsSync(file), false);
  const writable = new ConfigStore(file);
  await writable.load(defaultConfig);
  assert.match(await readFile(file, 'utf8'), /"accounts"/, 'the normal store writes the first run');
});

// ---------- Guard 10: every stored Claude version ----------

const FIXTURES = 'test/fixtures';
const versions = readdirSync(FIXTURES).filter((d) => d.startsWith('claude-'));
const fixture = <T>(version: string, file: string): T =>
  JSON.parse(readFileSync(path.join(FIXTURES, version, file), 'utf8')) as T;

test('fixtures exist for at least one Claude version', () => assert.ok(versions.length > 0));

for (const version of versions) {
  test(`fixtures ${version}: package, exe, processes, account keys and cookie columns still parse`, () => {
    const packages = fixture<AppxPackage[]>(version, 'appx-packages.json');
    const manifest = fixture<{ applications: { Executable: string }[] }>(version, 'manifest-applications.json');
    const withManifest = packages.map((p) => ({ ...p, Executables: manifest.applications.map((a) => a.Executable) }));
    const loc = String(packages[0]!.InstallLocation);
    const app = pickClaudePackage(withManifest, (p) => p.toLowerCase() === `${loc}\\app\\claude.exe`.toLowerCase());
    assert.equal(app?.exe.toLowerCase(), `${loc}\\app\\claude.exe`.toLowerCase());
    assert.ok(app?.family);

    const json = readFileSync(path.join(FIXTURES, version, 'processes.json'), 'utf8');
    const mains = parseClaudeProcesses(json, app?.exe);
    assert.ok(mains.some((p) => p.profileDir === null), 'the main Claude is found');
    assert.deepEqual(parseClaudeProcesses(json), mains, 'the fallback path gives the same answer');
    const raw = parseProcessList(json);
    assert.ok(mains.every((m) => raw.find((r) => r.pid === m.pid)?.args.every((a) => !a.startsWith('--type='))));
    assert.match(defaultProfileFromProcesses(raw, app?.exe) ?? '', /Claude-Data\\claude_/);

    const keys = (file: string): string[] => accountKeyNames(JSON.stringify(Object.fromEntries(
      fixture<{ keys: string[] }>(version, file).keys.map((k) => [k, 1]))));
    assert.ok(keys('config-key-names.json').length > 0, 'a signed-in profile has account keys');
    assert.deepEqual(keys('config-key-names-new-profile.json'), [], 'a new profile has none');
    assert.equal(cardState('missing', keys('config-key-names-new-profile.json')), 'signedOut');

    const columns = fixture<{ columns: { name: string }[] }>(version, 'cookies-columns.json').columns.map((c) => c.name);
    assert.deepEqual(missingCookieColumns(columns), []);
  });
}
