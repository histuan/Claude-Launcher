// Bug b: open Claude and wait for a visible window; spawn once more after ~3 s without one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchUntilWindow } from '../src/core/launch.js';

function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}

test('window already visible: one launch, confirmed', async () => {
  const c = clock();
  let launches = 0;
  const ok = await launchUntilWindow({ ...c, launch: async () => { launches++; }, hasWindow: async () => true });
  assert.equal(ok, true);
  assert.equal(launches, 1);
  assert.ok(c.now() <= 500);
});

test('starts in the tray: launched again once after ~3 s, then the window shows', async () => {
  const c = clock();
  let launches = 0;
  let relaunchAt = -1;
  const ok = await launchUntilWindow({
    ...c,
    launch: async () => { launches++; if (launches === 2) relaunchAt = c.now(); },
    hasWindow: async () => launches >= 2, // single-instance re-activation shows the window
  });
  assert.equal(ok, true);
  assert.equal(launches, 2);
  assert.equal(relaunchAt, 3000);
});

test('no window at all: two launches only, gives up after ~8 s', async () => {
  const c = clock();
  let launches = 0;
  const ok = await launchUntilWindow({ ...c, launch: async () => { launches++; }, hasWindow: async () => false });
  assert.equal(ok, false);
  assert.equal(launches, 2);
  assert.ok(c.now() >= 8000 && c.now() <= 8500);
});

test('a failing window query counts as "not yet"; a failing first launch is thrown', async () => {
  const c = clock();
  let calls = 0;
  const ok = await launchUntilWindow({
    ...c, launch: async () => undefined,
    hasWindow: async () => { calls++; if (calls < 3) throw new Error('powershell'); return true; },
  });
  assert.equal(ok, true);
  await assert.rejects(launchUntilWindow({ ...c, launch: async () => { throw new Error('ENOENT'); }, hasWindow: async () => true }));
});
