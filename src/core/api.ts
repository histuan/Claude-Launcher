// Shape of the API the preload exposes as window.launcher (types only).
import type { Account } from './config.js';

export interface LauncherState {
  /** Greeting name from Windows (already cleaned). */
  defaultName: string;
  /** Name typed by the person; null = use defaultName. */
  greetingName: string | null;
  accounts: Account[];
}

/** Keys of strings.errors: notInstalled / launchFailed (open), running / folder (add or remove). */
export type ActionError = 'notInstalled' | 'launchFailed' | 'running' | 'folder';

export interface ActionResult {
  state: LauncherState;
  error: ActionError | null;
}

export interface LauncherApi {
  getState(): Promise<LauncherState>;
  setGreetingName(name: string | null): Promise<LauncherState>;
  renameAccount(id: string, label: string): Promise<LauncherState>;
  /** On success the launcher closes by itself. */
  openAccount(id: string): Promise<ActionResult>;
  addAccount(label: string): Promise<ActionResult>;
  removeAccount(id: string): Promise<ActionResult>;
  /** Ids of the accounts whose Claude is running. */
  runningAccounts(): Promise<string[]>;
}
