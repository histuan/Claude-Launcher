import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDisplayName } from '../src/core/name.js';

test('first word of the display name, without stray punctuation', () => {
  assert.equal(cleanDisplayName('alexr .', 'alex'), 'alexr');
  assert.equal(cleanDisplayName('Alex Rivera', 'alex'), 'Alex');
  assert.equal(cleanDisplayName('  "Alex," Rivera ', 'alex'), 'Alex');
  assert.equal(cleanDisplayName('. Alex', 'alex'), 'Alex');
});

test('keeps punctuation inside the word and accents', () => {
  assert.equal(cleanDisplayName('Jean-Luc Picard', 'x'), 'Jean-Luc');
  assert.equal(cleanDisplayName("O'Brien", 'x'), "O'Brien");
  assert.equal(cleanDisplayName('Élodie', 'x'), 'Élodie');
});

test('falls back to USERNAME when the display name is empty', () => {
  assert.equal(cleanDisplayName('', 'alex'), 'alex');
  assert.equal(cleanDisplayName(' . ', 'alex'), 'alex');
  assert.equal(cleanDisplayName(null, ' alex '), 'alex');
  assert.equal(cleanDisplayName(undefined, undefined), '');
});
