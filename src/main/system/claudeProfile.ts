// Where the default Claude profile really lives, plus the small Windows helpers the sign-in flow needs.
import { execFile } from 'node:child_process';
import { readFile, statfs } from 'node:fs/promises';
import path from 'node:path';
import { hasOauth } from '../../core/signIn.js';
import type { RunPowerShell } from './windowsUser.js';

const FAMILY_SCRIPT = '[Console]::OutputEncoding = [Text.Encoding]::UTF8; '
  + 'ConvertTo-Json -Compress -InputObject @(Get-AppxPackage *Claude* | Select-Object Name, PackageFamilyName)';

/**
 * Real folder of the default profile (MSIX redirects %APPDATA%\Claude):
 * %LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Roaming\Claude. null without an MSIX install.
 */
export async function resolveDefaultSlot(
  run: RunPowerShell,
  env: Record<string, string | undefined>,
): Promise<string | null> {
  if (!env.LOCALAPPDATA) return null;
  try {
    const out = (await run(FAMILY_SCRIPT)).trim();
    const data: unknown = out ? JSON.parse(out) : [];
    const pkgs = (Array.isArray(data) ? data : [data]) as { Name?: unknown; PackageFamilyName?: unknown }[];
    const pkg = pkgs.find((p) => p?.Name === 'Claude' && typeof p.PackageFamilyName === 'string' && p.PackageFamilyName);
    if (!pkg) return null;
    return path.win32.join(env.LOCALAPPDATA, 'Packages', pkg.PackageFamilyName as string, 'LocalCache', 'Roaming', 'Claude');
  } catch (err) {
    console.warn(`Get-AppxPackage failed: ${(err as Error).message}`);
    return null;
  }
}

export function markerFileFor(env: Record<string, string | undefined>): string | null {
  return env.LOCALAPPDATA ? path.win32.join(env.LOCALAPPDATA, 'ClaudeLauncher', 'login-pending.json') : null;
}

export async function freeBytes(dir: string): Promise<number> {
  const s = await statfs(dir);
  return s.bavail * s.bsize;
}

/** A profile counts as signed in once Claude wrote its OAuth token into config.json (only the key is checked). */
export async function isSignedIn(profileDir: string): Promise<boolean> {
  const text = await readFile(path.join(profileDir, 'config.json'), 'utf8').catch(() => '');
  return hasOauth(text);
}

export type ExecFn = (file: string, args: string[]) => Promise<void>;

const execQuiet: ExecFn = (file, args) => new Promise((resolve) => {
  // taskkill fails for a process that already exited: that is fine, the caller re-checks the list.
  execFile(file, args, { windowsHide: true, timeout: 10_000 }, () => resolve());
});

/** Force-closes the given processes and their children (taskkill /T /F), like ai-multi-instance. */
export async function killProcesses(pids: number[], exec: ExecFn = execQuiet): Promise<void> {
  for (const pid of pids) await exec('taskkill', ['/PID', String(pid), '/T', '/F']);
}
