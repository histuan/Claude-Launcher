// Every user-facing text lives here, so other languages can be added later.
import type { GreetingPeriod } from '../core/greeting.js';

export const strings = {
  appName: 'Multi-Account Launcher for Claude',
  placeholder: 'Phase 1 skeleton. The real screen arrives in Phase 2.',
  greeting: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  } satisfies Record<GreetingPeriod, string>,
  mainAccount: 'Main',
  menu: {
    rename: 'Rename',
    changePhoto: 'Change photo',
    remove: 'Remove',
  },
  addAccount: 'Add account',
  running: '● Running',
} as const;
