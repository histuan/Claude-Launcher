// tsc only emits JS: copy the renderer's HTML, CSS and SVG next to the compiled scripts,
// plus the bundled OFL fonts (variable weight, normal style) with their licenses. No CDN: the app works offline.
import { cpSync } from 'node:fs';

cpSync('src/renderer', 'out/src/renderer', {
  recursive: true,
  filter: (file) => !file.endsWith('.ts'),
});

for (const font of ['inter', 'source-serif-4']) {
  const from = `node_modules/@fontsource-variable/${font}`;
  const to = `out/src/renderer/fonts/${font}`;
  cpSync(`${from}/wght.css`, `${to}/wght.css`);
  cpSync(`${from}/LICENSE`, `${to}/LICENSE`);
  cpSync(`${from}/files`, `${to}/files`, {
    recursive: true,
    filter: (file) => !file.endsWith('.woff2') || file.endsWith('-wght-normal.woff2'),
  });
}
