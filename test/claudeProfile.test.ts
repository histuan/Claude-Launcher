import { test } from 'node:test';
import assert from 'node:assert/strict';
import { killProcesses, markerFileFor, resolveDefaultSlot } from '../src/main/system/claudeProfile.js';

const env = { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' };

test('default profile folder comes from the package family name, never hard-coded', async () => {
  const run = async (s: string) => {
    assert.match(s, /PackageFamilyName/);
    return JSON.stringify([{ Name: 'ClaudeOther', PackageFamilyName: 'X_1' }, { Name: 'Claude', PackageFamilyName: 'Claude_abc' }]);
  };
  assert.equal(await resolveDefaultSlot(run, env),
    'C:\\Users\\u\\AppData\\Local\\Packages\\Claude_abc\\LocalCache\\Roaming\\Claude');
  assert.equal(await resolveDefaultSlot(async () => '[]', env), null);
  assert.equal(await resolveDefaultSlot(async () => { throw new Error('x'); }, env), null);
  assert.equal(await resolveDefaultSlot(run, {}), null);
  assert.equal(markerFileFor(env), 'C:\\Users\\u\\AppData\\Local\\ClaudeLauncher\\login-pending.json');
});

test('kill: taskkill per pid with its children', async () => {
  const calls: string[][] = [];
  await killProcesses([10, 20], async (file, args) => { calls.push([file, ...args]); });
  assert.deepEqual(calls, [['taskkill', '/PID', '10', '/T', '/F'], ['taskkill', '/PID', '20', '/T', '/F']]);
});
