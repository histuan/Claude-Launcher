import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greetingFor } from '../src/core/greeting.js';
import { strings } from '../src/renderer/strings.js';

const at = (h, m = 0) => new Date(2026, 9, 26, h, m);
const text = (date) => strings.greeting[greetingFor(date)];

test('Good morning from 5:00 to 11:59', () => {
  assert.equal(text(at(5, 0)), 'Good morning');
  assert.equal(text(at(11, 59)), 'Good morning');
});

test('Good afternoon from 12:00 to 17:59', () => {
  assert.equal(text(at(12, 0)), 'Good afternoon');
  assert.equal(text(at(17, 59)), 'Good afternoon');
});

test('Good evening from 18:00 to 4:59', () => {
  assert.equal(text(at(18, 0)), 'Good evening');
  assert.equal(text(at(0, 0)), 'Good evening');
  assert.equal(text(at(4, 59)), 'Good evening');
});
