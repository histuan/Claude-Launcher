// Which accounts are running, from the Win32_Process list (WINDOWS.md §3). Pure functions.
import path from 'node:path';
import type { Account } from './config.js';

export interface ClaudeProcess {
  pid: number;
  /** --user-data-dir value; null = default profile (Main). */
  profileDir: string | null;
}

// Claude Desktop only. The Claude Code CLI is also called claude.exe, but lives elsewhere.
const DESKTOP_EXE = /\\WindowsApps\\Claude_[^\\]+\\app\\Claude\.exe$/i;

/** Splits a Windows command line into arguments; double quotes group and are removed. */
function splitArgs(commandLine: string): string[] {
  const args: string[] = [];
  let current = '';
  let quoted = false;
  let started = false;
  for (const ch of commandLine) {
    if (ch === '"') { quoted = !quoted; started = true; continue; }
    if (!quoted && /\s/.test(ch)) {
      if (started) args.push(current);
      current = '';
      started = false;
      continue;
    }
    current += ch;
    started = true;
  }
  if (started) args.push(current);
  return args;
}

/** Parses the PowerShell JSON (one object, an array or nothing) and keeps Claude Desktop main processes. */
export function parseClaudeProcesses(json: string): ClaudeProcess[] {
  if (!json.trim()) return [];
  const data: unknown = JSON.parse(json);
  const items = Array.isArray(data) ? data : [data];
  const result: ClaudeProcess[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const { ProcessId: pid, ExecutablePath: exe, CommandLine: cmd } = item as Record<string, unknown>;
    if (typeof pid !== 'number' || typeof exe !== 'string' || !DESKTOP_EXE.test(exe)) continue;
    const args = splitArgs(typeof cmd === 'string' ? cmd : '');
    if (args.some((a) => a.startsWith('--type='))) continue; // Chromium child process
    const dirArg = args.find((a) => a.startsWith('--user-data-dir='));
    result.push({ pid, profileDir: dirArg ? dirArg.slice('--user-data-dir='.length) || null : null });
  }
  return result;
}

const samePath = (p: string): string => path.win32.normalize(p.replace(/\//g, '\\')).replace(/\\+$/, '').toLowerCase();

export function runningAccountIds(accounts: Account[], processes: ClaudeProcess[]): string[] {
  const dirs = new Set(processes.map((p) => (p.profileDir === null ? null : samePath(p.profileDir))));
  return accounts
    .filter((a) => dirs.has(a.profileDir === null ? null : samePath(a.profileDir)))
    .map((a) => a.id);
}

// ---------- Default profile from the running processes; processes using a folder ----------

export interface RawProcess {
  pid: number;
  parentPid: number | null;
  exe: string | null;
  args: string[];
}

/** Any Win32_Process JSON (one object, an array or nothing) into a plain list. */
export function parseProcessList(json: string): RawProcess[] {
  if (!json.trim()) return [];
  const data: unknown = JSON.parse(json);
  const result: RawProcess[] = [];
  for (const item of Array.isArray(data) ? data : [data]) {
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Record<string, unknown>;
    if (typeof p.ProcessId !== 'number') continue;
    result.push({
      pid: p.ProcessId,
      parentPid: typeof p.ParentProcessId === 'number' ? p.ParentProcessId : null,
      exe: typeof p.ExecutablePath === 'string' ? p.ExecutablePath : null,
      args: splitArgs(typeof p.CommandLine === 'string' ? p.CommandLine : ''),
    });
  }
  return result;
}

const argValue = (args: string[], name: string): string | null => {
  const arg = args.find((a) => a.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) || null : null;
};

/**
 * Real folder of the default profile, as the default Claude uses it right now: its main process has no
 * --user-data-dir, but its Chromium children get --user-data-dir=<profile> (seen on Claude 3.6556.2.0).
 */
export function defaultProfileFromProcesses(list: RawProcess[]): string | null {
  const desktop = list.filter((p) => p.exe !== null && DESKTOP_EXE.test(p.exe));
  const mains = new Set(desktop
    .filter((p) => argValue(p.args, '--type') === null && argValue(p.args, '--user-data-dir') === null)
    .map((p) => p.pid));
  for (const child of desktop) {
    if (child.parentPid === null || !mains.has(child.parentPid) || argValue(child.args, '--type') === null) continue;
    const dir = argValue(child.args, '--user-data-dir');
    if (dir) return dir;
  }
  return null;
}

/** Processes whose exe lives inside `dir` (e.g. the Claude Code CLI under <profile>\claude-code). */
export function pidsInsideFolder(list: RawProcess[], dir: string): number[] {
  const root = `${samePath(dir)}\\`;
  return list.filter((p) => p.exe !== null && samePath(p.exe).startsWith(root)).map((p) => p.pid);
}
