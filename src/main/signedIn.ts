// "Not signed in" label for extra accounts. A valid claude.ai sessionKey cookie means signed in (names, expiry and
// value lengths, never values). Claude locks its cookie database while it runs (PC test of 0.4.5), so a running
// account is not read: it keeps its last known state. When an account stops running, the file can stay locked for a
// few seconds: it is read again every ~1 s for up to ~10 s ("Checking…" on the card meanwhile). Each final decision
// is logged.
// 0.5.0: the cards never wait for a read. cards() answers at once from the last known state (seeded from the config);
// check() starts the reads in the background, saves each new state and tells the window to redraw when needed.
// 1.0.1 (docs/ideas/resilience.md, guards 2 and 3): a second vote from the account key NAMES in the profile's
// config.json; "unknown" is never shown as "not signed in": when the two signals disagree, when every signed-in card
// flips at once right after a Claude update, or while the last self-check has failures.
import type { Account } from '../core/config.js';
import { cardState, type CardState } from '../core/signIn.js';
import type { CookieCheck } from './system/cookies.js';

export interface SignedInDeps {
  /** From a temporary copy of the cookie database. */
  sessionCookie(profileDir: string): Promise<CookieCheck>;
  /** Account key names in <profile>\config.json (names only); [] = none or no file; null = unreadable. */
  accountKeys(profileDir: string): Promise<string[] | null>;
  /** Claude changed since the last start (its cached exe is gone): the first round uses the all-flip rule. */
  claudeChanged?(): boolean;
  /** The latest self-check has failures: no card is shown as "not signed in". */
  checkFailed?(): boolean;
  /** One line per final decision (e.g. "card check work: cookie not found"). No cookie data. */
  log?(line: string): void;
  /** The cards must be drawn again ("Checking…" started, or a read changed what a card shows). */
  onChange?(): void;
  /** A read gave a new state: remember it in the config (shown at once on the next start). null = unknown. */
  save?(id: string, signedIn: boolean | null): void;
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

const KNOWN: Record<CardState, boolean | null> = { signedIn: true, signedOut: false, unknown: null };

export class SignedInTracker {
  /** Last known state; null or missing = unknown (never read, or the signals were not sure). */
  private readonly known = new Map<string, boolean | null>();
  /** Closed accounts already decided since they last ran. */
  private readonly done = new Set<string>();
  /** Reads in progress; `loop` resolves when the decision is final. */
  private readonly loops = new Map<string, Promise<void>>();
  /** Closed accounts whose first copy failed and are being retried ("Checking…"). */
  private readonly retrying = new Set<string>();
  /** First round after a Claude change: "signed in → not signed in" decisions wait for the whole round. */
  private flips: Map<string, string> | null = null;
  /** In that round: the cards that read as signed in. */
  private readIn = new Set<string>();
  private flipRound: Promise<void> | null = null;
  private firstCheck = true;
  /** Every signed-in card read as signed out right after a Claude update (shown in the diagnostics). */
  unsure = false;

  constructor(private readonly deps: SignedInDeps) {}

  /** Last known states from the config (only where nothing was read yet). */
  seed(accounts: Account[]): void {
    for (const a of accounts) {
      if (a.profileDir !== null && a.signedIn !== null && !this.known.has(a.id)) this.known.set(a.id, a.signedIn);
    }
  }

  /** What the cards show now; never waits for a read. */
  cards(accounts: Account[], runningIds: string[]): CardChecks {
    const extra = accounts.filter((a) => a.profileDir !== null);
    return {
      signedOut: extra.filter((a) => this.known.get(a.id) === false).map((a) => a.id),
      checking: extra.filter((a) => this.retrying.has(a.id) && !runningIds.includes(a.id)).map((a) => a.id),
    };
  }

  /** Extra accounts whose state is unknown (for the diagnostics). */
  unknown(accounts: Account[]): string[] {
    return accounts.filter((a) => a.profileDir !== null && (this.known.get(a.id) ?? null) === null).map((a) => a.id);
  }

  /** Starts a background read for each closed extra account not decided since it last ran. Never awaited. */
  check(accounts: Account[], runningIds: string[]): void {
    const flipRound = this.firstCheck && (this.deps.claudeChanged?.() ?? false);
    this.firstCheck = false;
    if (flipRound) this.flips = new Map();
    const before = new Map(this.known);
    const started: string[] = [];
    for (const a of accounts) {
      if (a.profileDir === null) continue;
      if (runningIds.includes(a.id)) {
        this.done.delete(a.id); // read again once it stops running
      } else if (!this.loops.has(a.id) && !this.done.has(a.id)) {
        this.start(a.id, a.profileDir);
        started.push(a.id);
      }
    }
    if (flipRound) this.flipRound = this.endFlipRound(started, before);
  }

  /** Resolves once the account's current retry loop (if any) has finished, and the first round's flip rule. */
  async settled(id: string): Promise<void> {
    await this.loops.get(id);
    await this.flipRound;
  }

  /** Drops the remembered state (after a sign-in or a remove), so the next check reads the profile again. */
  forget(id: string): void {
    this.known.delete(id);
    this.done.delete(id);
  }

  /**
   * Guard 2: right after a Claude update, if every signed-in card that was read now reads as signed out, the
   * detection is unsure and they all become unknown. Otherwise (one card of several, say) the flips are applied.
   */
  private async endFlipRound(ids: string[], before: Map<string, boolean | null>): Promise<void> {
    await Promise.all(ids.map((id) => this.loops.get(id)));
    const flips = this.flips ?? new Map<string, string>();
    this.flips = null;
    if (flips.size === 0) return;
    this.unsure = !ids.some((id) => before.get(id) === true && this.readIn.has(id));
    let changed = false;
    for (const [id, label] of flips) {
      changed = this.remember(id, this.unsure ? null : false) || changed;
      this.deps.log?.(`card check ${id}: ${label}${this.unsure ? ' -> unknown (every signed-in card flipped after a Claude update)' : ''}`);
    }
    if (changed) this.deps.onChange?.();
  }

  /** Reads now; if the copy fails, retries in the background ("Checking…"). */
  private start(id: string, profileDir: string): void {
    const retryMs = this.deps.retryMs ?? 1000;
    const retryForMs = this.deps.retryForMs ?? 10_000;
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let changed = false;
    const loop = (async () => {
      for (let attempt = 0; ; attempt++) {
        const cookie = await this.deps.sessionCookie(profileDir);
        if (cookie.state !== 'unreadable') {
          const keys = cookie.state === 'found' ? [] : await this.deps.accountKeys(profileDir).catch(() => null);
          let next = cardState(cookie.state, keys);
          let label = LABELS[cookie.state];
          if (next === 'unknown') label += `, account keys ${keys === null ? 'unreadable' : 'present'} -> unknown`;
          if (next === 'signedOut' && this.deps.checkFailed?.()) {
            next = 'unknown';
            label += ' -> unknown (the last self-check failed)';
          }
          if (next === 'signedOut' && this.flips && this.known.get(id) === true) {
            this.flips.set(id, label); // decided by endFlipRound once the whole round is read
            this.done.add(id);
            return;
          }
          if (next === 'signedIn' && this.flips) this.readIn.add(id);
          changed = this.remember(id, KNOWN[next]);
          return this.decide(id, label);
        }
        if (attempt >= Math.round(retryForMs / retryMs)) {
          const last = this.known.get(id);
          const kept = last == null ? 'unknown' : last ? 'signed in' : 'not signed in';
          return this.decide(id, `cookie DB unreadable (${cookie.reason}) for ~${Math.round(retryForMs / 1000)} s -> kept: ${kept}`);
        }
        if (!this.retrying.has(id)) {
          this.retrying.add(id);
          this.deps.onChange?.(); // the card shows "Checking…" from here
        }
        await sleep(retryMs);
      }
    })().catch((err: unknown) => this.decide(id, `check failed (${(err as Error).message})`)).finally(() => {
      this.loops.delete(id);
      if (this.retrying.delete(id) || changed) this.deps.onChange?.();
    });
    this.loops.set(id, loop);
  }

  /** Saves a new state; true when what the card shows ("Not signed in" or not) changed. */
  private remember(id: string, signedIn: boolean | null): boolean {
    const last = this.known.get(id);
    this.known.set(id, signedIn);
    if (last !== signedIn) this.deps.save?.(id, signedIn);
    return (last === false) !== (signedIn === false);
  }

  private decide(id: string, decision: string): void {
    this.done.add(id);
    this.deps.log?.(`card check ${id}: ${decision}`);
  }
}
