// "Receive memories from…" (Phase 5.1): a guided copy and paste, not a transfer. Memories live on Anthropic's
// servers and there is no official API, so the person copies them in one account and imports them in another.
import type { Account } from './config.js';

/** Far more than a memory list; a bigger paste is almost certainly the wrong text. */
export const MAX_MEMORY_CHARS = 100_000;

export type MemoryTextError = 'empty' | 'tooLong';

/**
 * Accounts offered as the source: every other signed-in account (Main counts as signed in; an account still being
 * checked does not). A signed-out target gets none: it could not import.
 */
export function memorySources(
  accounts: Account[], targetId: string, cards: { signedOut: string[]; checking: string[] },
): Account[] {
  // Main = profileDir null (config.ts isMain is not imported: config.ts needs node:path, the window cannot load it).
  const signedIn = (a: Account): boolean => a.profileDir === null || (!cards.signedOut.includes(a.id) && !cards.checking.includes(a.id));
  const target = accounts.find((a) => a.id === targetId);
  if (!target || !signedIn(target)) return [];
  return accounts.filter((a) => a !== target && signedIn(a));
}

export function checkMemoryText(text: string): { text: string } | { error: MemoryTextError } {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'empty' };
  if (trimmed.length > MAX_MEMORY_CHARS) return { error: 'tooLong' };
  return { text: trimmed };
}
