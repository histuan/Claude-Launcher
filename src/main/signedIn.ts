// "Not signed in" label for extra accounts. Names only, never values:
// - the claude.ai sessionKey cookie → signed in (and a pending flag is cleared);
// - no cookie → signed in only while the account is cookiePending (just signed in: Claude was force-ended before its
//   lazy cookie write) AND the oauth:tokenCache keys are in config.json. The keys alone are not enough: they stay
//   after a sign-out inside Claude;
// - cookie database unreadable → the keys decide.
import type { Account } from '../core/config.js';

export interface SignedInDeps {
  /** From the cookie database; null = it cannot be read. */
  sessionCookie(profileDir: string): Promise<boolean | null>;
  /** The oauth:tokenCache* key names in config.json. */
  configOauth(profileDir: string): Promise<boolean>;
  /** The cookie showed up for a cookiePending account: clear its flag. */
  cookieWritten?(id: string): void;
}

export class SignedInTracker {
  private readonly known = new Map<string, boolean>();

  constructor(private readonly deps: SignedInDeps) {}

  /**
   * Ids of the extra accounts that are not signed in. A running profile keeps its last known state: Claude holds
   * its cookie file open and writes it only from time to time.
   */
  async signedOut(accounts: Account[], runningIds: string[]): Promise<string[]> {
    const extra = accounts.filter((a): a is Account & { profileDir: string } => a.profileDir !== null);
    const signedIn = await Promise.all(extra.map(async (a) => {
      const last = this.known.get(a.id);
      if (last !== undefined && runningIds.includes(a.id)) return last;
      const cookie = await this.deps.sessionCookie(a.profileDir);
      if (cookie === true && a.cookiePending) this.deps.cookieWritten?.(a.id);
      const now = cookie === true
        || ((cookie === null || a.cookiePending === true) && (await this.deps.configOauth(a.profileDir)));
      this.known.set(a.id, now);
      return now;
    }));
    return extra.filter((_a, i) => !signedIn[i]).map((a) => a.id);
  }

  /** Drops the remembered state (after a sign-in or a remove), so the next check reads the profile again. */
  forget(id: string): void {
    this.known.delete(id);
  }
}
