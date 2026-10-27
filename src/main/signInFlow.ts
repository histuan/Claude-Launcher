// Sign-in by snapshot (WINDOWS.md §4). The only code that writes to the default Claude profile.
// Rules: marker before the stash; the stash is only ever renamed back, never deleted; a live default
// Claude aborts; a failed restore keeps the marker and reports the exact stash path.
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SignInStatus } from '../core/api.js';
import { isLauncherProfileDir } from '../core/config.js';
import {
  containsSessionKey, hasOauth, LoginWatch, MARKER_VERSION, parseMarker, STASH_SUFFIX, type Marker, type MarkerAccount,
} from '../core/signIn.js';

export type StartError = 'pending' | 'defaultRunning' | 'profileInUse' | 'disk' | 'folder' | 'launchFailed';

export interface SignInDeps {
  userProfile: string;
  /** %LOCALAPPDATA%\ClaudeLauncher\login-pending.json */
  markerFile: string;
  /** Main processes of the default Claude instance (no --user-data-dir). */
  listDefaultPids(): Promise<number[]>;
  kill(pids: number[]): Promise<void>;
  /** Any process whose exe lives inside `dir` (e.g. the Claude Code CLI under <profile>\claude-code). */
  listPidsInside(dir: string): Promise<number[]>;
  /** Opens Claude without flag (default profile). */
  launchDefault(): Promise<void>;
  freeBytes(dir: string): Promise<number>;
  onStatus(status: SignInStatus): void;
  minFreeBytes?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Pause after the session is detected, so Chromium finishes writing. */
  settleMs?: number;
  /** "I've signed in": how long to wait for the cookie flush before closing Claude anyway. */
  flushWaitMs?: number;
  closeTimeoutMs?: number;
  pollMs?: number;
}

// The login cookie lives in <profile>\Network\Cookies; plain <profile>\Cookies only in old layouts.
// Partitions\*\Network\Cookies (launch previews) are not looked at.
const COOKIE_FILES = ['Cookies', 'Cookies-journal', 'Cookies-wal'].flatMap((f) => [path.join('Network', f), f]);
const exists = (p: string): Promise<boolean> => stat(p).then(() => true, () => false);

export class SignInFlow {
  private marker: Marker | null = null;
  private watch: LoginWatch | null = null;
  private busy = false;
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
    if (this.marker || (await exists(this.deps.markerFile)) || (await exists(stash))) return 'pending';
    // Disk first: do not close the person's Claude for nothing.
    if ((await this.deps.freeBytes(path.parse(slot).root)) < (this.deps.minFreeBytes ?? 500 * 1024 ** 2)) return 'disk';

    const pids = await this.deps.listDefaultPids();
    const mainWasRunning = pids.length > 0;
    if (!(await this.closeDefault())) return 'defaultRunning';
    // Something else still runs from the profile folder (e.g. Claude Code in a terminal): it would lock files or
    // break when its folder moves. Do not touch it; give the person their main Claude back.
    if ((await this.deps.listPidsInside(slot)).length > 0) {
      if (mainWasRunning) await this.deps.launchDefault().catch(() => undefined);
      return 'profileInUse';
    }

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
    try {
      await this.deps.launchDefault();
    } catch (err) {
      console.warn(`Could not open the default Claude: ${(err as Error).message}`);
      await this.cancel();
      return 'launchFailed';
    }
    await this.beginWatch();
    return null;
  }

  // ---------- Detection (step 5) ----------

  /** One detection tick (every ~0.5 s from the main process). Finishes by itself once the session is saved. */
  async poll(now = Date.now()): Promise<void> {
    if (!this.marker || !this.watch || this.busy) return;
    const wasDetected = this.watch.detected;
    const ready = await this.sample(now);
    if (ready) return this.finish();
    if (!wasDetected && this.watch.detected) this.deps.onStatus({ phase: 'detected' });
  }

  /** "I've signed in" button: waits a little for the cookie flush, then finishes. */
  async confirm(): Promise<void> {
    if (!this.marker || this.busy) return;
    this.busy = true;
    this.deps.onStatus({ phase: 'saving' });
    const tries = Math.ceil((this.deps.flushWaitMs ?? 40_000) / this.pollMs);
    for (let i = 0; i < tries && !(await this.sample(Date.now())); i++) await this.sleep(this.pollMs);
    this.busy = false;
    await this.finish();
  }

  // ---------- Finish (steps 6–7) ----------

  private async finish(): Promise<void> {
    const marker = this.marker;
    if (!marker || this.busy) return;
    this.busy = true;
    try {
      this.deps.onStatus({ phase: 'saving' });
      await this.sleep(this.deps.settleMs ?? 1200);
      if (!(await this.closeDefault())) return this.failed(marker);
      const cookies = await Promise.all(COOKIE_FILES.map((f) =>
        readFile(path.join(marker.slot, f)).catch(() => Buffer.alloc(0))));
      if (!containsSessionKey(cookies)) {
        // Never keep a partial session: it would be a broken profile.
        return await this.restore(marker, { phase: 'noSession' });
      }
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
      await this.restore(adopted, { phase: 'done', account: marker.account });
    } catch (err) {
      // E.g. the process query failed: keep the marker, the next start offers the restore.
      console.warn(`Sign-in could not finish: ${(err as Error).message}`);
      this.failed(marker);
    } finally {
      this.busy = false;
    }
  }

  // ---------- Cancel ----------

  async cancel(): Promise<void> {
    const marker = this.marker;
    if (!marker) return;
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
      return this.beginWatch();
    }
    if (!(await this.closeDefault())) return this.failed(marker);
    const done: SignInStatus = marker.state === 'adopted'
      ? { phase: 'done', account: marker.account }
      : { phase: 'cancelled' };
    await this.restore(marker, done);
  }

  // ---------- Helpers ----------

  private async beginWatch(): Promise<void> {
    this.watch = new LoginWatch(await this.cookieSignature());
    this.deps.onStatus({ phase: 'waiting' });
  }

  private async sample(now: number): Promise<boolean> {
    const marker = this.marker;
    if (!marker || !this.watch) return false;
    const config = await readFile(path.join(marker.slot, 'config.json'), 'utf8').catch(() => '');
    return this.watch.sample(now, await this.cookieSignature(), hasOauth(config));
  }

  /** Size and time of the cookie files. Only stat: the database is locked while Claude runs. */
  private async cookieSignature(): Promise<string> {
    const slot = this.marker?.slot ?? '';
    const parts = await Promise.all(COOKIE_FILES.map((f) => stat(path.join(slot, f))
      .then((s) => `${s.size}:${s.mtimeMs}`, () => '-')));
    return parts.join('|');
  }

  /** Closes every default Claude instance and waits until they are gone. */
  private async closeDefault(): Promise<boolean> {
    const tries = Math.ceil((this.deps.closeTimeoutMs ?? 20_000) / this.pollMs);
    for (let i = 0; i <= tries; i++) {
      const pids = await this.deps.listDefaultPids();
      if (pids.length === 0) return true;
      if (i === 0) await this.deps.kill(pids);
      else await this.sleep(this.pollMs);
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
    this.watch = null;
    if (marker.mainWasRunning) await this.deps.launchDefault().catch(() => undefined);
    this.deps.onStatus(outcome);
  }

  /** The marker stays, so the next start offers the restore again. */
  private failed(marker: Marker): void {
    this.marker = null;
    this.watch = null;
    this.deps.onStatus({ phase: 'failed', stashPath: marker.stashed ? marker.stash : null });
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
