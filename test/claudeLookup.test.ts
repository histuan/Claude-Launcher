// Finding Claude.exe: cache first (file check only), PowerShell only when the cache is empty or stale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findClaudeApp, lookupError, type CachedClaude, type ClaudeLookup } from '../src/core/claudeApp.js';
import { strings } from '../src/renderer/strings.js';

const OLD_EXE = 'C:\\Program Files\\WindowsApps\\Claude_4.4212.0.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe';
const NEW_EXE = 'C:\\Program Files\\WindowsApps\\Claude_4.16336.0.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe';
const FAMILY = 'Claude_pzs8sxrjxfjjc';

function world(cached: CachedClaude | null, files: string[], lookup: ClaudeLookup) {
  const saved: CachedClaude[] = [];
  let lookups = 0;
  return {
    saved,
    lookups: () => lookups,
    deps: {
      cached,
      exists: (f: string) => files.includes(f),
      lookUp: async () => { lookups++; return lookup; },
      save: async (app: CachedClaude) => { saved.push(app); },
    },
  };
}

const found = (exe: string): ClaudeLookup => ({ state: 'found', app: { exe, family: FAMILY }, source: 'lookup' });

test('cache hit: the cached exe exists → no PowerShell lookup, nothing saved', async () => {
  const w = world({ exe: NEW_EXE, family: FAMILY }, [NEW_EXE], found(NEW_EXE));
  assert.deepEqual(await findClaudeApp(w.deps), { state: 'found', app: { exe: NEW_EXE, family: FAMILY }, source: 'cache' });
  assert.equal(w.lookups(), 0);
  assert.deepEqual(w.saved, []);
});

test('stale cache after a Claude update: the old exe is gone → looked up again and the new path saved', async () => {
  const w = world({ exe: OLD_EXE, family: FAMILY }, [NEW_EXE], found(NEW_EXE));
  const r = await findClaudeApp(w.deps);
  assert.equal(r.state, 'found');
  assert.equal(r.state === 'found' && r.app.exe, NEW_EXE);
  assert.equal(w.lookups(), 1);
  assert.deepEqual(w.saved, [{ exe: NEW_EXE, family: FAMILY }]);
});

test('empty cache: looked up and saved; a failed or empty lookup saves nothing', async () => {
  const w = world(null, [NEW_EXE], found(NEW_EXE));
  assert.equal((await findClaudeApp(w.deps)).state, 'found');
  assert.deepEqual(w.saved, [{ exe: NEW_EXE, family: FAMILY }]);
  for (const lookup of [{ state: 'failed', reason: 'timeout' }, { state: 'notInstalled' }] as ClaudeLookup[]) {
    const v = world(null, [], lookup);
    assert.deepEqual(await findClaudeApp(v.deps), lookup);
    assert.deepEqual(v.saved, []);
  }
});

test('a failed cache save never fails the lookup', async () => {
  const w = world(null, [NEW_EXE], found(NEW_EXE));
  w.deps.save = async () => { throw new Error('disk full'); };
  assert.equal((await findClaudeApp(w.deps)).state, 'found');
});

test('a timeout is never "not installed": its own message; "not installed" only after a completed lookup', () => {
  assert.equal(lookupError({ state: 'failed', reason: 'timeout' }), 'lookupFailed');
  assert.equal(lookupError({ state: 'notInstalled' }), 'notInstalled');
  assert.equal(lookupError(found(NEW_EXE)), null);
  const msg = strings.errors.lookupFailed;
  assert.equal(`${msg.title}. ${msg.body}`, 'Couldn\'t find Claude in time. Try again.');
});
