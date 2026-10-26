import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greetingFor } from '../src/core/greeting.js';

const at = (h, m = 0) => new Date(2026, 9, 26, h, m);

test('Bom dia das 5h00 às 11h59', () => {
  assert.equal(greetingFor(at(5, 0)), 'Bom dia');
  assert.equal(greetingFor(at(11, 59)), 'Bom dia');
});

test('Boa tarde das 12h00 às 17h59', () => {
  assert.equal(greetingFor(at(12, 0)), 'Boa tarde');
  assert.equal(greetingFor(at(17, 59)), 'Boa tarde');
});

test('Boa noite das 18h00 às 4h59', () => {
  assert.equal(greetingFor(at(18, 0)), 'Boa noite');
  assert.equal(greetingFor(at(0, 0)), 'Boa noite');
  assert.equal(greetingFor(at(4, 59)), 'Boa noite');
});
