// Finding Claude.exe without starting PowerShell on every click: the cached path is used while the file exists
// (a Claude update changes the WindowsApps folder, so a missing file means "look it up again").
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

/** The error to show for a lookup, or null when Claude was found. */
export function lookupError(lookup: ClaudeLookup): ActionError | null {
  if (lookup.state === 'found') return null;
  return lookup.state === 'notInstalled' ? 'notInstalled' : 'lookupFailed';
}
