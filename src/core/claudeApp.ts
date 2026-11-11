// Finding Claude.exe without starting PowerShell on every click: the cached path is used while the file exists
// (a Claude update changes the WindowsApps folder, so a missing file means "look it up again").
import path from 'node:path';
import type { ActionError } from './api.js';
import type { CachedClaude } from './config.js';

export type { CachedClaude } from './config.js';

export type ClaudeLookup =
  | { state: 'found'; app: CachedClaude; source: 'cache' | 'lookup' | 'old install' }
  /** The lookup completed and found no Claude package (nor the old install). */
  | { state: 'notInstalled' }
  /** The lookup did not complete (e.g. PowerShell timed out twice): never reported as "not installed". */
  | { state: 'failed'; reason: string };

export interface FindClaudeDeps {
  cached: CachedClaude | null;
  exists(file: string): boolean;
  /** The PowerShell lookup (Get-AppxPackage). */
  lookUp(): Promise<ClaudeLookup>;
  /** Stores a new result in the launcher config. A failure only warns. */
  save(app: CachedClaude): Promise<void>;
}

export async function findClaudeApp(deps: FindClaudeDeps): Promise<ClaudeLookup> {
  const { cached } = deps;
  if (cached && deps.exists(cached.exe)) return { state: 'found', app: cached, source: 'cache' };
  const found = await deps.lookUp();
  if (found.state === 'found' && found.source === 'lookup'
    && (cached?.exe !== found.app.exe || cached.family !== found.app.family)) {
    await deps.save(found.app).catch((err: unknown) =>
      console.warn(`Could not save the Claude.exe path: ${(err as Error).message}`));
  }
  return found;
}

/** One package from the Get-AppxPackage script (src/main/system/claudeApp.ts); Executables come from its manifest. */
export interface AppxPackage {
  Name?: unknown;
  Publisher?: unknown;
  InstallLocation?: unknown;
  PackageFamilyName?: unknown;
  Executables?: unknown;
}

const isClaudeExeName = (exe: unknown): exe is string => typeof exe === 'string' && /(^|[\\/])claude\.exe$/i.test(exe);

/**
 * Claude.exe and its PackageFamilyName from the installed packages (1.0.1, guards 5 and 7 of docs/ideas/resilience.md).
 * Package: the one named exactly "Claude" first, else one published by Anthropic whose manifest declares a Claude.exe.
 * Exe: the manifest's Claude.exe application, else app\Claude.exe (the layout of every version seen so far).
 * Only an exe that exists is returned.
 */
export function pickClaudePackage(packages: AppxPackage[], exists: (file: string) => boolean): CachedClaude | null {
  const exes = (p: AppxPackage): string[] =>
    (Array.isArray(p.Executables) ? p.Executables : [p.Executables]).filter(isClaudeExeName);
  const named = packages.filter((p) => p?.Name === 'Claude');
  const anthropic = packages.filter((p) => p?.Name !== 'Claude' && typeof p?.Publisher === 'string'
    && /anthropic/i.test(p.Publisher) && exes(p).length > 0);
  for (const pkg of [...named, ...anthropic]) {
    if (typeof pkg.InstallLocation !== 'string' || !pkg.InstallLocation) continue;
    const family = typeof pkg.PackageFamilyName === 'string' && pkg.PackageFamilyName ? pkg.PackageFamilyName : null;
    for (const rel of [...exes(pkg), 'app\\Claude.exe']) {
      const exe = path.win32.join(pkg.InstallLocation, rel);
      if (exists(exe)) return { exe, family };
    }
  }
  return null;
}

/** The error to show for a lookup, or null when Claude was found. */
export function lookupError(lookup: ClaudeLookup): ActionError | null {
  if (lookup.state === 'found') return null;
  return lookup.state === 'notInstalled' ? 'notInstalled' : 'lookupFailed';
}
