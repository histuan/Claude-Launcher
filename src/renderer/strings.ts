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
  },
  add: {
    title: 'Add account',
    body: 'Creates a new card with its own Claude profile. Signing in from the launcher arrives in a later version.',
    confirm: 'Add',
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
      body: 'Claude is open with this account. Close its window, then remove it again.',
    },
    folder: {
      title: 'Could not change the profile folder',
      body: 'Nothing was changed. Close Claude for this account and try again.',
    },
  } satisfies Record<ActionError, { title: string; body: string }>,
  ok: 'OK',
  cancel: 'Cancel',
  addAccount: 'Add account',
  running: 'Running',
} as const;
