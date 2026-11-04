// Claude's "Export memory" (Settings → Memory → Export) gives a .zip of Markdown files. This reads it in memory only
// (never extracted to disk): the .md entries are inflated and joined, one heading per file. Dependency-free: the zip
// structures are parsed here and deflate goes through the web-standard DecompressionStream, available both in the
// launcher window (Chromium) and in Node (tests). Nothing here logs the content.

/** More entries than this is not a memory export. */
export const MAX_ZIP_ENTRIES = 500;
/** Real inflated size of all .md entries together (not the declared one: a zip can lie about it). */
export const MAX_ZIP_TEXT_BYTES = 2 * 1024 * 1024;
/** The .zip file itself: refused before it is read into memory. */
export const MAX_ZIP_FILE_BYTES = 20 * 1024 * 1024;

/** unsupported = encrypted, Zip64 or a compression other than stored / deflate. */
export type MemoryZipError = 'broken' | 'tooBig' | 'tooManyEntries' | 'noMemories' | 'unsupported';
export type MemoryZipResult = { text: string; files: number } | { error: MemoryZipError };

interface ZipEntry {
  name: string;
  method: number;
  encrypted: boolean;
  compressedSize: number;
  size: number;
  localOffset: number;
}

class ZipError extends Error {
  constructor(readonly code: MemoryZipError) {
    super(code);
  }
}

const utf8 = new TextDecoder('utf-8');

export async function readMemoryZip(bytes: Uint8Array): Promise<MemoryZipResult> {
  try {
    if (bytes.length > MAX_ZIP_FILE_BYTES) return { error: 'tooBig' };
    const { entries, dataEnd } = centralDirectory(bytes);
    const files = entries.filter((e) => isMemoryFile(e.name)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    if (files.length === 0) return { error: 'noMemories' };
    let budget = MAX_ZIP_TEXT_BYTES;
    const parts: string[] = [];
    for (const entry of files) {
      const data = await entryData(bytes, entry, dataEnd, budget);
      budget -= data.length;
      parts.push(`# ${entry.name}\n\n${utf8.decode(data).replace(/^﻿/, '').trim()}`);
    }
    return { text: parts.join('\n\n'), files: files.length };
  } catch (err) {
    return { error: err instanceof ZipError ? err.code : 'broken' };
  }
}

/** A Markdown file whose path stays inside the zip (any ".." segment is ignored, as are folders). */
function isMemoryFile(name: string): boolean {
  const path = name.replace(/\\/g, '/');
  return /\.md$/i.test(path) && !path.split('/').includes('..');
}

/** Reads the end-of-central-directory record and every central directory entry, with bounds checks. */
function centralDirectory(bytes: Uint8Array): { entries: ZipEntry[]; dataEnd: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  // The record is 22 bytes plus a comment of up to 65535 bytes, at the very end.
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 0xffff; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new ZipError('broken');
  const count = view.getUint16(end + 10, true);
  const cdSize = view.getUint32(end + 12, true);
  const cdOffset = view.getUint32(end + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new ZipError('unsupported'); // Zip64
  if (count > MAX_ZIP_ENTRIES) throw new ZipError('tooManyEntries');
  if (cdOffset + cdSize > end) throw new ZipError('broken');

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > cdOffset + cdSize || view.getUint32(p, true) !== 0x02014b50) throw new ZipError('broken');
    const nameLength = view.getUint16(p + 28, true);
    const next = p + 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    if (next > cdOffset + cdSize) throw new ZipError('broken');
    entries.push({
      name: utf8.decode(bytes.subarray(p + 46, p + 46 + nameLength)),
      method: view.getUint16(p + 10, true),
      encrypted: (view.getUint16(p + 8, true) & 1) === 1,
      compressedSize: view.getUint32(p + 20, true),
      size: view.getUint32(p + 24, true),
      localOffset: view.getUint32(p + 42, true),
    });
    p = next;
  }
  return { entries, dataEnd: cdOffset };
}

/** The entry's bytes, inflated in a stream that stops as soon as the real size passes the budget. */
async function entryData(bytes: Uint8Array, entry: ZipEntry, dataEnd: number, budget: number): Promise<Uint8Array> {
  if (entry.encrypted || (entry.method !== 0 && entry.method !== 8)) throw new ZipError('unsupported');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const local = entry.localOffset;
  if (local + 30 > dataEnd || view.getUint32(local, true) !== 0x04034b50) throw new ZipError('broken');
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const stop = start + entry.compressedSize;
  if (stop > dataEnd) throw new ZipError('broken');
  const compressed = bytes.slice(start, stop);

  if (entry.method === 0) {
    if (compressed.length > budget) throw new ZipError('tooBig');
    if (compressed.length !== entry.size) throw new ZipError('broken');
    return compressed;
  }
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(compressed).catch(() => undefined);
  writer.close().catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      throw new ZipError('broken');
    }
    if (chunk.done) break;
    total += chunk.value.length;
    if (total > budget) {
      await reader.cancel().catch(() => undefined);
      throw new ZipError('tooBig');
    }
    chunks.push(chunk.value);
  }
  if (total !== entry.size) throw new ZipError('broken');
  const data = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { data.set(c, at); at += c.length; }
  return data;
}
