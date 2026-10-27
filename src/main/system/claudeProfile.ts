// Where the default Claude profile really lives, plus the small Windows helpers the sign-in flow needs.
import { execFile } from 'node:child_process';
import { readFile, statfs } from 'node:fs/promises';
import path from 'node:path';
import { defaultProfileFromProcesses, type RawProcess } from '../../core/processes.js';
import { hasOauth, STASH_SUFFIX } from '../../core/signIn.js';
import type { RunPowerShell } from './windowsUser.js';

const FAMILY_SCRIPT = '[Console]::OutputEncoding = [Text.Encoding]::UTF8; '
  + 'ConvertTo-Json -Compress -InputObject @(Get-AppxPackage *Claude* | Select-Object Name, PackageFamilyName)';

async function packageFamilyName(run: RunPowerShell): Promise<string | null> {
  const out = (await run(FAMILY_SCRIPT)).trim();
  const data: unknown = out ? JSON.parse(out) : [];
  const pkgs = (Array.isArray(data) ? data : [data]) as { Name?: unknown; PackageFamilyName?: unknown }[];
  const pkg = pkgs.find((p) => p?.Name === 'Claude' && typeof p.PackageFamilyName === 'string' && p.PackageFamilyName);
  return pkg ? (pkg.PackageFamilyName as string) : null;
}

export interface ProfileCandidate {
  /** process: --user-data-dir of the running default Claude; package: Claude-Data\<family name>;
   *  scan: other Claude-Data\claude_* folders; msix: old LocalCache path (last fallback). */
  source: 'process' | 'package' | 'scan' | 'msix';
  path: string;
  hasCookies: boolean;
}

export interface DefaultProfile {
  /** The default profile folder, or null when none can be trusted (then sign-in stays off). */
  slot: string | null;
  /** Every folder looked at, in order (paths only, for the diagnostics log). */
  checked: ProfileCandidate[];
  errors: string[];
}

export interface ProfileLookupDeps {
  run: RunPowerShell;
  env: Record<string, string | undefined>;
  listClaudeProcesses(): Promise<RawProcess[]>;
  exists(file: string): boolean;
  listDir(dir: string): string[];
}

/**
 * Finds the real folder of the default Claude profile (verified on Claude 3.6556.2.0:
 * %LOCALAPPDATA%\Claude-Data\claude_<publisher id>, not the MSIX LocalCache). Order:
 * 1. --user-data-dir of the running default Claude's children; 2. Claude-Data\<PackageFamilyName lowercased>;
 * 3. any Claude-Data\claude_* folder; 4. Packages\<family>\LocalCache\Roaming\Claude.
 * A folder is accepted only if it holds Network\Cookies or Cookies. Nothing is hard-coded.
 */
export async function resolveDefaultProfile(deps: ProfileLookupDeps): Promise<DefaultProfile> {
  const checked: ProfileCandidate[] = [];
  const errors: string[] = [];
  const local = deps.env.LOCALAPPDATA;
  const consider = (source: ProfileCandidate['source'], dir: string): string | null => {
    if (checked.some((c) => c.path.toLowerCase() === dir.toLowerCase())) return null;
    const hasCookies = deps.exists(path.win32.join(dir, 'Network', 'Cookies')) || deps.exists(path.win32.join(dir, 'Cookies'));
    checked.push({ source, path: dir, hasCookies });
    return hasCookies ? dir : null;
  };
  const done = (slot: string): DefaultProfile => ({ slot, checked, errors });

  try {
    const dir = defaultProfileFromProcesses(await deps.listClaudeProcesses());
    if (dir && consider('process', dir)) return done(dir);
  } catch (err) {
    errors.push(`process query: ${(err as Error).message}`);
  }
  if (!local) return { slot: null, checked, errors: [...errors, 'LOCALAPPDATA is not set'] };

  let family: string | null = null;
  try {
    family = await packageFamilyName(deps.run);
  } catch (err) {
    errors.push(`Get-AppxPackage: ${(err as Error).message}`);
  }
  const data = path.win32.join(local, 'Claude-Data');
  if (family) {
    const dir = path.win32.join(data, family.toLowerCase());
    if (consider('package', dir)) return done(dir);
  }
  let names: string[] = [];
  try {
    names = deps.listDir(data);
  } catch {
    // no Claude-Data folder
  }
  for (const name of names.filter((n) => /^claude_/i.test(n) && !n.endsWith(STASH_SUFFIX)).sort()) {
    const dir = path.win32.join(data, name);
    if (consider('scan', dir)) return done(dir);
  }
  if (family) {
    const dir = path.win32.join(local, 'Packages', family, 'LocalCache', 'Roaming', 'Claude');
    if (consider('msix', dir)) return done(dir);
  }
  return { slot: null, checked, errors };
}

/** Plain-text diagnostics (paths and yes/no only, never file contents) for a user to attach to a report. */
export function describeProfileLookup(result: DefaultProfile, when: Date): string {
  const lines = [`Default Claude profile lookup, ${when.toISOString()}`];
  for (const c of result.checked) lines.push(`  [${c.source}] ${c.path}  cookies: ${c.hasCookies ? 'yes' : 'no'}`);
  if (result.checked.length === 0) lines.push('  (no candidate folder found)');
  for (const e of result.errors) lines.push(`  error: ${e}`);
  lines.push(`Result: ${result.slot ?? 'none (sign-in disabled)'}`, '');
  return lines.join('\n');
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
