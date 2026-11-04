// Phase 5.1: who can be the source, and which pasted texts are accepted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account } from '../src/core/config.js';
import {
  checkedByDefault, checkMemoryText, joinMemoryFiles, MAX_MEMORY_CHARS, memoryFolders, memorySection, memorySources,
  splitMemoryParts, type MemoryFile,
} from '../src/core/memories.js';

const acc = (id: string, profileDir: string | null): Account =>
  ({ id, label: id, email: null, realName: null, photo: null, profileDir, signedIn: null });
const accounts = [acc('main', null), acc('work', 'C:\\p\\work'), acc('home', 'C:\\p\\home'), acc('old', 'C:\\p\\old')];

test('sources are the other signed-in accounts (Main counts as signed in)', () => {
  assert.deepEqual(memorySources(accounts, 'work', { signedOut: ['old'], checking: [] }).map((a) => a.id), ['main', 'home']);
  assert.deepEqual(memorySources(accounts, 'main', { signedOut: [], checking: [] }).map((a) => a.id), ['work', 'home', 'old']);
});

test('an account whose state is still being checked is not offered', () => {
  assert.deepEqual(memorySources(accounts, 'main', { signedOut: ['old'], checking: ['home'] }).map((a) => a.id), ['work']);
});

test('a signed-out target gets no sources (it cannot import)', () => {
  assert.deepEqual(memorySources(accounts, 'old', { signedOut: ['old'], checking: [] }), []);
});

test('pasted text: trimmed, empty refused, too long refused', () => {
  assert.deepEqual(checkMemoryText('  my memory \r\n'), { text: 'my memory' });
  assert.deepEqual(checkMemoryText(' \n\t'), { error: 'empty' });
  assert.deepEqual(checkMemoryText('x'.repeat(MAX_MEMORY_CHARS + 1)), { error: 'tooLong' });
  assert.deepEqual(checkMemoryText('x'.repeat(MAX_MEMORY_CHARS)), { text: 'x'.repeat(MAX_MEMORY_CHARS) });
});

const file = (path: string, size: number): MemoryFile => ({ path, text: 'x'.repeat(size) });

test('Project memories (projects/) start unchecked, everything else checked', () => {
  assert.equal(checkedByDefault('projects/launcher.md'), false);
  assert.equal(checkedByDefault('projects/a/b.md'), false);
  assert.equal(checkedByDefault('areas/claude-launcher.md'), true);
  assert.equal(checkedByDefault('about.md'), true);
  assert.equal(checkedByDefault('notes/projects.md'), true);
});

test('files grouped by folder (top level first), in path order', () => {
  const files = [file('projects/b.md', 1), file('about.md', 1), file('areas/x.md', 1), file('areas/a.md', 1)];
  assert.deepEqual(memoryFolders(files).map((g) => [g.folder, g.files.map((f) => f.path)]), [
    ['', ['about.md']],
    ['areas', ['areas/a.md', 'areas/x.md']],
    ['projects', ['projects/b.md']],
  ]);
});

test('joined text: one heading per file, a blank line between files', () => {
  const files = [{ path: 'a.md', text: 'one' }, { path: 'areas/b.md', text: 'two' }];
  assert.equal(memorySection(files[0]!), '# a.md\n\none');
  assert.equal(joinMemoryFiles(files), '# a.md\n\none\n\n# areas/b.md\n\ntwo');
});

test('under the limit: one part, the same text as the box', () => {
  const files = [file('a.md', 10), file('b.md', 20)];
  assert.deepEqual(splitMemoryParts(files), { parts: [joinMemoryFiles(files)] });
});

test('over the limit: parts of whole files, each under the limit, nothing lost', () => {
  // About the size of the PC test (131,248 characters in 41 files).
  const files = Array.from({ length: 41 }, (_, i) => file(`areas/f${String(i).padStart(2, '0')}.md`, 3190));
  const result = splitMemoryParts(files);
  assert.ok('parts' in result);
  assert.equal(result.parts.length, 2);
  for (const part of result.parts) assert.ok(part.length <= MAX_MEMORY_CHARS, String(part.length));
  // Every file whole, in order, in exactly one part.
  assert.equal(result.parts.join('\n\n'), joinMemoryFiles(files));
  for (const part of result.parts) assert.ok(part.startsWith('# areas/f'));
});

test('a part fills up to exactly the limit, one character more starts a new part', () => {
  const head = memorySection(file('a.md', 0)).length; // "# a.md\n\n"
  const exact = [file('a.md', 50_000 - head), file('b.md', 50_000 - head - 2)];
  assert.equal(joinMemoryFiles(exact).length, MAX_MEMORY_CHARS);
  assert.equal((splitMemoryParts(exact) as { parts: string[] }).parts.length, 1);
  const over = [file('a.md', 50_000 - head), file('b.md', 50_000 - head - 1)];
  assert.equal((splitMemoryParts(over) as { parts: string[] }).parts.length, 2);
});

test('a single file over the limit is reported, never cut', () => {
  const result = splitMemoryParts([file('a.md', 10), file('areas/huge.md', MAX_MEMORY_CHARS)]);
  assert.deepEqual(result, { error: 'fileTooLong', path: 'areas/huge.md' });
});

test('no file checked = nothing to import', () => {
  assert.deepEqual(splitMemoryParts([]), { error: 'empty' });
});
