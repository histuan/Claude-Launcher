// 0.6.2: the launcher started while the update installer is still running (it would open the OLD version).
// Decided from electron-updater's pending update info plus the installer process itself, never by guessing.
import path from 'node:path';
import type { RawProcess } from './processes.js';

/** The installer starts right after the download; an update-info.json older than this is not a running install. */
export const INSTALL_WINDOW_MS = 10 * 60_000;

/** The installer file name from `<updater cache>\pending\update-info.json`: a plain `.exe` name, else null. */
export function pendingInstallerName(json: string): string | null {
  try {
    const data: unknown = JSON.parse(json);
    const name = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).fileName : null;
    return typeof name === 'string' && /^[^\\/:*?"<>|]+\.exe$/i.test(name) ? name : null;
  } catch {
    return null;
  }
}

/** Worth a process query only when an update was downloaded in the last minutes and the installer did not start us. */
export function mayBeInstalling(savedMs: number | null, nowMs: number, argv: string[]): boolean {
  if (savedMs === null || argv.includes('--updated')) return false;
  const age = nowMs - savedMs;
  return age >= 0 && age <= INSTALL_WINDOW_MS;
}

/** A process runs from exactly that installer file. */
export function installerRunning(processes: RawProcess[], installer: string): boolean {
  const norm = (p: string): string => path.win32.normalize(p).toLowerCase();
  const target = norm(installer);
  return processes.some((p) => p.exe !== null && norm(p.exe) === target);
}

/** `updaterCacheDirName` from app-update.yml (written by electron-builder), or null. */
export function updaterCacheDirName(yml: string): string | null {
  const m = /^updaterCacheDirName:\s*['"]?([A-Za-z0-9._-]+)['"]?\s*$/m.exec(yml);
  return m ? m[1]! : null;
}
