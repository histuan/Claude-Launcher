// Shape of the API the preload exposes as window.launcher (types only).
import type { Account } from './config.js';
import type { MarkerAccount } from './signIn.js';

/** Progress of the sign-in flow, sent from the main process to the window. */
export type SignInStatus =
  | { phase: 'waiting' | 'detected' | 'saving' }
  | { phase: 'done'; account: MarkerAccount }
  | { phase: 'cancelled' | 'noSession' }
  /** stashPath: where the main profile is kept when it could not be put back (null = it is back in place). */
  | { phase: 'failed'; stashPath: string | null };

export interface LauncherState {
  /** Greeting name from Windows (already cleaned). */
  defaultName: string;
  /** Name typed by the person; null = use defaultName. */
  greetingName: string | null;
  accounts: Account[];
  /** Ids of the extra accounts whose profile is not signed in yet (they get a "Sign in" action). */
  signedOut: string[];
  /** Sign-in in progress (e.g. resumed on startup), or null. */
  signIn: SignInStatus | null;
}

/** Add account (new card, created when the sign-in succeeds) or Sign in on an existing card. */
export type SignInTarget = { label: string } | { accountId: string };

/** Keys of strings.errors. */
export type ActionError =
  | 'notInstalled' | 'launchFailed' | 'running' | 'folder'
  // sign-in
  | 'unsupported' | 'pending' | 'defaultRunning' | 'disk';

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
  /** Closes the main Claude, stashes its profile and opens a blank Claude to sign in (WINDOWS.md §4). */
  startSignIn(target: SignInTarget): Promise<ActionResult>;
  /** "I've signed in" (fallback when the automatic detection does not fire). */
  confirmSignIn(): Promise<void>;
  cancelSignIn(): Promise<void>;
  onSignIn(listener: (status: SignInStatus) => void): void;
  removeAccount(id: string): Promise<ActionResult>;
  /** Ids of the accounts whose Claude is running. */
  runningAccounts(): Promise<string[]>;
}
