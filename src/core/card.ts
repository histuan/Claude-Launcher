// What a card shows besides its name. Pure and DOM-free (the renderer and the tests both load it).
import type { Account } from './config.js';

/** Keys of strings.badges. */
export type CardBadge = 'main';

/** Main keeps its badge even after a rename: the badge follows the profile (no --user-data-dir), not the name. */
export function cardBadge(account: Account): CardBadge | null {
  return account.profileDir === null ? 'main' : null;
}

/** Keys of strings.status. */
export type CardStatus = 'running' | 'runningSignedOut' | 'checking' | 'signedOut';

/**
 * The status line of a card. Running: from the last known state (a running account is never read: its cookie
 * database is locked). Closed: "Checking…" while its cookie database is read again, else "Not signed in" if so
 * (0.5.0: here, not in the e-mail line, which now always shows the typed e-mail).
 */
export function cardStatus(running: boolean, signedOut: boolean, checking = false): CardStatus | null {
  if (running) return signedOut ? 'runningSignedOut' : 'running';
  if (checking) return 'checking';
  return signedOut ? 'signedOut' : null;
}
