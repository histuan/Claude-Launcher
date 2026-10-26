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
