// Phase 5: account details are typed by the person (WINDOWS.md §5, option 3): e-mail required, real name optional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDetails, MAX_REAL_NAME_LENGTH } from '../src/core/details.js';
import { squareCrop } from '../src/core/photo.js';

test('details: e-mail required and trimmed, real name optional and capped', () => {
  assert.deepEqual(checkDetails('  me@work.com ', '  Thiago U. '), { email: 'me@work.com', realName: 'Thiago U.' });
  assert.deepEqual(checkDetails('t@unifor.edu.br', '   '), { email: 't@unifor.edu.br', realName: null });
  assert.deepEqual(checkDetails('   ', 'x'), { error: 'emailMissing' });
  for (const bad of ['me', 'me@', '@work.com', 'me@work', 'me@@work.com', 'me @work.com', 'me@work.', `${'a'.repeat(250)}@b.cd`]) {
    assert.deepEqual(checkDetails(bad, ''), { error: 'emailInvalid' }, bad);
  }
  const long = checkDetails('a@b.cd', 'x'.repeat(100));
  assert.ok('realName' in long && long.realName?.length === MAX_REAL_NAME_LENGTH);
});

test('photo: centred square crop of any image', () => {
  assert.deepEqual(squareCrop(400, 300), { x: 50, y: 0, size: 300 });
  assert.deepEqual(squareCrop(300, 401), { x: 0, y: 50, size: 300 });
  assert.deepEqual(squareCrop(256, 256), { x: 0, y: 0, size: 256 });
  assert.deepEqual(squareCrop(1, 3), { x: 0, y: 1, size: 1 });
});
