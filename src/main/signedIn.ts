// "Not signed in" label for extra accounts. Signed in = the claude.ai sessionKey cookie OR the oauth:tokenCache keys
// in config.json (0.4.4: the desktop app's sign-in lives in config.json; a sign-in force-ended before Chromium's lazy
// cookie write still opens signed in). Names only, never values. The keys stay after a sign-out inside Claude.
import type { Account } from '../core/config.js';

export interface SignedInDeps {
  /** From the cookie database; null = it cannot be read. */
  sessionCookie(profileDir: string): Promise<boolean | null>;
  /** The oauth:tokenCache* key names in config.json. */
  configOauth(profileDir: string): Promise<boolean>;
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
      const now = (await this.deps.sessionCookie(a.profileDir)) === true || (await this.deps.configOauth(a.profileDir));
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
