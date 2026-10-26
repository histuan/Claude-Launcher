// Reads and writes the launcher config file. Writes are atomic (temp file + rename) and run one at a time.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultConfig, parseConfig, type LauncherConfig } from '../core/config.js';

export class ConfigStore {
  current: LauncherConfig = defaultConfig();
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  /** `seed` is used only when there is no file yet (first run). */
  async load(seed: () => LauncherConfig): Promise<LauncherConfig> {
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      return this.replace(seed());
    }
    try {
      this.current = parseConfig(JSON.parse(raw));
      return this.current;
    } catch (err) {
      // Keep the broken file for inspection instead of overwriting it.
      const backup = `${this.file}.corrupt-${Date.now()}`;
      console.warn(`Config unreadable (${(err as Error).message}); moved to ${backup}`);
      await rename(this.file, backup);
      return this.replace(defaultConfig());
    }
  }

  update(change: (cfg: LauncherConfig) => LauncherConfig): Promise<LauncherConfig> {
    const next = this.writes.then(() => this.replace(change(this.current)));
    this.writes = next.catch(() => undefined);
    return next;
  }

  private async replace(cfg: LauncherConfig): Promise<LauncherConfig> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    await rename(tmp, this.file);
    this.current = cfg;
    return cfg;
  }
}
