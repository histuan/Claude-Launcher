// Every user-facing text lives here, so other languages can be added later.
import type { ActionError, StartStep } from '../core/api.js';
import type { CardBadge, CardStatus } from '../core/card.js';
import type { DetailsError } from '../core/details.js';
import type { MemoryTextError } from '../core/memories.js';
import type { MemoryZipError } from '../core/memoryZip.js';
import type { DiagnosticsText } from '../core/diagnostics.js';
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
  /** Bottom-right corner, e.g. "v0.6.2": a link to that version's release page (0.6.2). */
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
      steps: [
        'Settings → Memory',
        'Export memory → Export (a .zip of your memory files downloads)',
        'Drop the .zip below, or choose it with “Choose a file…”, then check the files to bring',
      ],
      opening: 'Opening Claude…',
      placeholder: 'Drop the exported .zip here, or paste the memories (a .txt or .md file works too)',
      chooseFile: 'Choose a file…',
      reading: 'Reading the .zip…',
      /** The .zip was read: its files are listed with a checkbox each; the box shows the checked ones. */
      fromZip: (files: number, hasProjects: boolean) => (hasProjects
        ? 'projects/ starts unchecked: Project memories would land in the general memory of the other account.'
        : `${files} memory ${files === 1 ? 'file' : 'files'} from the .zip; the box shows the checked ones.`),
      /** Checklist group of the files that are not in a folder. */
      topLevel: 'Top level',
      /** Running total under the checklist; parts > 1 = over the limit, imported in parts in step 2. */
      total: (checked: number, files: number, chars: string, parts: number) => `${checked} of ${files} files · `
        + `${chars} characters` + (parts > 1 ? ` · over 100,000: imported in ${parts} parts` : ''),
      tip: 'Tip: if Export is not there, ask Claude “Write out all my memories verbatim.” and paste the answer.',
      next: 'Next',
    },
    import: {
      title: (target: string) => `Step 2 of 2 · Import into “${target}”`,
      body: (target: string) => `Claude opens with “${target}”, and the memories are on the clipboard. In it:`,
      steps: [
        'Settings → Memory → Import memory from other AI providers → Start import',
        'Claude shows a prompt for the other provider: you already have the memories, so paste them (Ctrl+V)',
        'Confirm',
      ],
      /** Over the limit: whole files in parts, one Start import each. */
      partsBody: (target: string, parts: number) => `Claude opens with “${target}”. The memories are in ${parts} parts `
        + '(whole files, each under the limit): import them one at a time. For each part, in Claude:',
      partOnClipboard: (part: number, parts: number) => `Part ${part} of ${parts} is on the clipboard.`,
      copyAgain: 'Copy again',
      copyPart: 'Copy part',
      nextPart: 'Next part',
      copied: 'The memories are on the clipboard again.',
      partCopied: (part: number, parts: number) => `Part ${part} of ${parts} is on the clipboard again.`,
      done: 'Done',
    },
    errors: {
      empty: 'Paste the memories first, or drop the exported .zip.',
    } satisfies Record<Exclude<MemoryTextError, 'tooLong'>, string>, // tooLong: pastedTooLong below
    /** Pasted text (or a .txt / .md file) cannot be split by file: nothing is cut. */
    pastedTooLong: (chars: string) => `This text has ${chars} characters, over the limit of 100,000. Nothing was cut: `
      + 'drop the exported .zip instead (it is imported in parts, by whole files), or shorten the text.',
    noneChecked: 'Check at least one file.',
    /** One file alone does not fit in a part; files are never cut. */
    fileTooLong: (path: string, chars: string) => `“${path}” alone has ${chars} characters, over the limit of `
      + '100,000, and a file is never cut. Uncheck it, or ask Claude to shorten that memory first.',
    zipErrors: {
      broken: 'This .zip could not be read. Export it again from Claude, or paste the memories.',
      tooBig: 'This .zip has more than 2 MB of memory text (or is over 20 MB): it does not look like a memory export.',
      tooManyEntries: 'This .zip has more than 500 files: it does not look like a memory export.',
      noMemories: 'This .zip has no .md memory files.',
      unsupported: 'This .zip uses a format the launcher cannot read (encrypted or Zip64). Paste the memories instead.',
    } satisfies Record<MemoryZipError, string>,
    fileType: 'Use the exported .zip, or a .txt or .md file.',
  },
  /** Self-update (Phase 5.2, 0.6.2): asked once per start; nothing is ever forced. */
  update: {
    title: (version: string) => `Version ${version} is available. Install now?`,
    body: 'The launcher closes, installs it and opens again by itself.',
    whatsNew: 'What\'s new',
    later: 'Later',
    install: 'Install',
    downloading: (percent: number) => `Downloading… ${percent}%`,
    // The install is silent (no installer window): say how long the gap is.
    installing: 'Installing… the launcher opens again in about 20 seconds.',
    busy: 'Finish the sign-in or the memory import first, then choose Install again.',
    failedTitle: (version: string) => `Couldn't update to version ${version}`,
    failed: 'The update could not be downloaded or installed. Nothing was changed.',
    releases: 'Download it from the Releases page',
    close: 'Close',
    /** Discreet link next to the version label after Later, while a newer version is known. */
    link: (version: string) => `Update to ${version}`,
    /** Started while the update installer still runs. */
    finishing: 'Finishing the update…',
    finishingDetail: 'The launcher opens again by itself in a few seconds.',
    ok: 'OK',
  },
  /** 0.7.0: "Copy diagnostics" next to the version label; the report is plain text, nothing personal. */
  diagnostics: {
    link: 'Copy diagnostics',
    copied: 'Copied',
    failed: 'Could not copy',
    report: {
      title: 'Multi-Account Launcher for Claude — diagnostics',
      created: 'Created',
      launcher: 'Launcher',
      claude: 'Claude',
      unknown: 'not found',
      windows: 'Windows',
      accounts: (count: number, signedIn: number) => `Accounts: ${count} (${signedIn} signed in)`,
      states: { signedIn: 'signed in', signedOut: 'not signed in', checking: 'checking' },
      running: 'running',
      paths: 'Paths',
      claudeExe: 'Claude.exe',
      mainProfile: 'Main profile',
      extraProfiles: 'Other profiles',
      logFile: 'Log',
      notCached: 'not known yet',
      logTail: (lines: number) => `Last ${lines} lines of sign-in-timings.log`,
      emptyLog: '(empty)',
    } satisfies DiagnosticsText,
  },
  photo: {
    failed: {
      title: 'Could not use this image',
      body: 'Pick a PNG, JPG or WebP image.',
    },
  },
} as const;
