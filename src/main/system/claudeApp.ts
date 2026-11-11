// Finds, lists and opens the Claude desktop app (WINDOWS.md §1–3). The app itself is never copied or changed.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { parseClaudeProcesses, parseProcessList, type ClaudeProcess, type RawProcess } from '../../core/processes.js';
import { pickClaudePackage, type AppxPackage, type ClaudeLookup } from '../../core/claudeApp.js';
import type { RunPowerShell } from './windowsUser.js';

const UTF8 = '[Console]::OutputEncoding = [Text.Encoding]::UTF8';

/**
 * The installed packages that may be Claude (1.0.1, guard 7): named like *Claude*, or published by Anthropic (a
 * renamed package). Shared with claudeProfile.ts.
 */
export const CLAUDE_PACKAGES = "(@(Get-AppxPackage *Claude*) + @(Get-AppxPackage -Publisher '*Anthropic*') "
  + '| Sort-Object PackageFullName -Unique)';

// Guard 5: each package's application executables from its manifest (an error there leaves the list empty).
const APPX_SCRIPT = `${UTF8}; ConvertTo-Json -Compress -InputObject @(${CLAUDE_PACKAGES} | ForEach-Object { $p = $_; `
  + '$e = @(); try { $e = @((Get-AppxPackageManifest -Package $p.PackageFullName).Package.Applications.Application '
  + '| ForEach-Object { [string]$_.Executable }) } catch {}; '
  + '[pscustomobject]@{ Name = $p.Name; Publisher = $p.Publisher; InstallLocation = $p.InstallLocation; '
  + 'PackageFamilyName = $p.PackageFamilyName; Executables = $e } })';

/**
 * WMI name filter: claude.exe, plus the found exe's own file name when the manifest names another one (guard 6).
 * The name comes from a file path, so only plain file names are put into the script.
 */
function nameFilter(exe?: string | null): { wmi: string; ps: string } {
  const name = exe ? path.win32.basename(exe) : '';
  const extra = /^[\w.-]+\.exe$/i.test(name) && name.toLowerCase() !== 'claude.exe' ? name : null;
  return extra
    ? { wmi: `Name='claude.exe' OR Name='${extra}'`, ps: `claude,${extra.slice(0, -4)}` }
    : { wmi: "Name='claude.exe'", ps: 'claude' };
}

// Filtering by exe path happens in parseClaudeProcesses (tested), not here.
const processScript = (exe?: string | null): string => `${UTF8}; ConvertTo-Json -Compress -InputObject `
  + `@(Get-CimInstance Win32_Process -Filter "${nameFilter(exe).wmi}" `
  + '| Select-Object ProcessId, ParentProcessId, ExecutablePath, CommandLine)';

// Same list plus each process's main window handle (0 = no visible window, e.g. Claude running after its window was closed).
// Get-Process gives the handle, Win32_Process the command line; joined by process id.
const windowScript = (exe?: string | null): string => `${UTF8}; $w = @{}; `
  + `Get-Process -Name ${nameFilter(exe).ps} -ErrorAction SilentlyContinue `
  + '| ForEach-Object { $w[[int]$_.Id] = [int64]$_.MainWindowHandle }; '
  + `ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process -Filter "${nameFilter(exe).wmi}" `
  + "| Select-Object ProcessId, ExecutablePath, CommandLine, @{n='MainWindowHandle';e={$w[[int]$_.ProcessId]}})";

// Every process, exe path only (no command lines): to find programs running from inside a profile folder.
const ALL_PROCESSES_SCRIPT = `${UTF8}; ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process `
  + '| Select-Object ProcessId, ExecutablePath)';

/** The Claude.exe lookup: one PowerShell start can exceed 5 s on a busy PC (0.4.5 test), so ~15 s and one retry. */
const LOOKUP_TIMEOUT_MS = 15_000;
const LOOKUP_TRIES = 2;

/**
 * Looks up Claude.exe and its PackageFamilyName with Get-AppxPackage and the package manifest (the MSIX folder changes
 * on every update; package and exe choice in pickClaudePackage), then the old install in
 * %LOCALAPPDATA%\AnthropicClaude. 'notInstalled' only when the lookup completed; a lookup that failed twice (timeout, no PowerShell) is 'failed'. The app itself is never touched. Callers use the launcher's
 * cached path first (core/claudeApp.ts).
 */
export async function lookUpClaudeApp(
  run: RunPowerShell,
  env: Record<string, string | undefined>,
  exists: (file: string) => boolean,
): Promise<ClaudeLookup> {
  let out: string | null = null;
  let reason = '';
  for (let i = 0; i < LOOKUP_TRIES && out === null; i++) {
    try {
      out = (await run(APPX_SCRIPT, LOOKUP_TIMEOUT_MS)).trim();
    } catch (err) {
      reason = (err as Error).message;
      console.warn(`Get-AppxPackage failed (try ${i + 1} of ${LOOKUP_TRIES}): ${reason}`);
    }
  }
  if (out !== null) {
    try {
      const data: unknown = out ? JSON.parse(out) : [];
      const app = pickClaudePackage((Array.isArray(data) ? data : [data]) as AppxPackage[], exists);
      if (app) return { state: 'found', app, source: 'lookup' };
    } catch (err) {
      reason = `unexpected Get-AppxPackage output: ${(err as Error).message}`;
      out = null;
    }
  }
  if (env.LOCALAPPDATA) {
    const old = path.win32.join(env.LOCALAPPDATA, 'AnthropicClaude', 'claude.exe');
    if (exists(old)) return { state: 'found', app: { exe: old, family: null }, source: 'old install' };
  }
  return out === null ? { state: 'failed', reason } : { state: 'notInstalled' };
}

// `exe` (all queries below): the Claude.exe the launcher found (config cache), matched first; null = the usual path only.

/** Running Claude Desktop main processes. Throws if the query fails (the sign-in flow must not guess). */
export async function queryClaudeProcesses(run: RunPowerShell, exe?: string | null): Promise<ClaudeProcess[]> {
  return parseClaudeProcesses(await run(processScript(exe)), exe);
}

/** Claude Desktop main processes with hasWindow set (to confirm a window appeared after opening). Throws. */
export async function queryClaudeWindows(run: RunPowerShell, exe?: string | null): Promise<ClaudeProcess[]> {
  return parseClaudeProcesses(await run(windowScript(exe)), exe);
}

/** Every claude.exe with its parent and command line (to read the default profile from its children). Throws. */
export async function queryClaudeProcessList(run: RunPowerShell, exe?: string | null): Promise<RawProcess[]> {
  return parseProcessList(await run(processScript(exe)));
}

/** Every process with its exe path. Throws if the query fails. */
export async function queryAllProcesses(run: RunPowerShell): Promise<RawProcess[]> {
  return parseProcessList(await run(ALL_PROCESSES_SCRIPT));
}

/** Same, for the "Running" indicator: errors give an empty list (the indicator just stays off). */
export async function listClaudeProcesses(run: RunPowerShell, exe?: string | null): Promise<ClaudeProcess[]> {
  try {
    return await queryClaudeProcesses(run, exe);
  } catch (err) {
    console.warn(`Process query failed: ${(err as Error).message}`);
    return [];
  }
}

// user32 calls to bring a window to the front (restored first if minimised). Windows lets a process started by the
// foreground app take the foreground: this PowerShell is started by the launcher, which is the foreground app when
// the person clicks. AllowSetForegroundWindow also lets Claude's own process raise its window.
const USER32 = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); '
  + '[DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int pid); '
  + '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int cmd); '
  + '[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);';

/** The script for one pid (an integer, checked by the caller). Prints True when Windows accepted. */
function frontScript(pid: number): string {
  return `$u = Add-Type -Name Front -Namespace ClaudeLauncher -PassThru -MemberDefinition '${USER32}'; `
    + `$h = (Get-Process -Id ${pid} -ErrorAction Stop).MainWindowHandle; `
    + 'if ($h -eq [IntPtr]::Zero) { $false } else { if ($u::IsIconic($h)) { [void]$u::ShowWindowAsync($h, 9) }; '
    + `[void]$u::AllowSetForegroundWindow(${pid}); $u::SetForegroundWindow($h) }`;
}

/** Brings that Claude process's main window to the front. Best effort: false when refused or on any error, never throws. */
export async function bringToFront(run: RunPowerShell, pid: number): Promise<boolean> {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    return (await run(frontScript(pid))).trim() === 'True';
  } catch (err) {
    console.warn(`Could not bring Claude to the front: ${(err as Error).message}`);
    return false;
  }
}

interface Child {
  once(event: 'spawn', listener: () => void): unknown;
  once(event: 'error', listener: (err: Error) => void): unknown;
  unref(): void;
}
export type SpawnFn = (
  file: string,
  args: readonly string[],
  options: { detached: true; stdio: 'ignore'; windowsHide: true },
) => Child;

/** Opens Claude: Main without flag, other accounts with --user-data-dir. Resolves once the process started. */
export function launchClaude(exe: string, profileDir: string | null, spawnFn: SpawnFn = spawn): Promise<void> {
  const args = profileDir === null ? [] : [`--user-data-dir=${profileDir}`];
  const child = spawnFn(exe, args, { detached: true, stdio: 'ignore', windowsHide: true });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
