// How an update was downloaded (0.6.1). electron-updater has no event for "full or differential", so this watches
// its logger calls and progress events. Only two flags and a byte count are kept: the messages carry URLs.

export type DownloadMode = 'full' | 'differential' | 'cached';

export interface DownloadResult {
  /** Bytes actually downloaded (for a differential download, only the changed blocks). */
  bytes: number;
  /** cached = the installer was already in the updater cache, nothing downloaded. */
  mode: DownloadMode;
}

export class DownloadWatch {
  private triedDifferential = false;
  private fellBack = false;
  private progressed = false;
  private transferred = 0;

  /** Passed as electron-updater's logger for one download (no debug: it would get the whole download plan). */
  readonly logger = {
    info: (message?: unknown): void => {
      if (typeof message === 'string' && message.startsWith('Download block maps')) this.triedDifferential = true;
    },
    warn: (_message?: unknown): void => {},
    error: (message?: unknown): void => {
      if (typeof message === 'string' && message.includes('fallback to full download')) this.fellBack = true;
    },
  };

  /** From each download-progress event. After a fallback the full download counts again from 0. */
  progress(transferred: number): void {
    this.progressed = true;
    this.transferred = transferred;
  }

  result(): DownloadResult {
    if (!this.progressed && !this.triedDifferential) return { bytes: 0, mode: 'cached' };
    return { bytes: this.transferred, mode: this.triedDifferential && !this.fellBack ? 'differential' : 'full' };
  }
}
