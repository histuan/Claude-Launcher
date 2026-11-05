// 0.7.0 review round: contrast of the theme's text colours (WCAG AA), dialog labels, focus back to the opener,
// a window that never navigates away, and the "Copy diagnostics" link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('src/renderer/index.html', 'utf8');
const css = readFileSync('src/renderer/styles.css', 'utf8');
const app = readFileSync('src/renderer/app.ts', 'utf8');
const main = readFileSync('src/main/main.ts', 'utf8');

const color = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
  assert.ok(m, `--${name} defined`);
  return m[1]!;
};
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('text colours reach 4.5:1 on every background they are used on', () => {
  const backgrounds = ['bg', 'surface', 'surface-hover'];
  for (const text of ['text', 'text-email', 'text-real-name', 'danger-text', 'running']) {
    for (const bg of backgrounds) {
      const ratio = contrast(color(text), color(bg));
      assert.ok(ratio >= 4.5, `--${text} on --${bg}: ${ratio.toFixed(2)}`);
    }
  }
  // Links: --accent on the main background (corner), --accent-text inside dialogs (--surface).
  assert.ok(contrast(color('accent'), color('bg')) >= 4.5);
  assert.ok(contrast(color('accent-text'), color('surface')) >= 4.5);
  // Dark text on the orange and red buttons.
  assert.ok(contrast(color('bg'), color('accent')) >= 4.5);
  assert.ok(contrast(color('bg'), color('danger')) >= 4.5);
  assert.doesNotMatch(css, /\.steps \.next \{[^}]*opacity/, 'no opacity on top of the muted colour');
  assert.match(css, /dialog p\.error \{ color: var\(--danger-text\); \}/);
  assert.match(css, /\.menu \.danger \{ color: var\(--danger-text\); \}/);
});

test('every dialog is named by its title; the fields without a visible label too', () => {
  const dialogs = [...html.matchAll(/<dialog id="([^"]+)"([^>]*)>/g)];
  assert.equal(dialogs.length, 5);
  for (const [, id, attrs] of dialogs) {
    assert.match(attrs!, new RegExp(`aria-labelledby="${id}-title"`), id);
    assert.ok(html.includes(`<h2 id="${id}-title">`), `${id} title`);
  }
  assert.match(html, /<input id="dialog-input" aria-labelledby="dialog-title"/);
  assert.match(html, /<textarea id="memories-text" aria-labelledby="memories-title"/);
});

test('dialogs open through openModal (focus goes back to the opener when the last one closes)', () => {
  assert.doesNotMatch(app.replace(/function openModal[\s\S]*?\n}\n/, ''), /\.showModal\(\)/);
  assert.match(app, /'data-focus-key': `menu:\$\{account\.id\}`/);
  assert.match(app, /closeMenu\(true\); action\(\);/);
  assert.match(app, /for \(const d of document\.querySelectorAll\('dialog'\)\) d\.addEventListener\('close'/);
});

test('icon-only buttons have a label', () => {
  assert.match(app, /class: 'pencil'[^)]*'aria-label': strings\.editName/);
  assert.match(app, /class: 'card-menu'[\s\S]{0,120}'aria-label': strings\.accountOptions\(name\)/);
});

test('the window never navigates away and never opens another window', () => {
  assert.match(main, /webContents\.on\('will-navigate', \(e\) => e\.preventDefault\(\)\)/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  // shell.openExternal only with URLs built in the main process.
  for (const m of main.matchAll(/shell\.openExternal\(([^;]*)\)/g)) assert.match(m[1]!, /RELEASES_URL/);
});

test('"Copy diagnostics" sits next to the version label, in the same style', () => {
  assert.match(html, /<button id="diagnostics" class="text-link version" type="button" aria-live="polite"><\/button>\s*<button id="version"/);
});
