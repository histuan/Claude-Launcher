// Phase 5.1 fix: Claude's "Export memory" .zip, read in memory (no disk), .md entries only, with limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { MAX_ZIP_ENTRIES, MAX_ZIP_TEXT_BYTES, readMemoryZip } from '../src/core/memoryZip.js';

interface Entry { name: string; data: string | Buffer; stored?: boolean; declaredSize?: number }

/** Minimal zip writer (stored or deflate entries, no CRC check on the reader side). */
function zip(entries: Entry[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const body = e.stored ? raw : deflateRawSync(raw);
    const name = Buffer.from(e.name, 'utf8');
    const size = e.declaredSize ?? raw.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(e.stored ? 0 : 8, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(e.stored ? 0 : 8, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

test('normal export: .md entries joined in path order, one heading per file (deflate and stored)', async () => {
  const result = await readMemoryZip(zip([
    { name: 'memory/work.md', data: 'Works on the launcher.\n' },
    { name: 'memory/about-me.md', data: '﻿Likes short answers.', stored: true },
  ]));
  assert.deepEqual(result, {
    text: '# memory/about-me.md\n\nLikes short answers.\n\n# memory/work.md\n\nWorks on the launcher.',
    files: 2,
  });
});

test('non-.md entries and folders are ignored', async () => {
  const result = await readMemoryZip(zip([
    { name: 'memory/', data: '', stored: true },
    { name: 'memory/photo.png', data: Buffer.from([1, 2, 3]) },
    { name: 'memory/notes.txt', data: 'not a memory file' },
    { name: 'memory/a.MD', data: 'kept' },
  ]));
  assert.deepEqual(result, { text: '# memory/a.MD\n\nkept', files: 1 });
});

test('paths with ".." are ignored', async () => {
  const result = await readMemoryZip(zip([
    { name: '../evil.md', data: 'outside' },
    { name: 'memory\\..\\..\\evil.md', data: 'outside too' },
    { name: 'memory/ok.md', data: 'inside' },
  ]));
  assert.deepEqual(result, { text: '# memory/ok.md\n\ninside', files: 1 });
});

test('no .md entry at all', async () => {
  assert.deepEqual(await readMemoryZip(zip([{ name: 'a.txt', data: 'x' }])), { error: 'noMemories' });
});

test('too big: stops on the real inflated size, even when the declared size lies', async () => {
  const big = 'a'.repeat(MAX_ZIP_TEXT_BYTES + 1);
  assert.deepEqual(await readMemoryZip(zip([{ name: 'big.md', data: big, declaredSize: 10 }])), { error: 'tooBig' });
  const half = 'b'.repeat(MAX_ZIP_TEXT_BYTES / 2 + 1);
  assert.deepEqual(await readMemoryZip(zip([{ name: 'a.md', data: half }, { name: 'b.md', data: half }])), { error: 'tooBig' });
});

test('more than the maximum number of entries is refused', async () => {
  const many = Array.from({ length: MAX_ZIP_ENTRIES + 1 }, (_, i) => ({ name: `m/${i}.md`, data: 'x' }));
  assert.deepEqual(await readMemoryZip(zip(many)), { error: 'tooManyEntries' });
});

test('broken zips', async () => {
  const good = zip([{ name: 'a.md', data: 'hello hello hello hello' }]);
  assert.deepEqual(await readMemoryZip(new Uint8Array([1, 2, 3, 4])), { error: 'broken' });
  assert.deepEqual(await readMemoryZip(good.slice(0, good.length - 30)), { error: 'broken' });
  const corrupt = good.slice();
  corrupt.fill(0xff, 31, 40); // inside the deflate data
  assert.deepEqual(await readMemoryZip(corrupt), { error: 'broken' });
  const badOffset = good.slice();
  new DataView(badOffset.buffer).setUint32(badOffset.length - 6, 0xfffffff0, true); // central directory offset
  assert.deepEqual(await readMemoryZip(badOffset), { error: 'broken' });
});
