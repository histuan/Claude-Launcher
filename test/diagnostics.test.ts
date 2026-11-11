// 0.7.0: "Copy diagnostics" — nothing personal reaches the report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnostics, DIAGNOSTICS_LOG_LINES, redact, type DiagnosticsInput } from '../src/core/diagnostics.js';
import { strings } from '../src/renderer/strings.js';

const env = {
  USERPROFILE: 'C:\\Users\\johnd',
  LOCALAPPDATA: 'C:\\Users\\johnd\\AppData\\Local',
  APPDATA: 'C:\\Users\\johnd\\AppData\\Roaming',
  USERNAME: 'johnd',
};
const EMAIL = 'JohnDoe@email.com';
const REAL_NAME = 'John Doe';
const WINDOWS_NAME = 'Johnny Windows';
const GREETING = 'Jo';
const TOKEN = 'sk-ant-sid01-' + 'A1b2C3d4E5'.repeat(8);

function input(log: string, over: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return {
    createdAt: new Date('2026-11-05T12:00:00Z'),
    launcherVersion: '0.7.0',
    claudeVersion: '3.6556.2.0',
    windowsVersion: 'Windows 10 Pro 10.0.26100',
    accounts: [
      { label: 'Main', state: 'signedIn', running: true },
      { label: 'Work', state: 'signedOut', running: false },
      { label: 'Test', state: 'checking', running: false },
    ],
    paths: {
      claudeExe: 'C:\\Program Files\\WindowsApps\\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe',
      mainProfile: 'C:\\Users\\johnd\\AppData\\Local\\Claude-Data\\claude_abc',
      extraProfiles: 'C:\\Users\\johnd\\ClaudeProfiles',
      log: 'C:\\Users\\johnd\\AppData\\Roaming\\claude-launcher\\sign-in-timings.log',
    },
    log,
    env,
    personal: [EMAIL, REAL_NAME, WINDOWS_NAME, GREETING],
    claudeCheck: null,
    detectionUnsure: false,
    simulated: false,
    ...over,
  };
}

const personalLog = [
  `2026-11-05T11:00:00Z  start: stash c:\\users\\JOHND\\AppData\\Local\\Claude-Data\\claude_abc`,
  `2026-11-05T11:00:01Z  card check work: ${EMAIL} for John Doe (Windows: Johnny Windows, hi Jo)`,
  `2026-11-05T11:00:02Z  folder C:/Users/johnd/ClaudeProfiles/work, user johnd, token ${TOKEN}`,
  `2026-11-05T11:00:03Z  someone@else.org wrote it`,
].join('\r\n');

test('the report has the versions, the accounts by card label and their states', () => {
  const report = buildDiagnostics(input(''), strings.diagnostics.report);
  assert.match(report, /Launcher: 0\.7\.0/);
  assert.match(report, /Claude: 3\.6556\.2\.0/);
  assert.match(report, /Windows: Windows 10 Pro 10\.0\.26100/);
  assert.match(report, /Accounts: 3 \(1 signed in\)/);
  assert.match(report, /- Main: signed in, running\n- Work: not signed in\n- Test: checking/);
  assert.match(report, /\(empty\)/);
});

test('paths are written with environment variables, never the real user folder', () => {
  const report = buildDiagnostics(input(''), strings.diagnostics.report);
  assert.match(report, /Main profile: %LOCALAPPDATA%\\Claude-Data\\claude_abc/);
  assert.match(report, /Other profiles: %USERPROFILE%\\ClaudeProfiles/);
  assert.match(report, /Log: %APPDATA%\\claude-launcher\\sign-in-timings\.log/);
  assert.match(report, /Claude\.exe: C:\\Program Files\\WindowsApps\\Claude_3\.6556\.2\.0/);
  assert.doesNotMatch(report, /johnd/i);
});

test('nothing personal from the log reaches the report: e-mails, names, user folder, tokens', () => {
  const report = buildDiagnostics(input(personalLog), strings.diagnostics.report);
  for (const secret of [EMAIL, 'someone@else.org', 'John Doe', 'Johnny', 'Jo)', 'johnd', TOKEN, 'A1b2C3d4E5']) {
    assert.ok(!report.toLowerCase().includes(secret.toLowerCase()), `report contains ${secret}`);
  }
  assert.match(report, /stash %LOCALAPPDATA%\\Claude-Data\\claude_abc/);
  assert.match(report, /folder %USERPROFILE%\/ClaudeProfiles\/work, user <name>, token <value>/);
  assert.match(report, /card check work: <e-mail> for <name> \(Windows: <name>, hi <name>\)/);
});

test('only the last 50 lines of the log', () => {
  const log = Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join('\n');
  const report = buildDiagnostics(input(log), strings.diagnostics.report);
  assert.match(report, new RegExp(`Last ${DIAGNOSTICS_LOG_LINES} lines`));
  assert.ok(report.includes('line 31\n') && report.includes('line 80\n'));
  assert.ok(!report.includes('line 30\n'));
});

test('an e-mail typed as a card label is removed; unknown Claude and uncached paths say so', () => {
  const report = buildDiagnostics(input('', {
    claudeVersion: null,
    accounts: [{ label: EMAIL, state: 'signedIn', running: false }],
    paths: { claudeExe: null, mainProfile: null, extraProfiles: 'C:\\Users\\johnd\\ClaudeProfiles', log: 'x.log' },
  }), strings.diagnostics.report);
  assert.ok(!report.includes(EMAIL));
  assert.match(report, /- <e-mail>: signed in/);
  assert.match(report, /Claude: not found/);
  assert.match(report, /Claude\.exe: not known yet/);
});

test('redact: a name inside a longer word stays (no false matches), a bare drive is never a folder', () => {
  assert.equal(redact('Johndsomething johnd', { USERNAME: 'johnd' }, ['John Doe']), 'Johndsomething <name>');
  assert.equal(redact('C:\\Windows', { USERPROFILE: 'C:\\' }, []), 'C:\\Windows');
});

test('(1.0.1) the Claude check, an unsure detection and the simulated mode each get a line; unknown cards say so', () => {
  const plain = buildDiagnostics(input(''), strings.diagnostics.report);
  assert.match(plain, /^Claude check: not run yet$/m);
  assert.doesNotMatch(plain, /Simulated|unsure/);
  const report = buildDiagnostics(input('', {
    claudeCheck: { version: '5.1231.0.0', failed: ['accountKeys', 'cookieColumns'] },
    detectionUnsure: true,
    simulated: true,
    accounts: [{ label: 'Work', state: 'unknown', running: false }],
  }), strings.diagnostics.report);
  assert.match(report, /^Claude check: failed: accountKeys, cookieColumns \(Claude 5\.1231\.0\.0\)$/m);
  assert.match(report, /^Sign-in detection: unsure /m);
  assert.match(report, /^Simulated Claude change: yes$/m);
  assert.match(report, /^- Work: unknown$/m);
  const ok = buildDiagnostics(input('', { claudeCheck: { version: '5.1231.0.0', failed: [] } }), strings.diagnostics.report);
  assert.match(ok, /^Claude check: ok \(Claude 5\.1231\.0\.0\)$/m);
});
