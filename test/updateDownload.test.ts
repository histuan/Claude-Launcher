// 0.6.1: full or differential update download, read from electron-updater's log calls and progress events.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DownloadWatch } from '../src/core/updateDownload.js';

const BLOCK_MAPS = 'Download block maps (old: "https://github.com/x/old.blockmap", new: https://github.com/x/new.blockmap)';
const FALLBACK = 'Cannot download differentially, fallback to full download: Error: sha512 checksum mismatch';

test('differential: block maps fetched, no fallback; bytes = the last progress count', () => {
  const w = new DownloadWatch();
  w.logger.info(BLOCK_MAPS);
  w.logger.info('Full: 90,000 KB, To download: 2,000 KB (2%)');
  w.progress(1_000_000);
  w.progress(2_048_000);
  assert.deepEqual(w.result(), { bytes: 2_048_000, mode: 'differential' });
});

test('differential that falls back: full, and the bytes of the full download only', () => {
  const w = new DownloadWatch();
  w.logger.info(BLOCK_MAPS);
  w.progress(500_000);
  w.logger.error(FALLBACK);
  w.progress(40_000_000);
  w.progress(92_000_000);
  assert.deepEqual(w.result(), { bytes: 92_000_000, mode: 'full' });
});

test('no differential attempt: full', () => {
  const w = new DownloadWatch();
  w.progress(92_000_000);
  assert.deepEqual(w.result(), { bytes: 92_000_000, mode: 'full' });
});

test('nothing downloaded (installer already in the updater cache): cached', () => {
  const w = new DownloadWatch();
  assert.deepEqual(w.result(), { bytes: 0, mode: 'cached' });
});

test('keeps no message text (they carry URLs)', () => {
  const w = new DownloadWatch();
  w.logger.info(BLOCK_MAPS);
  w.logger.warn('https://github.com/x');
  w.logger.error(FALLBACK);
  assert.doesNotMatch(JSON.stringify(w), /http|github|sha512/);
});
