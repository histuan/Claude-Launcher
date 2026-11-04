// A slow lookup (PowerShell) whose last result is kept in the launcher config (0.5.1): the first screen uses the
// saved value at once, and the lookup runs again in the background once the cards are shown.

export interface CachedLookupDeps<T> {
  /** Saved value; undefined = none (the first get() waits for the lookup). */
  cached: T | undefined;
  lookUp(): Promise<T>;
  save(value: T): Promise<void>;
  /** A lookup gave a different value than the one in use (e.g. redraw the window). */
  onChange(value: T): void;
}

export class CachedLookup<T> {
  private current: Promise<T>;
  /** true while the value in use came from the config and was not checked yet. */
  private stale: boolean;

  constructor(private readonly deps: CachedLookupDeps<T>) {
    this.stale = deps.cached !== undefined;
    this.current = deps.cached !== undefined ? Promise.resolve(deps.cached) : this.run(undefined);
  }

  get(): Promise<T> {
    return this.current;
  }

  /** Once after the cards are shown: looks up again only a cached value (true = it ran). A failure keeps the cached one. */
  async refresh(): Promise<boolean> {
    if (!this.stale) return false;
    this.stale = false;
    const before = await this.current;
    await this.run(before).catch((err: unknown) => console.warn(`Background lookup failed: ${(err as Error).message}`));
    return true;
  }

  /** Always looks up (e.g. before a sign-in, where only a fresh value is safe). */
  async lookUpNow(): Promise<T> {
    this.stale = false;
    return this.run(await this.current.catch(() => undefined));
  }

  private run(before: T | undefined): Promise<T> {
    const next = this.deps.lookUp().then(async (value) => {
      if (value !== before) {
        await this.deps.save(value).catch((err: unknown) => console.warn(`Could not save a lookup: ${(err as Error).message}`));
        if (before !== undefined) this.deps.onChange(value);
      }
      return value;
    });
    // A failed lookup keeps the previous value in use.
    this.current = before === undefined ? next : next.catch(() => before);
    return next;
  }
}
