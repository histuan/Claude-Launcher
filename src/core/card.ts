// What a card shows besides its name. Pure and DOM-free (the renderer and the tests both load it).
import type { Account } from './config.js';

/** Keys of strings.badges. */
export type CardBadge = 'main';

/** Main keeps its badge even after a rename: the badge follows the profile (no --user-data-dir), not the name. */
export function cardBadge(account: Account): CardBadge | null {
  return account.profileDir === null ? 'main' : null;
}

/** Keys of strings.status. */
export type CardStatus = 'running' | 'runningSignedOut';

/** The status line under a card: only while it runs. A closed signed-out card says so in its text line instead. */
export function cardStatus(running: boolean, signedOut: boolean): CardStatus | null {
  if (!running) return null;
  return signedOut ? 'runningSignedOut' : 'running';
}
