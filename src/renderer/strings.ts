// Every user-facing text lives here, so other languages can be added later.
import type { ActionError } from '../core/api.js';
import type { GreetingPeriod } from '../core/greeting.js';

export const strings = {
  appName: 'Multi-Account Launcher for Claude',
  greeting: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  } satisfies Record<GreetingPeriod, string>,
  /** Used only if Windows gives no name at all. */
  greetingNoName: 'there',
  editName: 'Edit name',
  yourName: 'Your name',
  accounts: 'Accounts',
  mainAccount: 'Main',
  openAccount: (name: string) => `Open ${name}`,
  accountOptions: (name: string) => `Options for ${name}`,
  menu: {
    rename: 'Rename',
    changePhoto: 'Change photo',
    remove: 'Remove',
    signIn: 'Sign in',
    close: 'Close this account',
    /** Tooltip of the greyed "Close this account". */
    closeOff: 'This account is not running',
  },
  comingSoon: 'Available in a later version',
  rename: {
    title: 'Rename account',
    save: 'Save',
  },
  remove: {
    title: 'Remove account?',
    body: (name: string) => `“${name}” will be removed from the launcher and its Claude profile folder deleted.`,
    confirm: 'Remove',
    /** The account is running: closing it is part of the removal. */
    runningBody: (name: string) => `Claude is open with “${name}”. It will be closed, then the account removed from the `
      + 'launcher and its Claude profile folder deleted.',
    closeAndRemove: 'Close and remove',
  },
  add: {
    title: 'Add account',
    body: "Your main Claude closes while you sign in, then reopens by itself. Don't close the launcher until it finishes.",
    confirm: 'Continue',
  },
  signIn: {
    title: (name: string) => `Sign in to “${name}”`,
    body: "Your main Claude closes while you sign in, then reopens by itself. Don't close the launcher until it finishes.",
    start: 'Continue',
    notSignedIn: 'Not signed in',
    waiting: {
      title: 'Use the new Claude window to sign in',
      body: 'A blank Claude window opened. Sign in there with the account for this card (email or Google). '
        + 'The launcher notices it by itself.',
    },
    detected: {
      title: 'Signed in',
      body: 'Waiting for Claude to save the session. This can take up to a minute.',
    },
    saving: {
      title: 'Saving the session',
      body: 'Closing that window and putting your main Claude back…',
    },
    confirm: 'I\'ve signed in',
    checking: (seconds: number) => `Checking… (${seconds} s)`,
    notFound: 'No sign-in found. Sign in in the Claude window, then press I\'ve signed in again.',
    noSession: {
      title: 'The sign-in was not saved',
      body: 'Claude had not saved the session yet, so nothing was kept. Try again and wait a few seconds after signing in.',
    },
    failed: {
      title: 'Could not finish the sign-in',
      body: (stashPath: string | null) => (stashPath
        ? `Your main Claude profile is safe in:\n${stashPath}\nOpen the launcher again to restore it.`
        : 'Your main Claude profile is back in place. Try again.'),
    },
  },
  /** Startup dialog when the last sign-in was interrupted (shown by the main process). */
  recovery: {
    title: 'A sign-in was interrupted',
    body: (name: string) => `The launcher closed while signing in to “${name}”. Your main Claude profile was set aside, `
      + 'not lost. Restore it now, or continue the sign-in.',
    restore: 'Restore main profile',
    continue: 'Continue sign-in',
  },
  errors: {
    notInstalled: {
      title: 'Claude is not installed',
      body: 'Install the Claude desktop app, then try again.',
    },
    launchFailed: {
      title: 'Could not open Claude',
      body: 'Something went wrong while starting Claude. Try again.',
    },
    running: {
      title: 'Close this account first',
      body: 'Claude is open with this account. Choose “Close this account” in its ⋯ menu, then try again.',
    },
    folder: {
      title: 'Could not change the profile folder',
      body: 'Nothing was changed. Close Claude for this account and try again.',
    },
    noProfile: {
      title: 'Sign-in is turned off',
      body: 'The launcher could not find your main Claude profile with confidence, so it will not move anything. '
        + 'Opening your accounts still works. Open Claude once, sign in, then restart the launcher. '
        + 'The folders it checked are listed in sign-in-check.log, in the launcher\'s data folder.',
    },
    profileInUse: {
      title: 'Your Claude folder is in use',
      body: 'A program started from your main Claude profile folder is still running (for example Claude Code in a '
        + 'terminal). Nothing was changed. Close it, then try again.',
    },
    pending: {
      title: 'A previous sign-in is not finished',
      body: 'Close and reopen the launcher to restore your main Claude profile first.',
    },
    defaultRunning: {
      title: 'Could not close your main Claude',
      body: 'Nothing was changed. Close Claude yourself, then try again.',
    },
    noWindow: {
      title: 'Claude is starting in the background',
      body: 'Claude started, but its window has not appeared yet. Look for the Claude icon in the system tray, next to '
        + 'the clock, or click the card again.',
    },
    closeFailed: {
      title: 'Could not close this account',
      body: 'Claude is still running with this account. Try again, or quit it from the Claude icon in the system tray.',
    },
    disk: {
      title: 'Not enough disk space',
      body: 'Free at least 500 MB on the system drive, then try again.',
    },
  } satisfies Record<ActionError, { title: string; body: string }>,
  ok: 'OK',
  cancel: 'Cancel',
  addAccount: 'Add account',
  signInOff: 'Adding accounts is turned off: the main Claude profile was not found.',
  running: 'Running',
} as const;
