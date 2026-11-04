// README badges: rounded pills in the launcher's colours (shields.io cannot do large rounded badges).
//   node scripts/make-badges.ts            -> docs/badges/windows.svg, docs/badges/license.svg (static, committed)
//   node scripts/make-badges.ts --release  -> dist/badge-download.svg with the package.json version; the release
//                                             step uploads it, so .../releases/latest/download/badge-download.svg
//                                             always shows the latest version without a commit.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ACCENT = '#d97757';
const DARK = '#2b2a27';
const DARK_BORDER = '#4a4843';
const LIGHT_TEXT = '#ece9e1';
const FONT = "'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif";

// 24 x 24 stroke icons (Tabler-like), drawn in the given colour.
const ICONS: Record<string, string> = {
  download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M7 11l5 5l5-5"/><path d="M12 4v12"/>',
  windows: '<path d="M4 6l7-1v6.5H4z"/><path d="M13 4.7l7-1V11.5h-7z"/><path d="M4 13.5h7V19l-7-1z"/>'
    + '<path d="M13 13.5h7v6.8l-7-1z"/>',
  scale: '<path d="M7 20h10"/><path d="M6 6l6-1l6 1"/><path d="M12 3v17"/><path d="M9 12l-3-6l-3 6a3 3 0 0 0 6 0"/>'
    + '<path d="M21 12l-3-6l-3 6a3 3 0 0 0 6 0"/>',
};

interface Pill { text: string; icon: string; primary: boolean }

// Average glyph width of the fallback fonts at 14 px; textLength pins the text to this width in every font.
const textWidth = (text: string, bold: boolean): number => Math.round(text.length * (bold ? 7.9 : 7.4));

function pill({ text, icon, primary }: Pill): string {
  const h = primary ? 38 : 36;
  const padX = primary ? 18 : 16;
  const iconSize = 16;
  const gap = 8;
  const tw = textWidth(text, primary);
  const w = padX + iconSize + gap + tw + padX;
  const r = h / 2;
  const fill = primary ? ACCENT : DARK;
  const textColour = primary ? '#ffffff' : LIGHT_TEXT;
  const iconColour = primary ? '#ffffff' : ACCENT;
  const border = primary ? '' : ` stroke="${DARK_BORDER}" stroke-width="1"`;
  const iconY = (h - iconSize) / 2;
  const scale = iconSize / 24;
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"`
    + ` aria-label="${esc}"><title>${esc}</title>`
    + `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" fill="${fill}"${border}/>`
    + `<g transform="translate(${padX} ${iconY}) scale(${scale})" fill="none" stroke="${iconColour}"`
    + ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</g>`
    + `<text x="${padX + iconSize + gap}" y="${h / 2}" dominant-baseline="central" font-family="${FONT}"`
    + ` font-size="14" font-weight="${primary ? 600 : 400}" fill="${textColour}" textLength="${tw}"`
    + ` lengthAdjust="spacingAndGlyphs">${esc}</text></svg>\n`;
}

if (process.argv.includes('--release')) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/badge-download.svg', pill({ text: `Download v${version} for Windows`, icon: 'download', primary: true }));
} else {
  mkdirSync('docs/badges', { recursive: true });
  writeFileSync('docs/badges/download.svg', pill({ text: 'Download for Windows', icon: 'download', primary: true }));
  writeFileSync('docs/badges/windows.svg', pill({ text: 'Windows 10 / 11', icon: 'windows', primary: false }));
  writeFileSync('docs/badges/license.svg', pill({ text: 'MIT license', icon: 'scale', primary: false }));
}
