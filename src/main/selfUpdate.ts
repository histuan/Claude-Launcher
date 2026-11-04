// Self-update (Phase 5.2): one check per start, after the cards are on screen; the person decides (Later / Install).
// Never checks or installs while a sign-in or the memory assistant runs. Logs only versions and timings.
// The updater itself (electron-updater, GitHub provider) is injected, so tests use a mock.
import type { UpdateStatus } from '../core/api.js';
import type { DownloadResult } from '../core/updateDownload.js';

export interface SelfUpdateDeps {
  /** The newer version on the latest GitHub release, or null. Throws when the check fails. */
  check(): Promise<string | null>;
  /** Downloads the offered version; onProgress gets 0–100. Throws when the download fails. */
  download(onProgress: (percent: number) => void): Promise<DownloadResult>;
  /** Silent install, then the launcher opens again (the app quits here). */
  install(): void;
  /** A sign-in or the memory assistant is in progress. */
  busy(): boolean;
  /** Pause between two busy checks (~5 s). */
  wait(): Promise<void>;
  send(status: UpdateStatus): void;
  log(line: string): void;
}

export class SelfUpdate {
  private checked = false;
  private offered: string | null = null;
  private running = false;

  constructor(private readonly deps: SelfUpdateDeps, private readonly current: string) {}

  /** Downloading or installing: sign-ins and the memory assistant must wait. */
  get active(): boolean {
    return this.running;
  }

  /** Once per start: waits while the launcher is busy, then checks. A failed check is only logged. */
  async checkOnStart(): Promise<void> {
    if (this.checked) return;
    this.checked = true;
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
      return;
    }
    this.deps.log(`update: check: ${found} available, current ${this.current} (${Date.now() - t0} ms)`);
    this.offered = found;
    this.deps.send({ phase: 'available', version: found });
  }

  /** Later: the launcher works normally; the next start asks again. */
  later(): void {
    if (!this.offered || this.running) return;
    this.deps.log(`update: ${this.offered} later`);
    this.offered = null;
  }

  /**
   * Install: download with progress, then a silent install that reopens the launcher. Error pending while busy
   * (nothing downloads). A failed download sends `failed` and leaves the launcher as it was.
   */
  async install(): Promise<'pending' | null> {
    const version = this.offered;
    if (!version) throw new Error('No update on offer');
    if (this.running) return null;
    if (this.deps.busy()) return 'pending';
    this.running = true;
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
    this.deps.install();
    return null;
  }
}
