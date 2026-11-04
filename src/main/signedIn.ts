// "Not signed in" label for extra accounts. Only a valid claude.ai sessionKey cookie decides (names, expiry and value
// lengths, never values); the oauth:tokenCache keys never do (they stay after a sign-out). Claude locks its cookie
// database while it runs (PC test of 0.4.5), so a running account is not read: it keeps its last known state. When an
// account stops running, the file can stay locked for a few seconds: it is read again every ~1 s for up to ~10 s
// ("Checking…" on the card meanwhile), then the window is told to redraw. Each final decision is logged.
import type { Account } from '../core/config.js';
import type { CookieCheck } from './system/cookies.js';

export interface SignedInDeps {
  /** From a temporary copy of the cookie database. */
  sessionCookie(profileDir: string): Promise<CookieCheck>;
  /** One line per final decision (e.g. "card check work: cookie not found"). No cookie data. */
  log?(line: string): void;
  /** Called when a decision that needed retries is final (the cards must be drawn again). */
  onChange?(): void;
  sleep?(ms: number): Promise<void>;
  retryMs?: number;
  retryForMs?: number;
}

export interface CardChecks {
  /** Extra accounts whose last known state is "not signed in". */
  signedOut: string[];
  /** Closed extra accounts whose cookie database is being read again ("Checking…"). */
  checking: string[];
}

const LABELS: Record<Exclude<CookieCheck['state'], 'unreadable'>, string> = {
  found: 'cookie found', missing: 'cookie not found', expired: 'cookie expired', empty: 'cookie empty',
};

export class SignedInTracker {
  /** Last known state; missing = unknown (never read successfully). */
  private readonly known = new Map<string, boolean>();
  /** Closed accounts already decided since they last ran. */
  private readonly done = new Set<string>();
  /** Reads in progress: `first` resolves after the first read, `loop` when the decision is final. */
  private readonly loops = new Map<string, { first: Promise<void>; loop: Promise<void> }>();
  /** Closed accounts whose first copy failed and are being retried ("Checking…"). */
  private readonly retrying = new Set<string>();

  constructor(private readonly deps: SignedInDeps) {}

  async cards(accounts: Account[], runningIds: string[]): Promise<CardChecks> {
    const extra = accounts.filter((a): a is Account & { profileDir: string } => a.profileDir !== null);
    await Promise.all(extra.map(async (a) => {
      if (runningIds.includes(a.id)) {
        this.done.delete(a.id); // read again once it stops running
      } else if (this.loops.has(a.id)) {
        await this.loops.get(a.id)?.first; // a read already started (e.g. by a concurrent call)
      } else if (!this.done.has(a.id)) {
        await this.start(a.id, a.profileDir);
      }
    }));
    return {
      signedOut: extra.filter((a) => this.known.get(a.id) === false).map((a) => a.id),
      checking: extra.filter((a) => this.retrying.has(a.id) && !runningIds.includes(a.id)).map((a) => a.id),
    };
  }

  /** Resolves once the account's current retry loop (if any) has finished. */
  async settled(id: string): Promise<void> {
    await this.loops.get(id)?.loop;
  }

  /** Drops the remembered state (after a sign-in or a remove), so the next check reads the profile again. */
  forget(id: string): void {
    this.known.delete(id);
    this.done.delete(id);
  }

  /** First read now; if the copy fails, keeps retrying in the background. Resolves after the first read. */
  private start(id: string, profileDir: string): Promise<void> {
    let firstDone!: () => void;
    const first = new Promise<void>((r) => { firstDone = r; });
    const retryMs = this.deps.retryMs ?? 1000;
    const retryForMs = this.deps.retryForMs ?? 10_000;
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const loop = (async () => {
      for (let attempt = 0; ; attempt++) {
        const cookie = await this.deps.sessionCookie(profileDir);
        if (cookie.state !== 'unreadable') {
          this.known.set(id, cookie.state === 'found');
          return this.decide(id, LABELS[cookie.state]);
        }
        if (attempt >= Math.round(retryForMs / retryMs)) {
          const last = this.known.get(id);
          const kept = last === undefined ? 'unknown' : last ? 'signed in' : 'not signed in';
          return this.decide(id, `cookie DB unreadable (${cookie.reason}) for ~${Math.round(retryForMs / 1000)} s -> kept: ${kept}`);
        }
        this.retrying.add(id);
        firstDone(); // the card shows "Checking…" from here
        await sleep(retryMs);
      }
    })().catch((err: unknown) => this.decide(id, `check failed (${(err as Error).message})`)).finally(() => {
      this.loops.delete(id);
      firstDone();
      if (this.retrying.delete(id)) this.deps.onChange?.();
    });
    this.loops.set(id, { first, loop });
    return first;
  }

  private decide(id: string, decision: string): void {
    this.done.add(id);
    this.deps.log?.(`card check ${id}: ${decision}`);
  }
}
