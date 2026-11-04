// Card photos (SCOPE §2.3): userData/photos/<id>.png. The renderer crops and scales the picked image (it decodes
// PNG, JPG and WebP); here the result is only checked (square PNG, small) and written, read or deleted.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PREFIX = 'data:image/png;base64,';
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** The renderer sends 256 × 256; anything far bigger is not ours. */
const MAX_SIDE = 1024;
const MAX_BYTES = 2 * 1024 * 1024;

/** `<id>.png` for a plain account id (letters, digits, dashes); null for anything that could be a path. */
export function photoFileName(id: string): string | null {
  return /^[a-z0-9][a-z0-9-]*$/.test(id) ? `${id}.png` : null;
}

/** The PNG bytes of a data URL from the renderer, or null if it is not a small square PNG. */
export function decodePhoto(dataUrl: string): Buffer | null {
  if (!dataUrl.startsWith(PREFIX) || dataUrl.length > (MAX_BYTES * 4) / 3 + PREFIX.length + 4) return null;
  const buf = Buffer.from(dataUrl.slice(PREFIX.length), 'base64');
  if (buf.length < 24 || !buf.subarray(0, 8).equals(SIGNATURE) || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return width > 0 && width === height && width <= MAX_SIDE ? buf : null;
}

/** Writes the photo; returns its file name, or null (nothing written) when the id or the image is not valid. */
export async function savePhoto(dir: string, id: string, dataUrl: string): Promise<string | null> {
  const name = photoFileName(id);
  const buf = decodePhoto(dataUrl);
  if (!name || !buf) return null;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return name;
}

/** The saved photo as a data URL for the window; null when missing or not a valid photo file name. */
export async function readPhoto(dir: string, fileName: string): Promise<string | null> {
  if (photoFileName(fileName.replace(/\.png$/, '')) !== fileName) return null;
  try {
    const url = PREFIX + (await readFile(path.join(dir, fileName))).toString('base64');
    return decodePhoto(url) ? url : null;
  } catch {
    return null;
  }
}

export async function deletePhoto(dir: string, id: string): Promise<void> {
  const name = photoFileName(id);
  if (name) await rm(path.join(dir, name), { force: true });
}
