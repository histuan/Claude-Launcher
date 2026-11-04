// 0.6.2: one shared button style. Every button in the page is a dialog button (secondary / .primary / .danger),
// the main-screen .add, or a .text-link, and each of those has a hover, a pressed state and no motion when reduced.
// Menu items and cards are built in app.ts (.menu button, .card-open, .card-menu, .pencil).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('src/renderer/index.html', 'utf8');
const css = readFileSync('src/renderer/styles.css', 'utf8');

test('every button in index.html uses a shared style', () => {
  const outside = html.replace(/<div class="dialog-buttons">[\s\S]*?<\/div>/g, '');
  const loose = [...outside.matchAll(/<button\b[^>]*>/g)].map((m) => m[0])
    .filter((tag) => !/class="[^"]*\b(text-link|add)\b/.test(tag));
  assert.deepEqual(loose, []);
});

test('the shared styles have hover and pressed states, without hover when disabled', () => {
  for (const sel of ['.dialog-buttons button', '.dialog-buttons button.primary', '.dialog-buttons button.danger', '.text-link']) {
    assert.ok(css.includes(`${sel}:hover:enabled`), `${sel} hover`);
    assert.ok(css.includes(`${sel}:active:enabled`), `${sel} pressed`);
  }
  assert.match(css, /\.menu button:is\(:hover, :focus-visible\):not\(\[aria-disabled="true"\]\)/);
  assert.match(css, /\.add:hover:not\(\[aria-disabled="true"\]\)/);
  assert.match(css, /transition: background-color var\(--transition\), color var\(--transition\)/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.dialog-buttons button, \.add, \.menu button, \.text-link/);
});
