// Sign-in by snapshot (WINDOWS.md §4). The only code that writes to the default Claude profile.
// Rules: marker before the stash; the stash is only ever renamed back, never deleted; a live default
// Claude aborts; a failed restore keeps the marker and reports the exact stash path.
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SignInStatus, StartStep } from '../core/api.js';
import { isLauncherProfileDir } from '../core/config.js';
import {
  containsSessionKey, hasOauth, MARKER_VERSION, parseMarker, STASH_SUFFIX, type Marker, type MarkerAccount,
} from '../core/signIn.js';

export type StartError = 'pending' | 'defaultRunning' | 'reopened' | 'profileInUse' | 'disk' | 'folder' | 'launchFailed';

type CloseResult = 'not running' | 'graceful' | 'forced' | 'reopened' | false;

export interface SignInDeps {
  userProfile: string;
  /** %LOCALAPPDATA%\ClaudeLauncher\login-pending.json */
  markerFile: string;
  /** Main processes of the default Claude instance (no --user-data-dir). */
  listDefaultPids(): Promise<number[]>;
  /** Asks the processes to close (taskkill /T without /F). */
  closeGracefully(pids: number[]): Promise<void>;
  /** Force-ends the processes and their children (taskkill /T /F). */
  kill(pids: number[]): Promise<void>;
  /** Cheap exit check for one process (no PowerShell), polled every ~250 ms while Claude closes. */
  isAlive(pid: number): boolean;
  /** Any process whose exe lives inside `dir` (e.g. the Claude Code CLI under <profile>\claude-code). */
  listPidsInside(dir: string): Promise<number[]>;
  /** Opens Claude without flag (default profile). */
  launchDefault(): Promise<void>;
  /** Best effort, not awaited: brings the sign-in window to the front once it shows. Never fails the sign-in. */
  focusDefault?(): Promise<void>;
  freeBytes(dir: string): Promise<number>;
  onStatus(status: SignInStatus): void;
  /** Step timings for sign-in-timings.log: paths and durations only, never cookies, tokens or config values. */
  log?(line: string): void;
  minFreeBytes?: number;
  sleep?: (ms: number) => Promise<void>;
  /**
   * Start and cancel: how long a close request gets before the force-end (~1 s). Claude only hides to the tray on a
   * close request (0.4.3 test), so this is kept short.
   */
  gracefulMs?: number;
  /** Process exit poll interval during the graceful close (~250 ms). */
  exitPollMs?: number;
  /**
   * Finishing: after the oauth keys, wait for Chromium's cookie database write (Network\Cookies or its -journal /
   * -wal gets a newer mtime or another size; stat only), polled every cookiePollMs (~500 ms), at most cookieWaitMs
   * (~45 s) per wait; then cookieSettleMs (~1 s) before the force-end. Chromium commits cookies about every 30 s and
   * the sign-in needs that write (0.4.4 tests: a force-end before it opened the account signed out).
   */
  cookieWaitMs?: number;
  cookiePollMs?: number;
  cookieSettleMs?: number;
  /** "I've signed in": how long to keep checking for a saved session before saying none was found. */
  checkMs?: number;
  now?: () => number;
  /** Closing in all (close request + force-end): give up after ~10 s. */
  closeTimeoutMs?: number;
  pollMs?: number;
}

// The cookie database files whose write the finish waits for (stat only: never opened while Claude runs).
const COOKIE_DB = ['Cookies', 'Cookies-journal', 'Cookies-wal'].map((f) => path.join('Network', f));
// The login cookie lives in <profile>\Network\Cookies; plain <profile>\Cookies only in old layouts.
// Partitions\*\Network\Cookies (launch previews) are not looked at.
const COOKIE_FILES = ['Cookies', 'Cookies-journal', 'Cookies-wal'].flatMap((f) => [path.join('Network', f), f]);
const exists = (p: string): Promise<boolean> => stat(p).then(() => true, () => false);

export class SignInFlow {
  private marker: Marker | null = null;
  private busy = false;
  private checking = false;
  /** After a cap without a cookie write: waiting for the person (Wait longer / Cancel); detection paused. */
  private notSaved = false;
  /** Cookie database stats when the keys appeared (kept across "Wait longer"). */
  private cookieBase: string | null = null;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pollMs: number;

  constructor(private readonly deps: SignInDeps) {
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.pollMs = deps.pollMs ?? 500;
  }

  get active(): boolean {
    return this.marker !== null;
  }

  // ---------- Start (steps 1–4) ----------

  async start(slot: string, account: MarkerAccount): Promise<StartError | null> {
    if (!isLauncherProfileDir(account.profileDir, this.deps.userProfile)) {
      throw new Error(`Refusing a profile folder outside ClaudeProfiles: ${account.profileDir}`);
    }
    const stash = slot + STASH_SUFFIX;
    const t0 = this.now();
    if (this.marker || (await exists(this.deps.markerFile)) || (await exists(stash))) return 'pending';
    // Disk first: do not close the person's Claude for nothing.
    if ((await this.deps.freeBytes(path.parse(slot).root)) < (this.deps.minFreeBytes ?? 500 * 1024 ** 2)) return 'disk';

    this.step('closing');
    const pids = await this.deps.listDefaultPids();
    const mainWasRunning = pids.length > 0;
    // A default Claude that was not there before (the person opened it again) stops the start at once.
    const closed = await this.closeDefault({ pids, stopOnNew: true });
    this.log(`start: close main Claude: ${closed || 'still running'}`, t0);
    if (closed === 'reopened') return 'reopened';
    if (!closed) return 'defaultRunning';
    // Something else still runs from the profile folder (e.g. Claude Code in a terminal): it would lock files or
    // break when its folder moves. Do not touch it; give the person their main Claude back.
    if ((await this.deps.listPidsInside(slot)).length > 0) {
      if (mainWasRunning) await this.deps.launchDefault().catch(() => undefined);
      return 'profileInUse';
    }

    this.step('preparing');
    const t1 = this.now();
    const marker: Marker = {
      version: MARKER_VERSION, state: 'signing-in', slot, stash, stashed: await exists(slot), mainWasRunning,
      account, startedAt: Date.now(),
    };
    await this.writeMarker(marker);
    if (marker.stashed) {
      try {
        await this.move(slot, stash);
      } catch (err) {
        console.warn(`Could not stash the default profile: ${(err as Error).message}`);
        await rm(this.deps.markerFile, { force: true });
        if (mainWasRunning) await this.deps.launchDefault().catch(() => undefined);
        return 'folder';
      }
    }
    this.marker = marker;
    this.log(`start: prepare a clean profile (stashed: ${marker.stashed})`, t1);
    this.step('opening');
    const t2 = this.now();
    try {
      await this.deps.launchDefault();
    } catch (err) {
      console.warn(`Could not open the default Claude: ${(err as Error).message}`);
      await this.cancel();
      return 'launchFailed';
    }
    this.log('start: open the sign-in window', t2);
    void this.deps.focusDefault?.().catch(() => undefined);
    this.log('start: total', t0);
    this.deps.onStatus({ phase: 'waiting' });
    return null;
  }

  // ---------- Detection (step 5) ----------

  /**
   * One detection tick (every ~1 s from the main process while the dialog is open). The fast signal is the oauth key
   * NAMES appearing in config.json (a plain file, readable while Claude runs); the finish then waits for the cookie
   * database write, which the sign-in needs.
   */
  async poll(): Promise<void> {
    const marker = this.marker;
    if (!marker || this.busy || this.notSaved) return;
    if (await this.oauthKeys(marker.slot)) await this.finish();
  }

  /**
   * "I've signed in" button. Read-only check: finishes at once if the oauth keys or the session cookie are on disk; otherwise
   * keeps checking for ~15 s ("checking" with a countdown, Cancel stays available) and then reports "notFound".
   * A negative result never stashes, moves or restores anything: the sign-in simply stays open.
   */
  async confirm(): Promise<void> {
    const marker = this.marker;
    if (!marker || this.busy || this.checking || this.notSaved) return;
    this.checking = true;
    const now = this.deps.now ?? Date.now;
    const deadline = now() + (this.deps.checkMs ?? 15_000);
    let shown = -1;
    try {
      for (;;) {
        if (this.marker !== marker || this.busy) return; // cancelled, or the automatic detection is finishing
        if ((await this.oauthKeys(marker.slot)) || (await this.sessionSaved(marker.slot))) return await this.finish();
        if (this.marker !== marker || this.busy) return; // the same, after the read: never re-enable Cancel then
        const left = Math.ceil((deadline - now()) / 1000);
        if (left <= 0) break;
        if (left !== shown) this.deps.onStatus({ phase: 'checking', secondsLeft: left });
        shown = left;
        await this.sleep(this.pollMs);
      }
      if (this.marker === marker && !this.busy) this.deps.onStatus({ phase: 'notFound' });
    } finally {
      this.checking = false;
    }
  }

  // ---------- Finish (steps 6–7) ----------

  private async finish(): Promise<void> {
    const marker = this.marker;
    if (!marker || this.busy) return;
    this.busy = true;
    try {
      this.deps.onStatus({ phase: 'saving' });
      const t0 = this.now();
      // A close request never works (Claude hides to the tray), so Claude is force-ended, but only after its cookie
      // database write: a forced end loses what is not committed yet. No write within the cap: nothing moves.
      const written = await this.waitForCookieWrite(marker.slot);
      this.log(`finish: wait for the cookie write: ${written ? 'written' : 'cap'}`, t0);
      if (!written) {
        this.notSaved = true;
        this.deps.onStatus({ phase: 'notSaved' });
        return;
      }
      await this.sleep(this.deps.cookieSettleMs ?? 1000);
      const closed = await this.closeDefault({ gracefulMs: 0 });
      this.log(`finish: close the sign-in Claude: ${closed || 'still running'}`, t0);
      if (!closed) return this.failed(marker);
      try {
        await rm(marker.account.profileDir, { recursive: true, force: true, maxRetries: 3 }); // never-signed-in card
        await mkdir(path.dirname(marker.account.profileDir), { recursive: true });
        await this.move(marker.slot, marker.account.profileDir);
      } catch (err) {
        console.warn(`Could not move the new session: ${(err as Error).message}`);
        return await this.restore(marker, { phase: 'failed', stashPath: null });
      }
      const adopted: Marker = { ...marker, state: 'adopted' };
      await this.writeMarker(adopted);
      this.log('finish: move the session to the account folder', t0);
      await this.restore(adopted, { phase: 'done', account: marker.account });
      this.log('finish: total (main profile restored)', t0);
    } catch (err) {
      // E.g. the process query failed: keep the marker, the next start offers the restore.
      console.warn(`Sign-in could not finish: ${(err as Error).message}`);
      this.failed(marker);
    } finally {
      this.busy = false;
    }
  }

  /** "Wait longer" after notSaved: another ~45 s wait for the cookie write (same starting point). */
  async waitLonger(): Promise<void> {
    if (!this.marker || this.busy || !this.notSaved) return;
    this.notSaved = false;
    await this.finish();
  }

  // ---------- Cancel ----------

  async cancel(): Promise<void> {
    const marker = this.marker;
    // While finishing (or already cancelling) Cancel is ignored: a restore running alongside the finish would put the
    // main profile back into the slot, and the finish would then move it into the account folder.
    if (!marker || this.busy) return;
    this.busy = true;
    try {
      if (!(await this.closeDefault())) return this.failed(marker);
      await this.restore(marker, { phase: 'cancelled' });
    } catch (err) {
      console.warn(`Sign-in could not be cancelled: ${(err as Error).message}`);
      this.failed(marker);
    } finally {
      this.busy = false;
    }
  }

  // ---------- Recovery on startup ----------

  /** The marker of an interrupted sign-in, or null. Read before anything else on startup. */
  async pending(): Promise<Marker | null> {
    try {
      return parseMarker(JSON.parse(await readFile(this.deps.markerFile, 'utf8')));
    } catch {
      return null;
    }
  }

  async recover(marker: Marker, choice: 'restore' | 'continue'): Promise<void> {
    this.marker = marker;
    if (choice === 'continue' && marker.state === 'signing-in') {
      if ((await this.deps.listDefaultPids()).length === 0) {
        try {
          await this.deps.launchDefault();
        } catch {
          return this.cancel();
        }
      }
      this.deps.onStatus({ phase: 'waiting' });
      return;
    }
    if (!(await this.closeDefault())) return this.failed(marker);
    const done: SignInStatus = marker.state === 'adopted'
      ? { phase: 'done', account: marker.account }
      : { phase: 'cancelled' };
    await this.restore(marker, done);
  }

  // ---------- Helpers ----------

  /** The sessionKey cookie is on disk. The slot is a blank profile here, so a plain text search is enough. */
  private async sessionSaved(slot: string): Promise<boolean> {
    const cookies = await Promise.all(COOKIE_FILES.map((f) =>
      readFile(path.join(slot, f)).catch(() => Buffer.alloc(0))));
    return containsSessionKey(cookies);
  }

  /** The oauth key names are in config.json (values never read). */
  private async oauthKeys(slot: string): Promise<boolean> {
    return hasOauth(await readFile(path.join(slot, 'config.json'), 'utf8').catch(() => ''));
  }

  /**
   * Waits for the cookie database write: true once Network\Cookies (or its -journal / -wal) has another mtime or size
   * than when the keys appeared, or at once when the sessionKey is already on disk (the commit happened before, e.g.
   * "I've signed in" pressed late). false after ~45 s without a write. Stat only while Claude runs.
   */
  private async waitForCookieWrite(slot: string): Promise<boolean> {
    if (await this.sessionSaved(slot)) return true;
    this.cookieBase ??= await cookieDbStats(slot);
    const poll = this.deps.cookiePollMs ?? 500;
    const tries = Math.ceil((this.deps.cookieWaitMs ?? 45_000) / poll);
    for (let i = 0; i < tries; i++) {
      await this.sleep(poll);
      if ((await cookieDbStats(slot)) !== this.cookieBase) return true;
    }
    return false;
  }

  /**
   * Closes the default Claude instance: a close request for ~1 s (gracefulMs; 0 = none), then a force-end of the
   * default-profile processes only, ~10 s in all (closeTimeoutMs). stopOnNew: a default-profile process that was not
   * in `pids` (the person opened Claude again) stops it at once with 'reopened', and is never ended.
   * Returns how it closed, or false if it is still running.
   */
  private async closeDefault(opts: { pids?: number[]; gracefulMs?: number; stopOnNew?: boolean } = {}): Promise<CloseResult> {
    const pids = opts.pids ?? (await this.deps.listDefaultPids());
    if (pids.length === 0) return 'not running';
    const reopened = (now: number[]): boolean => opts.stopOnNew === true && now.some((pid) => !pids.includes(pid));
    const gracefulMs = opts.gracefulMs ?? this.deps.gracefulMs ?? 1000;
    if (gracefulMs > 0) {
      await this.deps.closeGracefully(pids);
      const exitPoll = this.deps.exitPollMs ?? 250;
      const tries = Math.ceil(gracefulMs / exitPoll);
      for (let i = 0; i < tries && pids.some((pid) => this.deps.isAlive(pid)); i++) await this.sleep(exitPoll);
    }
    // The process list is the authority (e.g. a new instance started meanwhile).
    const forceTries = Math.ceil(Math.max(0, (this.deps.closeTimeoutMs ?? 10_000) - gracefulMs) / this.pollMs);
    let killed = false;
    for (let i = 0; i <= forceTries; i++) {
      const left = await this.deps.listDefaultPids();
      if (reopened(left)) return 'reopened';
      if (left.length === 0) return killed ? 'forced' : 'graceful';
      if (killed) {
        await this.sleep(this.pollMs);
      } else {
        await this.deps.kill(left);
        killed = true;
      }
    }
    return false;
  }

  /**
   * Step 7: puts the main profile back. The stash is only renamed, never deleted. What sits in the default
   * location is the throwaway fresh profile only when a stash exists, or when there was no main profile at all.
   */
  private async restore(marker: Marker, outcome: SignInStatus): Promise<void> {
    try {
      if (await exists(marker.stash)) {
        await rm(marker.slot, { recursive: true, force: true, maxRetries: 5 });
        await this.move(marker.stash, marker.slot);
      } else if (!marker.stashed) {
        await rm(marker.slot, { recursive: true, force: true, maxRetries: 5 });
      }
      // else: the stash never happened (crash right after the marker): the folder there is the original.
    } catch (err) {
      console.warn(`Could not restore the main profile: ${(err as Error).message}`);
      return this.failed(marker);
    }
    await rm(this.deps.markerFile, { force: true });
    this.marker = null;
    this.notSaved = false;
    this.cookieBase = null;
    if (marker.mainWasRunning) await this.deps.launchDefault().catch(() => undefined);
    this.deps.onStatus(outcome);
  }

  /** The marker stays, so the next start offers the restore again. */
  private failed(marker: Marker): void {
    this.marker = null;
    this.notSaved = false;
    this.cookieBase = null;
    this.deps.onStatus({ phase: 'failed', stashPath: marker.stashed ? marker.stash : null });
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private step(step: StartStep): void {
    this.deps.onStatus({ phase: 'starting', step });
  }

  /** One timing line: what happened and how long since `since`. */
  private log(what: string, since?: number): void {
    this.deps.log?.(since === undefined ? what : `${what}: ${this.now() - since} ms`);
  }

  private async writeMarker(marker: Marker): Promise<void> {
    await mkdir(path.dirname(this.deps.markerFile), { recursive: true });
    const tmp = `${this.deps.markerFile}.tmp`;
    await writeFile(tmp, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
    await rename(tmp, this.deps.markerFile);
  }

  /** Rename with retries (file locks linger a few seconds after a kill); copy + delete across volumes. */
  private async move(from: string, to: string): Promise<void> {
    if (await exists(to)) throw new Error(`Destination already exists: ${to}`);
    const tries = Math.ceil(15_000 / this.pollMs);
    for (let i = 0; ; i++) {
      try {
        await rename(from, to);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EXDEV') {
          await cp(from, to, { recursive: true, errorOnExist: true, force: false });
          await rm(from, { recursive: true, force: true, maxRetries: 5 });
          return;
        }
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '') || i >= tries) throw err;
        await this.sleep(this.pollMs);
      }
    }
  }
}

/** mtime and size of each cookie database file ("-" when missing), as one comparable string. */
async function cookieDbStats(slot: string): Promise<string> {
  const stats = await Promise.all(COOKIE_DB.map((f) => stat(path.join(slot, f)).then((s) => `${s.mtimeMs}:${s.size}`, () => '-')));
  return stats.join('|');
}
