// Phase 5.2 / 0.6.2: self-update with a mocked updater (no update, update found, Later, download error, busy,
// remembered version, corner link).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UpdateStatus } from '../src/core/api.js';
import { SelfUpdate } from '../src/main/selfUpdate.js';

function setup(opts: {
  found?: string | null; checkFails?: boolean | boolean[]; downloadFails?: boolean; busy?: boolean[]; known?: string | null;
} = {}) {
  const s = {
    sent: [] as UpdateStatus[], logs: [] as string[], checks: 0, downloads: 0, installs: 0, waits: 0, pauses: 0,
    saved: [] as (string | null)[], checkFails: Array.isArray(opts.checkFails) ? [...opts.checkFails] : null,
    busy: [...(opts.busy ?? [])],
  };
  const updates = new SelfUpdate({
    check: async () => {
      s.checks++;
      const fails = s.checkFails ? s.checkFails.shift() ?? false : opts.checkFails === true;
      if (fails) throw new Error('net::ERR_INTERNET_DISCONNECTED https://github.com/…');
      return opts.found ?? null;
    },
    download: async (onProgress) => {
      s.downloads++;
      onProgress(10.4);
      onProgress(10.6); // same whole percent: not sent again
      onProgress(55);
      if (opts.downloadFails) throw new Error('sha512 checksum mismatch');
      onProgress(100);
      return { bytes: 92_345_678, mode: 'full' as const };
    },
    install: () => { s.installs++; },
    beforeInstall: async () => { s.pauses++; },
    remember: async (v) => { s.saved.push(v); },
    busy: () => s.busy.shift() ?? false,
    wait: async () => { s.waits++; },
    send: (status) => s.sent.push(status),
    log: (line) => s.logs.push(line),
  }, '0.6.0', opts.known ?? null);
  return { s, updates };
}

test('no update: nothing is shown', async () => {
  const { s, updates } = setup();
  await updates.start();
  assert.equal(s.checks, 1);
  assert.deepEqual(s.sent, []);
  assert.equal(updates.active, false);
  assert.match(s.logs.join('\n'), /update: check: none newer than 0\.6\.0 \(\d+ ms\)/);
});

test('a failed check is only logged, without its message', async () => {
  const { s, updates } = setup({ checkFails: true });
  await updates.start();
  assert.deepEqual(s.sent, []);
  assert.doesNotMatch(s.logs.join('\n'), /github|ERR_/);
  assert.match(s.logs.join('\n'), /update: check failed \(\d+ ms\)/);
});

test('update found: the dialog is asked for, and only once per start', async () => {
  const { s, updates } = setup({ found: '0.6.1' });
  await updates.start();
  await updates.start();
  assert.equal(s.checks, 1);
  assert.deepEqual(s.sent, [{ phase: 'available', version: '0.6.1' }]);
  assert.equal(s.downloads, 0); // nothing downloads before Install
});

test('Later: nothing downloads or installs; the offer stays for the corner link', async () => {
  const { s, updates } = setup({ found: '0.6.1' });
  await updates.start();
  updates.later();
  assert.equal(s.downloads, 0);
  assert.equal(s.installs, 0);
  assert.equal(updates.active, false);
  assert.match(s.logs.at(-1)!, /update: 0\.6\.1 later/);
  assert.equal(updates.reopen(), null);
  assert.equal(await updates.install(), null); // Install from the reopened dialog
  assert.equal(s.installs, 1);
});

test('Install: progress in whole percents, then a silent install', async () => {
  const { s, updates } = setup({ found: '0.6.1' });
  await updates.start();
  assert.equal(await updates.install(), null);
  assert.deepEqual(s.sent.slice(1), [
    { phase: 'downloading', version: '0.6.1', percent: 0 },
    { phase: 'downloading', version: '0.6.1', percent: 10 },
    { phase: 'downloading', version: '0.6.1', percent: 55 },
    { phase: 'downloading', version: '0.6.1', percent: 100 },
    { phase: 'installing', version: '0.6.1' },
  ]);
  assert.equal(s.installs, 1);
  assert.equal(s.pauses, 1); // "Installing…" can be read before the window closes
  assert.equal(updates.active, true);
  assert.match(s.logs.at(-1)!, /^update: download 0\.6\.1: 92345678 bytes, \d+ ms, full; installing$/);
});

test('download error: a failed status, nothing installed, the launcher is free again', async () => {
  const { s, updates } = setup({ found: '0.6.1', downloadFails: true });
  await updates.start();
  assert.equal(await updates.install(), null);
  assert.deepEqual(s.sent.at(-1), { phase: 'failed', version: '0.6.1' });
  assert.equal(s.installs, 0);
  assert.equal(updates.active, false);
  assert.doesNotMatch(s.logs.join('\n'), /sha512/);
  assert.match(s.logs.join('\n'), /update: download 0\.6\.1 failed \(\d+ ms\)/);
});

test('never checks while a sign-in or the memory assistant is in progress: waits until it ends', async () => {
  const { s, updates } = setup({ found: '0.6.1', busy: [true, true, false] });
  await updates.start();
  assert.equal(s.waits, 2);
  assert.equal(s.checks, 1);
  assert.deepEqual(s.sent, [{ phase: 'available', version: '0.6.1' }]);
});

test('never installs while busy: Install is refused and nothing downloads', async () => {
  const { s, updates } = setup({ found: '0.6.1', busy: [false, true] });
  await updates.start();
  assert.equal(await updates.install(), 'pending');
  assert.equal(s.downloads, 0);
  assert.equal(updates.active, false);
});

test('the first newer version found is remembered; none newer clears it', async () => {
  const found = setup({ found: '0.6.1' });
  await found.updates.start();
  assert.deepEqual(found.s.saved, ['0.6.1']);
  const none = setup({ known: '0.6.1' });
  await none.updates.start();
  assert.deepEqual(none.s.saved, [null]);
});

test('a remembered newer version is shown at once, and the check confirms it without a second notice', async () => {
  const { s, updates } = setup({ known: '0.6.1', found: '0.6.1', busy: [true, false] });
  const started = updates.start();
  assert.deepEqual(s.sent, [{ phase: 'available', version: '0.6.1' }]); // before the (busy-delayed) check
  await started;
  assert.equal(s.checks, 1);
  assert.deepEqual(s.sent, [{ phase: 'available', version: '0.6.1' }]);
  assert.deepEqual(s.saved, []); // already known
});

test('the check clears a remembered version that is no longer newer', async () => {
  const { s, updates } = setup({ known: '0.6.1', found: null });
  await updates.start();
  assert.deepEqual(s.sent, [{ phase: 'available', version: '0.6.1' }, { phase: 'none' }]);
  assert.deepEqual(s.saved, [null]);
  await assert.rejects(updates.install());
});

test('the check replaces a remembered version with a newer one', async () => {
  const { s, updates } = setup({ known: '0.6.1', found: '0.6.2' });
  await updates.start();
  assert.deepEqual(s.sent.at(-1), { phase: 'available', version: '0.6.2' });
  assert.deepEqual(s.saved, ['0.6.2']);
});

test('a remembered version that is not newer than the running one is dropped, not shown', async () => {
  const { s, updates } = setup({ known: '0.6.0' });
  await updates.start();
  assert.deepEqual(s.sent, []);
  assert.deepEqual(s.saved, [null]);
});

test('Install on a remembered version while offline: checked again, then a failed status, nothing downloads', async () => {
  const { s, updates } = setup({ known: '0.6.1', found: '0.6.1', checkFails: [true, true] });
  await updates.start();
  assert.equal(await updates.install(), null);
  assert.equal(s.checks, 2);
  assert.equal(s.downloads, 0);
  assert.deepEqual(s.sent.at(-1), { phase: 'failed', version: '0.6.1' });
  assert.equal(updates.active, false);
});

test('Install on a remembered version: a second check confirms it, then it downloads', async () => {
  const { s, updates } = setup({ known: '0.6.1', found: '0.6.1', checkFails: [true, false] });
  await updates.start();
  assert.equal(await updates.install(), null);
  assert.equal(s.checks, 2);
  assert.equal(s.installs, 1);
});

test('corner link while a sign-in or the memory assistant runs: busy, nothing happens', async () => {
  const { s, updates } = setup({ found: '0.6.1', busy: [false, true] });
  await updates.start();
  updates.later();
  assert.equal(updates.reopen(), 'pending');
  assert.equal(s.downloads, 0);
});
