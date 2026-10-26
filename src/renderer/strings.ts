// Every user-facing text lives here, so other languages can be added later.
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
    body: (name: string) => `“${name}” will be removed from the launcher.`,
    confirm: 'Remove',
  },
  cancel: 'Cancel',
  addAccount: 'Add account',
  running: '● Running',
} as const;
