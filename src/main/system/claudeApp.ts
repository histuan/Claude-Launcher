// Finds, lists and opens the Claude desktop app (WINDOWS.md §1–3). The app itself is never copied or changed.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { parseClaudeProcesses, parseProcessList, type ClaudeProcess, type RawProcess } from '../../core/processes.js';
import type { RunPowerShell } from './windowsUser.js';

const UTF8 = '[Console]::OutputEncoding = [Text.Encoding]::UTF8';

const APPX_SCRIPT = `${UTF8}; ConvertTo-Json -Compress -InputObject @(Get-AppxPackage *Claude* | Select-Object Name, InstallLocation)`;

// Filtering by exe path happens in parseClaudeProcesses (tested), not here.
const PROCESS_SCRIPT = `${UTF8}; ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" `
  + '| Select-Object ProcessId, ParentProcessId, ExecutablePath, CommandLine)';

// Every process, exe path only (no command lines): to find programs running from inside a profile folder.
const ALL_PROCESSES_SCRIPT = `${UTF8}; ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process `
  + '| Select-Object ProcessId, ExecutablePath)';

/**
 * Path to Claude.exe, resolved on every call (the MSIX folder changes on every update).
 * MSIX install first, then the old install in %LOCALAPPDATA%\AnthropicClaude; null if Claude is not installed.
 */
export async function resolveClaudeExe(
  run: RunPowerShell,
  env: Record<string, string | undefined>,
  exists: (file: string) => boolean,
): Promise<string | null> {
  try {
    const out = (await run(APPX_SCRIPT)).trim();
    const data: unknown = out ? JSON.parse(out) : [];
    const packages = (Array.isArray(data) ? data : [data]) as { Name?: unknown; InstallLocation?: unknown }[];
    // The package named exactly "Claude" first; *Claude* may match other packages.
    packages.sort((a, b) => Number(b?.Name === 'Claude') - Number(a?.Name === 'Claude'));
    for (const pkg of packages) {
      if (typeof pkg?.InstallLocation !== 'string' || !pkg.InstallLocation) continue;
      const exe = path.win32.join(pkg.InstallLocation, 'app', 'Claude.exe');
      if (exists(exe)) return exe;
    }
  } catch (err) {
    console.warn(`Get-AppxPackage failed: ${(err as Error).message}`);
  }
  if (env.LOCALAPPDATA) {
    const old = path.win32.join(env.LOCALAPPDATA, 'AnthropicClaude', 'claude.exe');
    if (exists(old)) return old;
  }
  return null;
}

/** Running Claude Desktop main processes. Throws if the query fails (the sign-in flow must not guess). */
export async function queryClaudeProcesses(run: RunPowerShell): Promise<ClaudeProcess[]> {
  return parseClaudeProcesses(await run(PROCESS_SCRIPT));
}

/** Every claude.exe with its parent and command line (to read the default profile from its children). Throws. */
export async function queryClaudeProcessList(run: RunPowerShell): Promise<RawProcess[]> {
  return parseProcessList(await run(PROCESS_SCRIPT));
}

/** Every process with its exe path. Throws if the query fails. */
export async function queryAllProcesses(run: RunPowerShell): Promise<RawProcess[]> {
  return parseProcessList(await run(ALL_PROCESSES_SCRIPT));
}

/** Same, for the "Running" indicator: errors give an empty list (the indicator just stays off). */
export async function listClaudeProcesses(run: RunPowerShell): Promise<ClaudeProcess[]> {
  try {
    return await queryClaudeProcesses(run);
  } catch (err) {
    console.warn(`Process query failed: ${(err as Error).message}`);
    return [];
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
