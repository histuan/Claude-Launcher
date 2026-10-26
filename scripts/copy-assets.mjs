// tsc only emits JS: copy the renderer's HTML and CSS next to the compiled scripts.
import { cpSync } from 'node:fs';

cpSync('src/renderer', 'out/src/renderer', {
  recursive: true,
  filter: (file) => !file.endsWith('.ts'),
});
