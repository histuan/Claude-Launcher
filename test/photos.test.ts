// Change photo: the renderer sends a PNG data URL (already cropped and scaled); main checks it and keeps it in
// userData/photos/<id>.png. Only plain account ids become file names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decodePhoto, deletePhoto, photoFileName, readPhoto, savePhoto } from '../src/main/photos.js';

/** Minimal PNG header: signature + IHDR with the given size (enough for the checks). */
function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
const url = (buf: Buffer): string => `data:image/png;base64,${buf.toString('base64')}`;

test('decodePhoto: only a small square PNG data URL', () => {
  assert.ok(decodePhoto(url(png(256, 256))));
  assert.equal(decodePhoto(url(png(256, 200))), null, 'not square');
  assert.equal(decodePhoto(url(png(2048, 2048))), null, 'too large');
  assert.equal(decodePhoto(`data:image/jpeg;base64,${png(256, 256).toString('base64')}`), null);
  assert.equal(decodePhoto('data:image/png;base64,aGVsbG8gd29ybGQgaGVsbG8gd29ybGQgaGVsbG8='), null, 'not a PNG');
  assert.equal(decodePhoto('file:///C:/x.png'), null);
});

test('file names: only plain ids (no paths)', () => {
  assert.equal(photoFileName('main'), 'main.png');
  assert.equal(photoFileName('trabalho-agil-2'), 'trabalho-agil-2.png');
  for (const bad of ['..', '../x', 'a\\b', 'a/b', '', 'A B']) assert.equal(photoFileName(bad), null, bad);
});

test('save, read back as a data URL, delete', async (t) => {
  const dir = path.join(await mkdtemp(path.join(os.tmpdir(), 'photos-')), 'photos');
  t.after(() => rm(path.dirname(dir), { recursive: true, force: true }));
  const data = url(png(256, 256));
  assert.equal(await savePhoto(dir, 'work', data), 'work.png');
  assert.deepEqual(await readFile(path.join(dir, 'work.png')), png(256, 256));
  assert.equal(await readPhoto(dir, 'work.png'), data);
  assert.equal(await savePhoto(dir, 'work', 'data:image/png;base64,AAAA'), null, 'invalid: nothing written');
  assert.equal(await savePhoto(dir, '../evil', data), null);
  assert.equal(await readPhoto(dir, '../x.png'), null);
  assert.equal(await readPhoto(dir, 'missing.png'), null);
  await deletePhoto(dir, 'work');
  assert.equal(existsSync(path.join(dir, 'work.png')), false);
  await deletePhoto(dir, 'work'); // already gone: no error
});
