// "Not signed in" label for extra accounts: a valid claude.ai sessionKey cookie is the signal (names, expiry and
// value lengths only, never values). The oauth:tokenCache keys in config.json only when the cookie database cannot be
// read: they stay after a sign-out. Each decision is logged per account, without secrets.
import type { Account } from '../core/config.js';
import type { CookieCheck } from './system/cookies.js';

export interface SignedInDeps {
  /** From a temporary copy of the cookie database. */
  sessionCookie(profileDir: string): Promise<CookieCheck>;
  /** Fallback only: the oauth:tokenCache* key names in config.json. */
  configOauth(profileDir: string): Promise<boolean>;
  /** One line per account when its decision changes (e.g. "card check work: cookie not found"). */
  log?(line: string): void;
  now?(): number;
  sleep?(ms: number): Promise<void>;
  /** A running account is read again after this long (default ~30 s). */
  recheckMs?: number;
  /** A closed profile whose copy failed (a child process may still hold the file) is retried this often. */
  retries?: number;
  retryMs?: number;
}

const LABELS: Record<Exclude<CookieCheck['state'], 'unreadable'>, string> = {
  found: 'cookie found', missing: 'cookie not found', expired: 'cookie expired', empty: 'cookie empty',
};

export class SignedInTracker {
  private readonly known = new Map<string, { signedIn: boolean; at: number }>();
  private readonly logged = new Map<string, string>();

  constructor(private readonly deps: SignedInDeps) {}

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  /**
   * Ids of the extra accounts that are not signed in. A running profile keeps its last known state for ~30 s (Claude
   * writes its cookie file only from time to time); then it is read again. A failed copy while running never turns a
   * card into "Not signed in": the last known state stays.
   */
  async signedOut(accounts: Account[], runningIds: string[]): Promise<string[]> {
    const extra = accounts.filter((a): a is Account & { profileDir: string } => a.profileDir !== null);
    const signedIn = await Promise.all(extra.map((a) => this.check(a.id, a.profileDir, runningIds.includes(a.id))));
    return extra.filter((_a, i) => !signedIn[i]).map((a) => a.id);
  }

  private async check(id: string, profileDir: string, running: boolean): Promise<boolean> {
    const last = this.known.get(id);
    if (running && last && this.now() - last.at < (this.deps.recheckMs ?? 30_000)) return last.signedIn;
    let cookie = await this.deps.sessionCookie(profileDir);
    if (!running) {
      const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
      for (let i = 0; cookie.state === 'unreadable' && i < (this.deps.retries ?? 2); i++) {
        await sleep(this.deps.retryMs ?? 700);
        cookie = await this.deps.sessionCookie(profileDir);
      }
    }
    let signedIn: boolean;
    let decision: string;
    if (cookie.state !== 'unreadable') {
      signedIn = cookie.state === 'found';
      decision = LABELS[cookie.state];
    } else if (running && last) {
      signedIn = last.signedIn;
      decision = `cookie DB unreadable (${cookie.reason}) while running -> kept: ${signedIn ? 'signed in' : 'not signed in'}`;
    } else {
      signedIn = await this.deps.configOauth(profileDir);
      decision = `cookie DB unreadable (${cookie.reason}) -> keys fallback: ${signedIn ? 'keys found' : 'no keys'}`;
    }
    this.known.set(id, { signedIn, at: this.now() });
    if (this.logged.get(id) !== decision) {
      this.logged.set(id, decision);
      this.deps.log?.(`card check ${id}: ${decision}`);
    }
    return signedIn;
  }

  /** Drops the remembered state (after a sign-in or a remove), so the next check reads the profile again. */
  forget(id: string): void {
    this.known.delete(id);
  }
}
