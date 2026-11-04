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

/** One Markdown file of Claude's memory export, its path without the claude-memory-<date>/ folder. */
export interface MemoryFile {
  path: string;
  text: string;
}

/**
 * Project memories (projects/…) start unchecked: imported, they would land in the other account's general memory.
 * Everything else starts checked.
 */
export function checkedByDefault(path: string): boolean {
  return !path.startsWith('projects/');
}

/** Files grouped by folder ('' = top level, first), folders and files in path order. */
export function memoryFolders(files: MemoryFile[]): { folder: string; files: MemoryFile[] }[] {
  const folderOf = (f: MemoryFile): string => (f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '');
  const byPath = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const groups = new Map<string, MemoryFile[]>();
  for (const f of [...files].sort((a, b) => byPath(a.path, b.path))) {
    const folder = folderOf(f);
    groups.set(folder, [...(groups.get(folder) ?? []), f]);
  }
  return [...groups.entries()].sort(([a], [b]) => byPath(a, b)).map(([folder, list]) => ({ folder, files: list }));
}

/** A file as it appears in the text: a heading with its path, then its content. */
export const memorySection = (file: MemoryFile): string => `# ${file.path}\n\n${file.text}`;

const SEPARATOR = '\n\n';

export const joinMemoryFiles = (files: MemoryFile[]): string => files.map(memorySection).join(SEPARATOR);

export type MemorySplit = { parts: string[] } | { error: 'empty' } | { error: 'fileTooLong'; path: string };

/**
 * Parts of whole files (in the given order), each at most `max` characters, for one Start import each. A file is
 * never cut: one that alone is over the limit is reported instead.
 */
export function splitMemoryParts(files: MemoryFile[], max = MAX_MEMORY_CHARS): MemorySplit {
  if (files.length === 0) return { error: 'empty' };
  const parts: string[] = [];
  let current = '';
  for (const file of files) {
    const section = memorySection(file);
    if (section.length > max) return { error: 'fileTooLong', path: file.path };
    if (current && current.length + SEPARATOR.length + section.length > max) {
      parts.push(current);
      current = section;
    } else {
      current = current ? current + SEPARATOR + section : section;
    }
  }
  parts.push(current);
  return { parts };
}

export function checkMemoryText(text: string): { text: string } | { error: MemoryTextError } {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'empty' };
  if (trimmed.length > MAX_MEMORY_CHARS) return { error: 'tooLong' };
  return { text: trimmed };
}
