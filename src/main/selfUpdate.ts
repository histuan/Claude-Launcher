// Self-update (Phase 5.2, 0.6.2): one check per start, started when the app is ready (never blocking the cards); the
// person decides (Later / Install). The last newer version found is remembered, so the next start shows it at once and
// the check confirms or clears it. Never checks or installs while a sign-in or the memory assistant runs.
// Logs only versions and timings. The updater itself (electron-updater, GitHub provider) is injected, so tests use a mock.
import type { UpdateStatus } from '../core/api.js';
import type { DownloadResult } from '../core/updateDownload.js';
import { isNewerVersion } from '../core/version.js';

export interface SelfUpdateDeps {
  /** The newer version on the latest GitHub release, or null. Throws when the check fails. */
  check(): Promise<string | null>;
  /** Downloads the offered version; onProgress gets 0–100. Throws when the download fails. */
  download(onProgress: (percent: number) => void): Promise<DownloadResult>;
  /** Silent install, then the launcher opens again (the app quits here). */
  install(): void;
  /** Short pause so "Installing…" can be read before the window closes. */
  beforeInstall(): Promise<void>;
  /** A sign-in or the memory assistant is in progress. */
  busy(): boolean;
  /** Pause between two busy checks (~5 s). */
  wait(): Promise<void>;
  /** Saves the last newer version found (null = none) in the launcher config. */
  remember(version: string | null): Promise<void>;
  send(status: UpdateStatus): void;
  log(line: string): void;
}

export class SelfUpdate {
  private started = false;
  /** The version on offer (shown in the dialog and the corner link), or null. */
  private offered: string | null = null;
  /** The check of this start found `offered` (a remembered version is not confirmed until then). */
  private confirmed = false;
  private running = false;
  private checking: Promise<void> = Promise.resolve();

  constructor(private readonly deps: SelfUpdateDeps, private readonly current: string, private known: string | null) {}

  /** Downloading or installing: sign-ins and the memory assistant must wait. */
  get active(): boolean {
    return this.running;
  }

  /** Once per start: a remembered newer version is offered at once, then the check (after any busy wait). */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    if (this.known && isNewerVersion(this.known, this.current)) {
      this.offered = this.known;
      this.deps.log(`update: ${this.known} known from an earlier check, shown at once`);
      this.deps.send({ phase: 'available', version: this.known });
    }
    this.checking = this.runCheck();
    await this.checking;
  }

  private async runCheck(): Promise<void> {
    while (this.deps.busy()) await this.deps.wait();
    const t0 = Date.now();
    let found: string | null;
    try {
      found = await this.deps.check();
    } catch {
      this.deps.log(`update: check failed (${Date.now() - t0} ms)`);
      return;
    }
    if (!found) {
      this.deps.log(`update: check: none newer than ${this.current} (${Date.now() - t0} ms)`);
      if (this.offered) {
        this.offered = null;
        this.deps.send({ phase: 'none' });
      }
      await this.save(null);
      return;
    }
    this.deps.log(`update: check: ${found} available, current ${this.current} (${Date.now() - t0} ms)`);
    this.confirmed = true;
    if (found !== this.offered) {
      this.offered = found;
      this.deps.send({ phase: 'available', version: found });
    }
    await this.save(found);
  }

  private async save(version: string | null): Promise<void> {
    if (this.known === version) return;
    this.known = version;
    await this.deps.remember(version).catch(() => this.deps.log('update: could not save the known version'));
  }

  /** Later: the launcher works normally; the corner link keeps the offer until Install or the next start. */
  later(): void {
    if (!this.offered || this.running) return;
    this.deps.log(`update: ${this.offered} later`);
  }

  /** The corner link ("Update to X"): error pending while a sign-in or the memory assistant runs. */
  reopen(): 'pending' | null {
    if (this.deps.busy()) return 'pending';
    if (this.offered && !this.running) this.deps.log(`update: ${this.offered} reopened from the link`);
    return null;
  }

  /**
   * Install: download with progress, then a silent install that reopens the launcher. Error pending while busy
   * (nothing downloads). A remembered version is checked first. A failed download sends `failed` and leaves the
   * launcher as it was.
   */
  async install(): Promise<'pending' | null> {
    const version = this.offered;
    if (!version) throw new Error('No update on offer');
    if (this.running) return null;
    if (this.deps.busy()) return 'pending';
    this.running = true;
    if (!this.confirmed) {
      await this.checking;
      if (!this.confirmed && this.offered === version) await this.runCheck();
    }
    if (this.offered !== version || !this.confirmed) {
      this.running = false;
      // Gone: `none` or the newer version was already sent. Still unconfirmed: offline (the check failed).
      if (this.offered === version) {
        this.deps.log(`update: ${version} could not be confirmed (check failed)`);
        this.deps.send({ phase: 'failed', version });
      }
      return null;
    }
    const t0 = Date.now();
    let sent = -1;
    const progress = (percent: number): void => {
      const whole = Math.max(0, Math.min(100, Math.floor(percent)));
      if (whole === sent) return;
      sent = whole;
      this.deps.send({ phase: 'downloading', version, percent: whole });
    };
    progress(0);
    let result: DownloadResult;
    try {
      result = await this.deps.download(progress);
    } catch {
      this.running = false;
      this.deps.log(`update: download ${version} failed (${Date.now() - t0} ms)`);
      this.deps.send({ phase: 'failed', version });
      return null;
    }
    this.deps.log(`update: download ${version}: ${result.bytes} bytes, ${Date.now() - t0} ms, ${result.mode}; installing`);
    this.deps.send({ phase: 'installing', version });
    await this.deps.beforeInstall();
    this.deps.install();
    return null;
  }
}
