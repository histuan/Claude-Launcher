// Self-check after a Claude update (1.0.1, guard 9 of docs/ideas/resilience.md): the quick no-account checks of what
// the launcher reads from Claude. Runs in the background after the cards are shown; the result goes to the log, the
// config and the diagnostics, and a calm notice shows only for a new failure. Opening accounts never depends on it.
import type { ClaudeCheck } from './config.js';

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
  /** Columns of the cookies table in a closed profile's cookie database; null = no closed profile to read (skipped). */
  cookieColumns(): Promise<string[] | null>;
}

/** The columns the card check reads (src/main/system/cookies.ts). */
export const COOKIE_COLUMNS = ['name', 'host_key', 'expires_utc', 'value', 'encrypted_value'];

export const missingCookieColumns = (columns: string[]): string[] => COOKIE_COLUMNS.filter((c) => !columns.includes(c));

/** The names of the checks that failed, in CHECKS order ([] = all passed). A check that throws fails. */
export async function runSelfCheck(deps: SelfCheckDeps): Promise<CheckName[]> {
  const failed: CheckName[] = [];
  const pass = async (name: CheckName, check: () => Promise<boolean>): Promise<void> => {
    if (!(await check().catch(() => false))) failed.push(name);
  };
  await pass('exe', () => deps.exe());
  const profile = await deps.mainProfile().catch(() => null);
  if (profile === null) failed.push('mainProfile');
  await pass('processQuery', async () => { await deps.processQuery(); return true; });
  // Without a main profile there is no config.json to look at: only mainProfile fails.
  if (profile !== null) await pass('accountKeys', async () => (await deps.accountKeys(profile)).length > 0);
  await pass('cookieColumns', async () => {
    const columns = await deps.cookieColumns();
    return columns === null || missingCookieColumns(columns).length === 0;
  });
  return failed;
}

/** Run on this start: Claude's version changed since the last check (or never checked), or the last one failed. */
export function shouldSelfCheck(saved: ClaudeCheck | null, version: string | null): boolean {
  return saved === null || saved.version !== version || saved.failed.length > 0;
}

/** Show the calm notice: something fails now that did not fail the same way last time (repeats only log). */
export function shouldNotify(saved: ClaudeCheck | null, failed: readonly string[]): boolean {
  const before = saved?.failed ?? [];
  return failed.length > 0 && (failed.length !== before.length || failed.some((f) => !before.includes(f)));
}
