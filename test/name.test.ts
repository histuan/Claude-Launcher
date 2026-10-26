import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDisplayName } from '../src/core/name.js';

test('first word of the display name, without stray punctuation', () => {
  assert.equal(cleanDisplayName('histuan .', 'thiag'), 'histuan');
  assert.equal(cleanDisplayName('Thiago Gomes', 'thiag'), 'Thiago');
  assert.equal(cleanDisplayName('  "Thiago," Gomes ', 'thiag'), 'Thiago');
  assert.equal(cleanDisplayName('. Thiago', 'thiag'), 'Thiago');
});

test('keeps punctuation inside the word and accents', () => {
  assert.equal(cleanDisplayName('Jean-Luc Picard', 'x'), 'Jean-Luc');
  assert.equal(cleanDisplayName("O'Brien", 'x'), "O'Brien");
  assert.equal(cleanDisplayName('Élodie', 'x'), 'Élodie');
});

test('falls back to USERNAME when the display name is empty', () => {
  assert.equal(cleanDisplayName('', 'thiag'), 'thiag');
  assert.equal(cleanDisplayName(' . ', 'thiag'), 'thiag');
  assert.equal(cleanDisplayName(null, ' thiag '), 'thiag');
  assert.equal(cleanDisplayName(undefined, undefined), '');
});
