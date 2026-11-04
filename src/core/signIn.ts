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
  /** Add account: the details typed in the dialog, saved on the new card at the end. */
  email?: string | null;
  realName?: string | null;
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
  /** The main Claude is reopened at the end: it was running with a visible window (0.5.0; before: running at all). */
  mainWasRunning: boolean;
  account: MarkerAccount;
  startedAt: number;
}

// The default profile is %LOCALAPPDATA%\Claude-Data\claude_<id> (verified on Claude 3.6556.2.0), or the old
// MSIX ...\LocalCache\Roaming\Claude as a last fallback. Either separator, so tests run on Linux too.
const SLOT = /([\\/]Claude-Data[\\/]claude_[^\\/]+|[\\/]LocalCache[\\/]Roaming[\\/]Claude)$/i;

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * The folder as a default Claude profile slot (trailing separators dropped), or null when it is not one: anything else
 * would be stashed with a marker that parseMarker rejects, so a crash could not be recovered.
 */
export function defaultSlot(dir: string): string | null {
  const slot = dir.replace(/[\\/]+$/, '');
  return SLOT.test(slot) && !slot.endsWith(STASH_SUFFIX) ? slot : null;
}

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
    account: {
      id: a.id, label: a.label, profileDir: a.profileDir, isNew: a.isNew === true,
      ...(str(a.email) ? { email: a.email } : {}), ...(str(a.realName) ? { realName: a.realName } : {}),
    },
    startedAt: typeof m.startedAt === 'number' ? m.startedAt : 0,
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

/**
 * Account-related key NAMES in config.json (values are never read): any "oauth:*" key (Claude 3.x writes
 * oauth:tokenCache / oauth:tokenCacheV2), "lastKnownAccountUuid" (Claude 4.4212, which has no oauth: key any more),
 * or any name containing "Account". Unreadable or non-object JSON gives [].
 */
export function accountKeyNames(configJson: string): string[] {
  try {
    const cfg: unknown = JSON.parse(configJson);
    if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) return [];
    return Object.keys(cfg).filter((key) =>
      key.startsWith('oauth:') || key === 'lastKnownAccountUuid' || key.includes('Account'));
  } catch {
    return [];
  }
}

/**
 * The sign-in signal, version-tolerant: the first account-related key name that was not in `baseline` (the key
 * names when the sign-in window opened), or null.
 */
export function newAccountKey(baseline: readonly string[], configJson: string): string | null {
  return accountKeyNames(configJson).find((key) => !baseline.includes(key)) ?? null;
}

/** Claude's version from its MSIX exe path (…\WindowsApps\Claude_4.4212.0.0_x64__…\app\Claude.exe), or null. */
export function claudeVersion(exe: string): string | null {
  return /[\\/]Claude_(\d+(?:\.\d+)+)_/i.exec(exe)?.[1] ?? null;
}

/** "Signed in" = the sessionKey cookie exists. Cookie names are plain text in the SQLite files; values are not read. */
export function containsSessionKey(files: Buffer[]): boolean {
  return files.some((f) => f.includes('sessionKey'));
}
