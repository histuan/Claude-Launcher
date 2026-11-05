// 0.7.0: "Copy diagnostics" — nothing personal reaches the report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnostics, DIAGNOSTICS_LOG_LINES, redact, type DiagnosticsInput } from '../src/core/diagnostics.js';
import { strings } from '../src/renderer/strings.js';

const env = {
  USERPROFILE: 'C:\\Users\\thiag',
  LOCALAPPDATA: 'C:\\Users\\thiag\\AppData\\Local',
  APPDATA: 'C:\\Users\\thiag\\AppData\\Roaming',
  USERNAME: 'thiag',
};
const EMAIL = 'thiago.real@example.com';
const REAL_NAME = 'Thiago Fulano';
const WINDOWS_NAME = 'Thiago Windows';
const GREETING = 'Thi';
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
      mainProfile: 'C:\\Users\\thiag\\AppData\\Local\\Claude-Data\\claude_abc',
      extraProfiles: 'C:\\Users\\thiag\\ClaudeProfiles',
      log: 'C:\\Users\\thiag\\AppData\\Roaming\\claude-launcher\\sign-in-timings.log',
    },
    log,
    env,
    personal: [EMAIL, REAL_NAME, WINDOWS_NAME, GREETING],
    ...over,
  };
}

const personalLog = [
  `2026-11-05T11:00:00Z  start: stash c:\\users\\THIAG\\AppData\\Local\\Claude-Data\\claude_abc`,
  `2026-11-05T11:00:01Z  card check work: ${EMAIL} for Thiago Fulano (Windows: Thiago Windows, hi Thi)`,
  `2026-11-05T11:00:02Z  folder C:/Users/thiag/ClaudeProfiles/work, user thiag, token ${TOKEN}`,
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
  assert.doesNotMatch(report, /thiag/i);
});

test('nothing personal from the log reaches the report: e-mails, names, user folder, tokens', () => {
  const report = buildDiagnostics(input(personalLog), strings.diagnostics.report);
  for (const secret of [EMAIL, 'someone@else.org', 'Thiago', 'Fulano', 'Thiago Windows', 'Thi)', 'thiag', TOKEN, 'A1b2C3d4E5']) {
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
    paths: { claudeExe: null, mainProfile: null, extraProfiles: 'C:\\Users\\thiag\\ClaudeProfiles', log: 'x.log' },
  }), strings.diagnostics.report);
  assert.ok(!report.includes(EMAIL));
  assert.match(report, /- <e-mail>: signed in/);
  assert.match(report, /Claude: not found/);
  assert.match(report, /Claude\.exe: not known yet/);
});

test('redact: a name inside a longer word stays (no false matches), a bare drive is never a folder', () => {
  assert.equal(redact('Thiagosomething thiag', { USERNAME: 'thiag' }, ['Thiago']), 'Thiagosomething <name>');
  assert.equal(redact('C:\\Windows', { USERPROFILE: 'C:\\' }, []), 'C:\\Windows');
});
