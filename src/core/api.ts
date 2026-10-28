// Shape of the API the preload exposes as window.launcher (types, plus the list of start steps).
import type { Account } from './config.js';
import type { MarkerAccount } from './signIn.js';

/** Steps of Add account / Sign in before the sign-in window is up, in order. */
export const START_STEPS = ['closing', 'preparing', 'opening'] as const;
export type StartStep = typeof START_STEPS[number];

/** Progress of the sign-in flow, sent from the main process to the window. */
export type SignInStatus =
  /** Before the sign-in window opens (shown at once, so the click never feels frozen). */
  | { phase: 'starting'; step: StartStep }
  | { phase: 'waiting' | 'saving' }
  /** "I've signed in" is checking for a saved session (countdown), then found none (the sign-in stays open). */
  | { phase: 'checking'; secondsLeft: number }
  | { phase: 'notFound' }
  | { phase: 'done'; account: MarkerAccount }
  /** No cookie database write within ~45 s: nothing moved yet; the person picks Wait longer or Cancel. */
  | { phase: 'notSaved' }
  | { phase: 'cancelled' }
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
  /** Closed extra accounts whose cookie database is still locked and being read again ("Checking…", up to ~10 s). */
  checking: string[];
  /** false when the default Claude profile could not be found with confidence: Add account / Sign in are off. */
  signInAvailable: boolean;
  /** Diagnostics file listing the folders checked (paths only). */
  signInLog: string;
  /** sign-in-timings.log (step names, paths and durations only), shown as the version label's tooltip. */
  timingsLog: string;
  /** Sign-in in progress (e.g. resumed on startup), or null. */
  signIn: SignInStatus | null;
  /** The launcher's own version (app.getVersion()), shown in the bottom-right corner. */
  version: string;
}

/** Add account (new card, created when the sign-in succeeds) or Sign in on an existing card. */
export type SignInTarget = { label: string } | { accountId: string };

/** Keys of strings.errors. */
export type ActionError =
  | 'notInstalled' | 'launchFailed' | 'running' | 'folder'
  // Phase 4.1: Claude started without a window; an account that would not close
  | 'noWindow' | 'closeFailed'
  // sign-in
  | 'noProfile' | 'pending' | 'defaultRunning' | 'reopened' | 'profileInUse' | 'disk';

export interface ActionResult {
  state: LauncherState;
  error: ActionError | null;
}

export interface LauncherApi {
  getState(): Promise<LauncherState>;
  setGreetingName(name: string | null): Promise<LauncherState>;
  renameAccount(id: string, label: string): Promise<LauncherState>;
  /** Closes the launcher once the account's Claude window is visible; error noWindow keeps it open. */
  openAccount(id: string): Promise<ActionResult>;
  /** Ends only this account's Claude processes ("Close this account"). */
  closeAccount(id: string): Promise<ActionResult>;
  /** Closes the main Claude, stashes its profile and opens a blank Claude to sign in (WINDOWS.md §4). */
  startSignIn(target: SignInTarget): Promise<ActionResult>;
  /** "I've signed in": read-only check, then finishes or reports notFound (fallback for the automatic detection). */
  confirmSignIn(): Promise<void>;
  cancelSignIn(): Promise<void>;
  /** "Wait longer" after notSaved: another ~45 s wait for the cookie write. */
  waitLongerSignIn(): Promise<void>;
  onSignIn(listener: (status: SignInStatus) => void): void;
  /** A card check that needed retries is final: get the state again and redraw the cards. */
  onCardsChanged(listener: () => void): void;
  /** closeFirst: "Close and remove" on a running account; without it a running account gives error running. */
  removeAccount(id: string, closeFirst?: boolean): Promise<ActionResult>;
  /** Ids of the accounts whose Claude is running. */
  runningAccounts(): Promise<string[]>;
}
