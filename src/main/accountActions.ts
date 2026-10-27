// Close this account / Remove (Phase 4.1). Processes and folders are injected, so this runs with mocks in tests.
import { pidsForProfile, type ClaudeProcess } from '../core/processes.js';

export interface AccountProcessDeps {
  /** Claude Desktop main processes. Throws when the query fails (never guess "closed"). */
  listProcesses(): Promise<ClaudeProcess[]>;
  /** Force-closes these processes and their children. */
  kill(pids: number[]): Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  closeTimeoutMs?: number;
  pollMs?: number;
}

/**
 * Ends only that profile's Claude (null = the default profile, i.e. main processes without --user-data-dir;
 * otherwise the processes with exactly that --user-data-dir) and waits until they are gone.
 * Claude hides in the tray when its window is closed, so this is the way to really close it.
 */
export async function closeProfile(deps: AccountProcessDeps, profileDir: string | null): Promise<boolean> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const pollMs = deps.pollMs ?? 500;
  const tries = Math.ceil((deps.closeTimeoutMs ?? 10_000) / pollMs);
  for (let i = 0; i <= tries; i++) {
    const pids = pidsForProfile(await deps.listProcesses(), profileDir);
    if (pids.length === 0) return true;
    if (i === 0) await deps.kill(pids);
    else await sleep(pollMs);
  }
  return false;
}

export type RemoveError = 'running' | 'closeFailed' | 'folder';

/** Deletes an extra account's profile folder. A running account is refused unless closeFirst ("Close and remove"). */
export async function removeProfile(
  deps: AccountProcessDeps & { deleteDir(dir: string): Promise<void> },
  profileDir: string,
  closeFirst: boolean,
): Promise<RemoveError | null> {
  if (pidsForProfile(await deps.listProcesses(), profileDir).length > 0) {
    if (!closeFirst) return 'running';
    if (!(await closeProfile(deps, profileDir))) return 'closeFailed';
  }
  try {
    await deps.deleteDir(profileDir);
  } catch (err) {
    console.warn(`Could not delete the profile folder: ${(err as Error).message}`);
    return 'folder';
  }
  return null;
}
