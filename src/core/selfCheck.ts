// Self-check after a Claude update (1.0.1, guard 9 of docs/ideas/resilience.md): the quick no-account checks of what
// the launcher reads from Claude. Runs in the background after the cards are shown; the result goes to the log, the
// config and the diagnostics, and a calm notice shows only for a new failure. Opening accounts never depends on it.
import type { CachedClaude, ClaudeCheck } from './config.js';
import { claudeVersion } from './signIn.js';

export const CHECKS = ['exe', 'mainProfile', 'processQuery', 'accountKeys', 'cookieColumns'] as const;
export type CheckName = (typeof CHECKS)[number];

export interface SelfCheckDeps {
  /** Claude.exe found (and it exists). */
  exe(): Promise<boolean>;
  /** The main profile folder, or null when none was found. */
  mainProfile(): Promise<string | null>;
  /** The Claude process query; throws when it fails. */
  processQuery(): Promise<unknown>;
  /** Account key names in that profile's config.json (names only). */
  accountKeys(profileDir: string): Promise<string[]>;
  /** That profile's cookie files ever held a session (a never-signed-in Main has no account keys to check). */
  everSignedIn(profileDir: string): Promise<boolean>;
  /** Columns of the cookies table in a closed profile's cookie database; null = no closed profile to read (skipped). */
  cookieColumns(): Promise<string[] | null>;
}

/** The columns the card check reads (src/main/system/cookies.ts). */
export const COOKIE_COLUMNS = ['name', 'host_key', 'expires_utc', 'value', 'encrypted_value'];

export const missingCookieColumns = (columns: string[]): string[] => COOKIE_COLUMNS.filter((c) => !columns.includes(c));

/**
 * The names of the checks that failed, in CHECKS order ([] = all passed). A check that throws fails. A check with
 * nothing to look at (no main profile or one never signed in, every profile running) is skipped and keeps its
 * result from `previous` (the last saved failures).
 */
export async function runSelfCheck(deps: SelfCheckDeps, previous: readonly string[] = []): Promise<CheckName[]> {
  const failed = new Set<CheckName>();
  /** The check gives true = passed, false = failed, null = skipped. */
  const run = async (name: CheckName, check: () => Promise<boolean | null>): Promise<void> => {
    const ok = await check().catch(() => false);
    if (ok === false || (ok === null && previous.includes(name))) failed.add(name);
  };
  await run('exe', () => deps.exe());
  const profile = await deps.mainProfile().catch(() => null);
  if (profile === null) failed.add('mainProfile');
  await run('processQuery', async () => { await deps.processQuery(); return true; });
  await run('accountKeys', async () => (profile === null || !(await deps.everSignedIn(profile)) ? null
    : (await deps.accountKeys(profile)).length > 0));
  await run('cookieColumns', async () => {
    const columns = await deps.cookieColumns();
    return columns === null ? null : missingCookieColumns(columns).length === 0;
  });
  return CHECKS.filter((c) => failed.has(c));
}

/** Run on this start: Claude's version changed since the last check (or never checked), or the last one failed. */
export function shouldSelfCheck(saved: ClaudeCheck | null, version: string | null): boolean {
  return saved === null || saved.version !== version || saved.failed.length > 0;
}

/** Show the calm notice: a check fails now that did not fail last time (repeats and fixes only log). */
export function shouldNotify(saved: ClaudeCheck | null, failed: readonly string[]): boolean {
  const before = saved?.failed ?? [];
  return failed.some((f) => !before.includes(f));
}

/**
 * Claude changed since the last start (round 1 of the card checks uses the all-flip rule): the cached exe is gone
 * (the MSIX folder changes on every update), or a click in the previous session cached a new exe whose version is
 * not the one the last self-check saw. No cached exe yet = nothing to compare.
 */
export function claudeChangedSince(
  cached: CachedClaude | null, check: ClaudeCheck | null, exists: (file: string) => boolean,
): boolean {
  if (cached === null) return false;
  return !exists(cached.exe) || claudeVersion(cached.exe) !== check?.version; // compared for a change only
}
