// Regenerates build/icon.ico from build/icon.svg. Run only when the SVG changes: `npm run icon`.
// Needs Playwright with Chromium installed (not a project dependency; present in the cloud sessions).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Local install first, then the global one.
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright'));
  }
}
const { chromium } = loadPlaywright();

const svg = readFileSync('build/icon.svg', 'utf8');
const sizes = [256, 128, 64, 48, 32, 16];

const browser = await chromium.launch();
const page = await browser.newPage();
const pngs = [];
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  pngs.push(await page.screenshot({ omitBackground: true }));
}
await browser.close();

// ICO = 6-byte header + one 16-byte entry per image + the PNG files (PNG entries work since Windows Vista).
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(size % 256, e); // 0 means 256
  header.writeUInt8(size % 256, e + 1);
  header.writeUInt16LE(1, e + 4); // colour planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
writeFileSync('build/icon.ico', Buffer.concat([header, ...pngs]));
console.log(`build/icon.ico: ${sizes.join(', ')} px`);
