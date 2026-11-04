// Every user-facing text lives here, so other languages can be added later.
import type { ActionError, StartStep } from '../core/api.js';
import type { CardBadge, CardStatus } from '../core/card.js';
import type { DetailsError } from '../core/details.js';
import type { MemoryTextError } from '../core/memories.js';
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
  /** Small fixed badge on a card; Main keeps it when renamed. */
  badges: {
    main: 'Main',
  } satisfies Record<CardBadge, string>,
  /** Bottom-left corner, e.g. "v0.4.3". */
  version: (version: string) => `v${version}`,
  /** Tooltip of the version label. */
  logs: (file: string) => `Logs: ${file}`,
  openAccount: (name: string) => `Open ${name}`,
  accountOptions: (name: string) => `Options for ${name}`,
  menu: {
    rename: 'Rename',
    editDetails: 'Edit details',
    changePhoto: 'Change photo',
    /** Shown only when the card has a photo. */
    removePhoto: 'Back to the initial',
    remove: 'Remove',
    signIn: 'Sign in',
    close: 'Close this account',
    /** Tooltip of the greyed "Close this account". */
    closeOff: 'This account is not running',
    receiveMemories: 'Receive memories from…',
    /** Title above the list of source accounts. */
    memoriesFrom: 'Receive memories from',
    /** Tooltips of the greyed "Receive memories from…". */
    memoriesSignedOut: 'Sign in to this account first',
    memoriesNoSource: 'No other signed-in account to copy from',
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
    body: "Your main Claude closes while you sign in (it reopens afterwards if its window was open). "
      + "Don't close the launcher until it finishes.",
    confirm: 'Continue',
  },
  signIn: {
    title: (name: string) => `Sign in to “${name}”`,
    body: "Your main Claude closes while you sign in (it reopens afterwards if its window was open). "
      + "Don't close the launcher until it finishes.",
    start: 'Continue',
    waiting: {
      title: 'Use the new Claude window to sign in',
      body: 'A blank Claude window opened. Sign in there with the account for this card (email or Google). '
        + 'The launcher notices it by itself.',
    },
    /** Shown at once after the click, until the sign-in window is up. */
    starting: {
      title: 'Getting a sign-in window ready',
      steps: {
        closing: 'Closing Claude…',
        preparing: 'Preparing a clean profile…',
        opening: 'Opening sign-in window…',
      } satisfies Record<StartStep, string>,
    },
    saving: {
      title: 'Saving the session',
      body: 'Waiting for Claude to save the sign-in (up to about 45 seconds), then putting your main Claude back.',
    },
    confirm: 'I\'ve signed in',
    checking: (seconds: number) => `Checking… (${seconds} s)`,
    notFound: 'No sign-in found. Sign in in the Claude window, then press I\'ve signed in again.',
    /** No cookie database write within ~45 s: nothing moved yet. */
    notSaved: {
      title: 'The sign-in was not saved yet',
      body: 'Claude has not saved the sign-in to disk yet (it does so about every 30 seconds). Wait longer, or '
        + 'cancel to put your main Claude back.',
      waitLonger: 'Wait longer',
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
    lookupFailed: {
      title: 'Couldn\'t find Claude in time',
      body: 'Try again.',
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
    reopened: {
      title: 'Claude was opened again',
      body: 'Close it and try again.',
    },
    noWindow: {
      title: 'Claude is starting in the background',
      body: 'Claude started, but its window has not appeared yet. Wait a few seconds, then click the card again.',
    },
    closeFailed: {
      title: 'Could not close this account',
      body: 'Claude is still running with this account. Try again, or end it in Task Manager.',
    },
    disk: {
      title: 'Not enough disk space',
      body: 'Free at least 500 MB on the system drive, then try again.',
    },
    notSignedIn: {
      title: 'That account is not signed in',
      body: 'Pick another account to copy the memories from.',
    },
  } satisfies Record<ActionError, { title: string; body: string }>,
  ok: 'OK',
  cancel: 'Cancel',
  addAccount: 'Add account',
  signInOff: 'Adding accounts is turned off: the main Claude profile was not found.',
  status: {
    running: 'Running',
    runningSignedOut: 'Running · Not signed in',
    checking: 'Checking…',
    signedOut: 'Not signed in',
  } satisfies Record<CardStatus, string>,
  /** Add account and Edit details (WINDOWS.md §5: typed by the person, not read from Claude). */
  details: {
    editTitle: (name: string) => `Details of “${name}”`,
    editBody: 'Type them as they appear in Claude (Settings → Account). The launcher does not read them from Claude.',
    cardName: 'Card name',
    email: 'Email',
    realName: 'Account name (optional)',
    save: 'Save',
    nameMissing: 'Type a name for the card.',
    errors: {
      emailMissing: 'Type the email of this Claude account.',
      emailInvalid: 'This does not look like an email address.',
    } satisfies Record<DetailsError, string>,
  },
  /** Receive memories from… (Phase 5.1): a guided copy and paste; the launcher never reads Claude's memories. */
  memories: {
    warning: {
      title: 'Receive memories?',
      body: (source: string, target: string) => `You will copy the memories of “${source}” and import them into `
        + `“${target}”.\n\n`
        + `• They are added to the memories “${target}” already has; nothing there is replaced.\n`
        + '• They may duplicate or contradict what it already remembers.\n'
        + '• Importing memories is experimental in Claude.\n'
        + '• For work accounts, check your organization\'s rules before moving memories between accounts.',
      proceed: 'Proceed',
    },
    copy: {
      title: (source: string) => `Step 1 of 2 · Copy from “${source}”`,
      body: (source: string) => `Claude opens with “${source}”. In it:`,
      steps: ['Settings → Your Claude → Manage', 'Copy the memories', 'Paste them below'],
      opening: 'Opening Claude…',
      placeholder: 'Paste the memories here, or drop a .txt or .md file',
      tip: 'Tip: if Manage does not offer a copy, ask Claude “Write out all my memories verbatim.” and copy the answer.',
      next: 'Next',
    },
    import: {
      title: (target: string) => `Step 2 of 2 · Import into “${target}”`,
      body: (target: string) => `Claude opens with “${target}”, and the memories are on the clipboard. In it:`,
      steps: ['Settings → Your Claude → Start import', 'Paste', 'Add to memory'],
      copyAgain: 'Copy again',
      copied: 'The memories are on the clipboard again.',
      done: 'Done',
    },
    errors: {
      empty: 'Paste the memories first, or drop a .txt or .md file.',
      tooLong: 'This text is too long for a list of memories (over 100,000 characters).',
    } satisfies Record<MemoryTextError, string>,
    fileType: 'Drop a .txt or .md file.',
  },
  photo: {
    failed: {
      title: 'Could not use this image',
      body: 'Pick a PNG, JPG or WebP image.',
    },
  },
} as const;
