// Shape of the API the preload exposes as window.launcher (types only).
import type { Account } from './config.js';

export interface LauncherState {
  /** Greeting name from Windows (already cleaned). */
  defaultName: string;
  /** Name typed by the person; null = use defaultName. */
  greetingName: string | null;
  accounts: Account[];
}

export interface LauncherApi {
  getState(): Promise<LauncherState>;
  setGreetingName(name: string | null): Promise<LauncherState>;
  renameAccount(id: string, label: string): Promise<LauncherState>;
  removeAccount(id: string): Promise<LauncherState>;
}
