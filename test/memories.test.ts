// Phase 5.1: who can be the source, and which pasted texts are accepted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Account } from '../src/core/config.js';
import { checkMemoryText, MAX_MEMORY_CHARS, memorySources } from '../src/core/memories.js';

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
