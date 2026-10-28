// Sign-in by snapshot (WINDOWS.md §4): pure parts. The marker never holds cookies or tokens, only paths and the card.

export const STASH_SUFFIX = '.launcher-stash';
export const MARKER_VERSION = 1;

export interface MarkerAccount {
  id: string;
  label: string;
  /** Where the signed-in folder goes (%USERPROFILE%\ClaudeProfiles\<id>). */
  profileDir: string;
  /** true = Add account (the card is created at the end); false = Sign in on an existing card. */
  isNew: boolean;
}

export interface Marker {
  version: number;
  /** signing-in: stash done or about to be; adopted: the session already moved to the account's folder. */
  state: 'signing-in' | 'adopted';
  /** Real folder of the default profile and its stash (same parent: the rename is atomic). */
  slot: string;
  stash: string;
  /** Whether a default profile existed and is (or is about to be) stashed. */
  stashed: boolean;
  mainWasRunning: boolean;
  account: MarkerAccount;
  startedAt: number;
  /** adopted only: the profile never got quiet before the force-end, so the save may be incomplete. */
  unsure?: true;
}

// The default profile is %LOCALAPPDATA%\Claude-Data\claude_<id> (verified on Claude 3.6556.2.0), or the old
// MSIX ...\LocalCache\Roaming\Claude as a last fallback. Either separator, so tests run on Linux too.
const SLOT = /([\\/]Claude-Data[\\/]claude_[^\\/]+|[\\/]LocalCache[\\/]Roaming[\\/]Claude)$/i;

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Validates a marker read from disk; null if it is not one we wrote. */
export function parseMarker(raw: unknown): Marker | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const a = m.account as Record<string, unknown> | null;
  if (m.state !== 'signing-in' && m.state !== 'adopted') return null;
  if (!str(m.slot) || !SLOT.test(m.slot) || m.stash !== m.slot + STASH_SUFFIX) return null;
  if (typeof a !== 'object' || a === null || !str(a.id) || !str(a.label) || !str(a.profileDir)) return null;
  return {
    version: MARKER_VERSION,
    state: m.state,
    slot: m.slot,
    stash: m.stash,
    stashed: m.stashed === true,
    mainWasRunning: m.mainWasRunning === true,
    account: { id: a.id, label: a.label, profileDir: a.profileDir, isNew: a.isNew === true },
    startedAt: typeof m.startedAt === 'number' ? m.startedAt : 0,
    ...(m.unsure === true ? { unsure: true as const } : {}),
  };
}

/**
 * Claude writes "oauth:tokenCache" / "oauth:tokenCacheV2" into config.json once signed in (a fresh profile has
 * neither). Only the key NAMES are looked at, never their values. Signing out does not remove them.
 */
export function hasOauth(configJson: string): boolean {
  try {
    const cfg: unknown = JSON.parse(configJson);
    if (typeof cfg !== 'object' || cfg === null) return false;
    return Object.keys(cfg).some((key) => key === 'oauth:tokenCache' || key === 'oauth:tokenCacheV2');
  } catch {
    return false;
  }
}

/** "Signed in" = the sessionKey cookie exists. Cookie names are plain text in the SQLite files; values are not read. */
export function containsSessionKey(files: Buffer[]): boolean {
  return files.some((f) => f.includes('sessionKey'));
}

/** Files of a profile folder: relative path → "mtime:size". Names and stats only, never contents. */
export type FolderSnapshot = Map<string, string>;

/** Relative paths added, removed or changed (mtime or size) between two snapshots, sorted. */
export function changedPaths(before: FolderSnapshot, after: FolderSnapshot): string[] {
  const changed = new Set<string>();
  for (const [file, stat] of after) if (before.get(file) !== stat) changed.add(file);
  for (const file of before.keys()) if (!after.has(file)) changed.add(file);
  return [...changed].sort();
}

export const sameSnapshot = (a: FolderSnapshot, b: FolderSnapshot): boolean => changedPaths(a, b).length === 0;

/** One log line: count, files per top folder, then the first `max` paths. */
export function describeChanges(paths: string[], max = 80): string {
  if (paths.length === 0) return 'none';
  const perTop = new Map<string, number>();
  for (const p of paths) {
    const top = p.split(/[\\/]/)[0];
    perTop.set(top, (perTop.get(top) ?? 0) + 1);
  }
  const tops = [...perTop].sort((a, b) => b[1] - a[1]).map(([top, n]) => `${top} ${n}`).join(', ');
  const more = paths.length > max ? ` (+${paths.length - max} more)` : '';
  return `${paths.length} files (${tops}): ${paths.slice(0, max).join(', ')}${more}`;
}
