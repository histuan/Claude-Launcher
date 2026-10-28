// What a card shows besides its name. Pure and DOM-free (the renderer and the tests both load it).
import type { Account } from './config.js';

/** Keys of strings.badges. */
export type CardBadge = 'main';

/** Main keeps its badge even after a rename: the badge follows the profile (no --user-data-dir), not the name. */
export function cardBadge(account: Account): CardBadge | null {
  return account.profileDir === null ? 'main' : null;
}
